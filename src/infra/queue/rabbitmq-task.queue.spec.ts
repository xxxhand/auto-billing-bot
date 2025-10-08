import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQTaskQueue } from './rabbitmq-task.queue';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn()
}));

import * as amqp from 'amqplib';

describe('RabbitMQTaskQueue', () => {
  let taskQueue: RabbitMQTaskQueue;
  let mockConnection: any;
  let mockChannel: any;

  const mockTask: BillingTask = {
    taskId: 'task-123',
    subscriptionId: 'sub-456',
    taskType: 'billing',
    retryCount: 0,
    createdAt: new Date(),
    metadata: { amount: 100 }
  };

  beforeEach(async () => {
    // Setup mocks
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test_queue' }),
      bindQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn().mockResolvedValue(true),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue({})
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({})
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RabbitMQTaskQueue],
    }).compile();

    taskQueue = module.get<RabbitMQTaskQueue>(RabbitMQTaskQueue);

    // Manually call onModuleInit since we're not using the full NestJS lifecycle in tests
    await taskQueue.onModuleInit();
  });

  afterEach(async () => {
    await taskQueue.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('getQueueName', () => {
    it('should return "rabbitmq"', () => {
      expect(taskQueue.getQueueName()).toBe('rabbitmq');
    });
  });

  describe('publishTask', () => {
    it('should publish task to main queue', async () => {
      await taskQueue.publishTask(mockTask);

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'billing_tasks',
        Buffer.from(JSON.stringify(mockTask)),
        { persistent: true }
      );
    });

    it('should publish delayed task to retry queue', async () => {
      await taskQueue.publishTask(mockTask, 5000);

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'billing_retry',
        Buffer.from(JSON.stringify(mockTask)),
        { messageTtl: 5000, persistent: true }
      );
    });
  });

  describe('consumeTasks', () => {
    it('should setup consumer for main queue', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await taskQueue.consumeTasks(handler);

      expect(mockChannel.consume).toHaveBeenCalledWith('billing_tasks', expect.any(Function));
    });

    it('should acknowledge successful task processing', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await taskQueue.consumeTasks(handler);

      // Get the consume callback
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      const mockMsg = {
        content: Buffer.from(JSON.stringify(mockTask))
      };

      await consumeCallback(mockMsg);

      // Parse the task back and compare (since JSON.stringify converts Date to string)
      const expectedTask = JSON.parse(JSON.stringify(mockTask));
      expect(handler).toHaveBeenCalledWith(expectedTask);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    });

    it('should nack failed task processing', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Processing failed'));
      await taskQueue.consumeTasks(handler);

      // Get the consume callback
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      const mockMsg = {
        content: Buffer.from(JSON.stringify(mockTask))
      };

      await consumeCallback(mockMsg);

      // Parse the task back and compare (since JSON.stringify converts Date to string)
      const expectedTask = JSON.parse(JSON.stringify(mockTask));
      expect(handler).toHaveBeenCalledWith(expectedTask);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    });
  });

  describe('acknowledgeTask and rejectTask', () => {
    it('should be no-op methods for interface compliance', async () => {
      await expect(taskQueue.acknowledgeTask('task-123')).resolves.toBeUndefined();
      await expect(taskQueue.rejectTask('task-123', true)).resolves.toBeUndefined();
    });
  });

  describe('connection management', () => {
    it('should setup queues and exchanges on init', async () => {
      expect(amqp.connect).toHaveBeenCalled();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('billing_dlx', 'direct', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2); // main queue and retry queue
      expect(mockChannel.bindQueue).toHaveBeenCalled();
    });

    it('should cleanup on destroy', async () => {
      await taskQueue.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });
});