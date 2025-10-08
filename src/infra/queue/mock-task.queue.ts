import { Injectable } from '@nestjs/common';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';

/**
 * Mock task queue implementation for testing and development
 * Simulates task queuing behavior using in-memory storage
 */
@Injectable()
export class MockTaskQueue implements ITaskQueue {
  private tasks: BillingTask[] = [];
  private handlers: ((task: BillingTask) => Promise<void>)[] = [];
  private acknowledgedTasks: Set<string> = new Set();
  private rejectedTasks: Set<string> = new Set();
  private allPublishedTasks: BillingTask[] = []; // Track all published tasks

  /**
   * Get the queue name
   */
  getQueueName(): string {
    return 'mock';
  }

  /**
   * Publish a task to the queue
   * @param task Task to publish
   * @param delayMs Optional delay in milliseconds
   */
  async publishTask(task: BillingTask, delayMs?: number): Promise<void> {
    this.allPublishedTasks.push(task);

    if (delayMs && delayMs > 0) {
      // For mock implementation, we ignore delay and publish immediately
      setTimeout(() => {
        this.tasks.push(task);
      }, delayMs);
    } else {
      this.tasks.push(task);
    }
  }

  /**
   * Start consuming tasks from the queue
   * @param handler Function to process each task
   */
  async consumeTasks(handler: (task: BillingTask) => Promise<void>): Promise<void> {
    this.handlers.push(handler);
    // Process all current tasks
    await this.processAllTasks();
  }

  /**
   * Process all tasks currently in the queue
   */
  private async processAllTasks(): Promise<void> {
    // Only process tasks that exist at the time of calling
    const tasksToProcess = [...this.tasks];
    this.tasks.length = 0; // Clear the queue

    for (const task of tasksToProcess) {
      if (this.handlers.length > 0) {
        const handler = this.handlers[0];
        try {
          await handler(task);
        } catch (error) {
          console.error('Task processing failed:', error);
        }
      }
    }
  }

  /**
   * Acknowledge successful task processing
   * @param taskId Task ID to acknowledge
   */
  async acknowledgeTask(taskId: string): Promise<void> {
    this.acknowledgedTasks.add(taskId);
  }

  /**
   * Reject a task
   * @param taskId Task ID to reject
   * @param requeue Whether to requeue the task
   */
  async rejectTask(taskId: string, requeue: boolean): Promise<void> {
    this.rejectedTasks.add(taskId);

    if (requeue) {
      // Find the task in all published tasks to get its data
      const originalTask = this.allPublishedTasks.find(t => t.taskId === taskId);
      if (originalTask) {
        // Create a new task with incremented retry count
        const retryTask: BillingTask = {
          ...originalTask,
          taskId: `${originalTask.taskId}_retry_${Date.now()}`,
          retryCount: originalTask.retryCount + 1,
          createdAt: new Date()
        };

        // Track the retry task as published and add to queue
        this.allPublishedTasks.push(retryTask);
        this.tasks.push(retryTask);
      }
    }
  }

  /**
   * Get all published tasks (for testing purposes)
   */
  getPublishedTasks(): BillingTask[] {
    return [...this.allPublishedTasks];
  }

  /**
   * Get acknowledged task IDs (for testing purposes)
   */
  getAcknowledgedTasks(): string[] {
    return Array.from(this.acknowledgedTasks);
  }

  /**
   * Get rejected task IDs (for testing purposes)
   */
  getRejectedTasks(): string[] {
    return Array.from(this.rejectedTasks);
  }

  /**
   * Clear all tasks and state (for testing purposes)
   */
  clear(): void {
    this.tasks = [];
    this.allPublishedTasks = [];
    this.handlers = [];
    this.acknowledgedTasks.clear();
    this.rejectedTasks.clear();
  }
}