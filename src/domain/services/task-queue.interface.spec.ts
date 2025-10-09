import { ITaskQueue, BillingTask } from './task-queue.interface';

describe('ITaskQueue Interface', () => {
  let taskQueue: ITaskQueue;

  const mockTask: BillingTask = {
    taskId: 'task-123',
    subscriptionId: 'sub-456',
    taskType: 'billing',
    retryCount: 0,
    createdAt: new Date(),
    metadata: { amount: 100 },
  };

  beforeEach(() => {
    // Mock implementation for interface testing
    taskQueue = {
      publishTask: jest.fn().mockResolvedValue(undefined),
      consumeTasks: jest.fn().mockResolvedValue(undefined),
      acknowledgeTask: jest.fn().mockResolvedValue(undefined),
      rejectTask: jest.fn().mockResolvedValue(undefined),
      getQueueName: jest.fn().mockReturnValue('mock'),
    };
  });

  describe('BillingTask structure', () => {
    it('should have required properties', () => {
      expect(mockTask.taskId).toBeDefined();
      expect(mockTask.subscriptionId).toBeDefined();
      expect(mockTask.taskType).toBeDefined();
      expect(mockTask.retryCount).toBeDefined();
      expect(mockTask.createdAt).toBeDefined();
    });

    it('should support optional metadata', () => {
      expect(mockTask.metadata).toBeDefined();
      expect(mockTask.metadata?.amount).toBe(100);
    });

    it('should support different task types', () => {
      const billingTask: BillingTask = { ...mockTask, taskType: 'billing' };
      const retryTask: BillingTask = { ...mockTask, taskType: 'retry' };
      const manualRetryTask: BillingTask = { ...mockTask, taskType: 'manual_retry' };

      expect(billingTask.taskType).toBe('billing');
      expect(retryTask.taskType).toBe('retry');
      expect(manualRetryTask.taskType).toBe('manual_retry');
    });
  });

  describe('ITaskQueue contract', () => {
    it('should define publishTask method', async () => {
      await expect(taskQueue.publishTask(mockTask)).resolves.toBeUndefined();
      expect(taskQueue.publishTask).toHaveBeenCalledWith(mockTask);
    });

    it('should support delayed task publishing', async () => {
      await expect(taskQueue.publishTask(mockTask, 5000)).resolves.toBeUndefined();
      expect(taskQueue.publishTask).toHaveBeenCalledWith(mockTask, 5000);
    });

    it('should define consumeTasks method', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await expect(taskQueue.consumeTasks(handler)).resolves.toBeUndefined();
      expect(taskQueue.consumeTasks).toHaveBeenCalledWith(handler);
    });

    it('should define acknowledgeTask method', async () => {
      await expect(taskQueue.acknowledgeTask('task-123')).resolves.toBeUndefined();
      expect(taskQueue.acknowledgeTask).toHaveBeenCalledWith('task-123');
    });

    it('should define rejectTask method', async () => {
      await expect(taskQueue.rejectTask('task-123', true)).resolves.toBeUndefined();
      expect(taskQueue.rejectTask).toHaveBeenCalledWith('task-123', true);
    });

    it('should define getQueueName method', () => {
      expect(taskQueue.getQueueName()).toBe('mock');
      expect(taskQueue.getQueueName).toHaveBeenCalled();
    });
  });
});
