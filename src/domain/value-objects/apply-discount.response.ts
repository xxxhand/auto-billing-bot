export interface ApplyDiscountResponse {
  subscriptionId: string;
  discountId: string;
  originalPrice: number;
  discountedPrice: number;
  discountPeriods?: number;
  appliedAt: Date;
}