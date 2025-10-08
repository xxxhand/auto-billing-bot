/**
 * Task queue domain interfaces and types
 * Defines the contracts for task queuing in the domain layer
 */

export const ITaskQueueToken = 'ITaskQueue';

/**
 * Billing task data structure
 */
export interface BillingTask {
  /** Unique task ID */
  taskId: string;
  /** Subscription ID to process */
  subscriptionId: string;
  /** Task type (billing, retry, etc.) */
  taskType: 'billing' | 'retry' | 'manual_retry';
  /** Retry count */
  retryCount: number;
  /** Task creation timestamp */
  createdAt: Date;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Task queue interface - domain service contract
 * Defines the contract that all task queue implementations must follow
 */
export interface ITaskQueue {
  /**
   * Publish a task to the queue
   * @param task Task to publish
   * @param delayMs Optional delay in milliseconds
   */
  publishTask(task: BillingTask, delayMs?: number): Promise<void>;

  /**
   * Start consuming tasks from the queue
   * @param handler Function to process each task
   */
  consumeTasks(handler: (task: BillingTask) => Promise<void>): Promise<void>;

  /**
   * Acknowledge successful task processing
   * @param taskId Task ID to acknowledge
   */
  acknowledgeTask(taskId: string): Promise<void>;

  /**
   * Reject a task (will be retried based on queue configuration)
   * @param taskId Task ID to reject
   * @param requeue Whether to requeue the task
   */
  rejectTask(taskId: string, requeue: boolean): Promise<void>;

  /**
   * Get queue name/identifier
   */
  getQueueName(): string;
}