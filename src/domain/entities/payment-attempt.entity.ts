export enum RetryableFailureReason {
  NETWORK_ERROR = 'NETWORK_ERROR',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  TEMPORARY_FAILURE = 'TEMPORARY_FAILURE',
}

export class PaymentAttempt {
  constructor(
    public attemptId: string,
    public subscriptionId: string,
    public status: string,
    public failureReason: string | null,
    public retryCount: number,
  ) {}

  shouldRetry(): boolean {
    if (this.status !== 'failed') {
      return false;
    }

    if (this.retryCount >= 3) {
      return false;
    }

    // Check if failure reason is retryable
    const retryableReasons = Object.values(RetryableFailureReason) as string[];
    return this.failureReason ? retryableReasons.includes(this.failureReason) : false;
  }
}
