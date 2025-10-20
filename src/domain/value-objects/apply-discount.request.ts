export interface ApplyDiscountRequest {
  subscriptionId: string;
  discountPeriods?: number; // Optional: number of periods this discount applies to
}