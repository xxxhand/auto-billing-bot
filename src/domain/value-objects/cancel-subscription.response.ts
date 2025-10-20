/**
 * Response object for subscription cancellation
 */
export class CancelSubscriptionResponse {
  constructor(
    public readonly subscriptionId: string,
    public readonly cancelledAt: Date,
    public readonly refundAmount: number,
    public readonly refundId?: string,
  ) {}
}
