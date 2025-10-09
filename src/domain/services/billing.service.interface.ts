/**
 * Billing service domain interfaces and types
 * Defines the contracts for billing operations in the domain layer
 */

/**
 * Billing result data structure
 */
export interface BillingResult {
  /** Whether the billing operation was successful */
  success: boolean;
  /** Transaction ID if payment succeeded */
  transactionId?: string;
  /** Error message if billing failed */
  errorMessage?: string;
  /** Error code for categorization */
  errorCode?: string;
  /** Whether the task was queued for retry */
  queuedForRetry?: boolean;
  /** Whether subscription entered grace period */
  enteredGracePeriod?: boolean;
}

/**
 * Billing service interface - domain service contract
 * Defines the contract for billing operations that coordinate payment processing and task queuing
 */
export interface IBillingService {
  /**
   * Process billing for a subscription
   * This is the main entry point for billing operations
   * @param subscriptionId The subscription to bill
   * @param isRetry Whether this is a retry attempt
   * @returns Promise resolving to billing result
   */
  processBilling(subscriptionId: string, isRetry?: boolean): Promise<BillingResult>;

  /**
   * Handle payment failure for a subscription
   * Determines retry strategy or grace period entry
   * @param subscriptionId The subscription that failed payment
   * @param failureReason The reason for payment failure
   * @param retryCount Current retry count
   * @returns Promise resolving to handling result
   */
  handlePaymentFailure(subscriptionId: string, failureReason: string, retryCount: number): Promise<BillingResult>;

  /**
   * Process a billing task from the queue
   * This method is called by the task consumer
   * @param taskId Unique task identifier
   * @param subscriptionId The subscription to bill
   * @param taskType Type of billing task
   * @param retryCount Current retry count
   * @returns Promise resolving to billing result
   */
  processBillingTask(taskId: string, subscriptionId: string, taskType: 'billing' | 'retry' | 'manual_retry', retryCount: number): Promise<BillingResult>;
}
