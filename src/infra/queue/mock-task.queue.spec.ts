import { Test, TestingModule } from '@nestjs/testing';
import { MockTaskQueue } from './mock-task.queue';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';

describe('MockTaskQueue', () => {
  let taskQueue: MockTaskQueue;

  const mockTask: BillingTask = {
    taskId: 'task-123',
    subscriptionId: 'sub-456',
    taskType: 'billing',
    retryCount: 0,
    createdAt: new Date(),
    metadata: { amount: 100 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockTaskQueue],
    }).compile();

    taskQueue = module.get<MockTaskQueue>(MockTaskQueue);
    taskQueue.clear(); // Clear state between tests
  });

  describe('getQueueName', () => {
    it('should return "mock"', () => {
      expect(taskQueue.getQueueName()).toBe('mock');
    });
  });

  describe('publishTask', () => {
    it('should publish task immediately', async () => {
      await taskQueue.publishTask(mockTask);

      const publishedTasks = taskQueue.getPublishedTasks();
      expect(publishedTasks).toHaveLength(1);
      expect(publishedTasks[0]).toEqual(mockTask);
    });

    it('should support delayed publishing parameter', async () => {
      // For mock implementation, we just verify the method accepts delay parameter
      await expect(taskQueue.publishTask(mockTask, 1000)).resolves.toBeUndefined();
      expect(taskQueue.getPublishedTasks()).toHaveLength(1);
    });
  });

  describe('consumeTasks', () => {
    it('should process published tasks', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await taskQueue.publishTask(mockTask);
      await taskQueue.consumeTasks(handler);

      expect(handler).toHaveBeenCalledWith(mockTask);
    });

    it('should process multiple tasks in order', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const task1 = { ...mockTask, taskId: 'task-1' };
      const task2 = { ...mockTask, taskId: 'task-2' };

      await taskQueue.publishTask(task1);
      await taskQueue.publishTask(task2);
      await taskQueue.consumeTasks(handler);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, task1);
      expect(handler).toHaveBeenNthCalledWith(2, task2);
    });

    it('should handle handler errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));

      await taskQueue.publishTask(mockTask);
      await taskQueue.consumeTasks(handler);

      expect(handler).toHaveBeenCalledWith(mockTask);
      expect(consoleSpy).toHaveBeenCalledWith('Task processing failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('acknowledgeTask', () => {
    it('should acknowledge task', async () => {
      await taskQueue.acknowledgeTask('task-123');

      const acknowledgedTasks = taskQueue.getAcknowledgedTasks();
      expect(acknowledgedTasks).toContain('task-123');
    });
  });

  describe('rejectTask', () => {
    it('should reject task without requeue', async () => {
      await taskQueue.rejectTask('task-123', false);

      const rejectedTasks = taskQueue.getRejectedTasks();
      expect(rejectedTasks).toContain('task-123');

      // Should not have requeued the task
      expect(taskQueue.getPublishedTasks()).toHaveLength(0);
    });

    it('should reject and requeue task', async () => {
      const handler = jest.fn().mockImplementation(async (task: BillingTask) => {
        // Reject the task and requeue it
        await taskQueue.rejectTask(task.taskId, true);
      });

      await taskQueue.publishTask(mockTask);
      await taskQueue.consumeTasks(handler);

      // Should have processed the original task
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(mockTask);

      // Should have rejected the original task
      const rejectedTasks = taskQueue.getRejectedTasks();
      expect(rejectedTasks).toContain('task-123');

      // Should have requeued the task with new ID and incremented retry count
      const publishedTasks = taskQueue.getPublishedTasks();
      expect(publishedTasks).toHaveLength(2); // original + retry
      expect(publishedTasks[1].taskId).not.toBe('task-123');
      expect(publishedTasks[1].taskId).toContain('task-123_retry_');
      expect(publishedTasks[1].retryCount).toBe(1);
    });
  });

  describe('integration test', () => {
    it('should handle task processing workflow', async () => {
      const handler = jest.fn().mockImplementation(async (task: BillingTask) => {
        if (task.taskType === 'billing') {
          await taskQueue.acknowledgeTask(task.taskId);
        }
      });

      await taskQueue.publishTask(mockTask);
      await taskQueue.consumeTasks(handler);

      // Should have processed the task
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(mockTask);

      // Should have acknowledged the task
      const acknowledgedTasks = taskQueue.getAcknowledgedTasks();
      expect(acknowledgedTasks).toContain('task-123');
    });

    it('should process multiple tasks sequentially', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const task1 = { ...mockTask, taskId: 'task-1' };
      const task2 = { ...mockTask, taskId: 'task-2' };

      await taskQueue.publishTask(task1);
      await taskQueue.publishTask(task2);
      await taskQueue.consumeTasks(handler);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, task1);
      expect(handler).toHaveBeenNthCalledWith(2, task2);
    });
  });
});
