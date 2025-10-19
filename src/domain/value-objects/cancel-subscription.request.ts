/**
 * Request object for cancelling a subscription
 */
export class CancelSubscriptionRequest {
  constructor(
    public readonly subscriptionId: string,
  ) {}
}