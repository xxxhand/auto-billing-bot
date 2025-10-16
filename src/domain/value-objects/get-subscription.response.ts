/**
 * Response value object for getting subscription details
 */
export class GetSubscriptionResponse {
  public readonly subscriptionId: string;
  public readonly userId: string;
  public readonly productId: string;
  public readonly status: string;
  public readonly cycleType: string;
  public readonly startDate: string;
  public readonly nextBillingDate: string;
  public readonly renewalCount: number;
  public readonly remainingDiscountPeriods: number;
  public readonly pendingConversion: {
    newCycleType: string;
    requestedAt: string;
  } | null;

  constructor(
    subscriptionId: string,
    userId: string,
    productId: string,
    status: string,
    cycleType: string,
    startDate: Date,
    nextBillingDate: Date,
    renewalCount: number,
    remainingDiscountPeriods: number,
    pendingConversion: any,
  ) {
    this.subscriptionId = subscriptionId;
    this.userId = userId;
    this.productId = productId;
    this.status = status;
    this.cycleType = cycleType;
    this.startDate = startDate.toISOString();
    this.nextBillingDate = nextBillingDate.toISOString();
    this.renewalCount = renewalCount;
    this.remainingDiscountPeriods = remainingDiscountPeriods;
    this.pendingConversion = pendingConversion
      ? {
          newCycleType: pendingConversion.newCycleType,
          requestedAt: pendingConversion.requestedAt.toISOString(),
        }
      : null;
  }
}
