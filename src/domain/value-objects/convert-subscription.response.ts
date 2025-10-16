export interface ConvertSubscriptionResponse {
  subscriptionId: string;
  newCycleType: string;
  requestedAt: Date;
  feeAdjustment: number;
}