export interface CreateSubscriptionResponse {
  subscriptionId: string;
  userId: string;
  productId: string;
  status: string;
  cycleType: string;
  startDate: Date;
  nextBillingDate: Date;
  discountedPrice?: number;
  appliedDiscount?: {
    discountId: string;
    type: string;
    value: number;
  };
}
