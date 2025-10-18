import { Test, TestingModule } from '@nestjs/testing';
import { CommonService } from '@myapp/common';
import { IBillingService, IBillingServiceToken } from '../domain/services/billing.service.interface';
import { ITaskQueue, BillingTask, ITaskQueueToken } from '../domain/services/task-queue.interface';
import { BillingConsumer } from './billing-consumer';

describe('BillingConsumer', () => {
  let consumer: BillingConsumer;
  let billingService: jest.Mocked<IBillingService>;
  let taskQueue: jest.Mocked<ITaskQueue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingConsumer,
        {
          provide: CommonService,
          useValue: {
            getDefaultLogger: jest.fn().mockReturnValue({
              log: jest.fn(),
              error: jest.fn(),
              warn: jest.fn(),
            }),
          },
        },
        {
          provide: IBillingServiceToken,
          useValue: {
            processBillingTask: jest.fn(),
          },
        },
        {
          provide: ITaskQueueToken,
          useValue: {
            consumeTasks: jest.fn(),
            getQueueName: jest.fn().mockReturnValue('test-queue'),
          },
        },
      ],
    }).compile();

    consumer = module.get<BillingConsumer>(BillingConsumer);
    billingService = module.get(IBillingServiceToken);
    taskQueue = module.get(ITaskQueueToken);
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should start consuming tasks on module init', async () => {
      taskQueue.consumeTasks.mockResolvedValue(undefined);

      await consumer.onModuleInit();

      expect(taskQueue.consumeTasks).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle billing task successfully', async () => {
      const mockTask: BillingTask = {
        taskId: 'task-123',
        subscriptionId: 'sub-123',
        taskType: 'billing',
        retryCount: 0,
        createdAt: new Date(),
      };

      billingService.processBillingTask.mockResolvedValue({
        success: true,
        transactionId: 'txn-123',
      });

      let capturedHandler: (task: any) => Promise<void>;
      taskQueue.consumeTasks.mockImplementation((handler) => {
        capturedHandler = handler;
        return Promise.resolve();
      });

      await consumer.onModuleInit();

      await capturedHandler!(mockTask);

      expect(billingService.processBillingTask).toHaveBeenCalledWith(
        'task-123',
        'sub-123',
        'billing',
        0
      );
    });

    it('should handle billing task failure', async () => {
      const mockTask: BillingTask = {
        taskId: 'task-123',
        subscriptionId: 'sub-123',
        taskType: 'retry',
        retryCount: 1,
        createdAt: new Date(),
      };

      billingService.processBillingTask.mockResolvedValue({
        success: false,
        errorMessage: 'Payment failed',
        errorCode: 'PAYMENT_ERROR',
        queuedForRetry: false,
      });

      let capturedHandler: (task: any) => Promise<void>;
      taskQueue.consumeTasks.mockImplementation((handler) => {
        capturedHandler = handler;
        return Promise.resolve();
      });

      await consumer.onModuleInit();

      await capturedHandler!(mockTask);

      expect(billingService.processBillingTask).toHaveBeenCalledWith(
        'task-123',
        'sub-123',
        'retry',
        1
      );
    });

    it('should handle task processing error', async () => {
      const mockTask: BillingTask = {
        taskId: 'task-123',
        subscriptionId: 'sub-123',
        taskType: 'billing',
        retryCount: 0,
        createdAt: new Date(),
      };

      billingService.processBillingTask.mockRejectedValue(new Error('Processing error'));

      let capturedHandler: (task: any) => Promise<void>;
      taskQueue.consumeTasks.mockImplementation((handler) => {
        capturedHandler = handler;
        return Promise.resolve();
      });

      await consumer.onModuleInit();

      await expect(capturedHandler!(mockTask)).rejects.toThrow('Processing error');
    });
  });
});