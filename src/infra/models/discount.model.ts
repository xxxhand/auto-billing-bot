import { IBaseModel } from './base-model.interface';

/**
 * Discount type enums as defined in the system design v0.7.1
 */
export type DiscountType = 'fixed' | 'percentage' | 'fixed_price';

export interface IDiscountModel extends IBaseModel {
  /** Discount unique identifier (PK) */
  discountId: string;
  /** Discount type */
  type: DiscountType;
  /** Discount value (amount or percentage) */
  value: number;
  /** Discount priority, higher number means higher priority */
  priority: number;
  /** Discount start date */
  startDate: Date;
  /** Discount end date */
  endDate: Date;
  /** Applicable product IDs, empty array means global applicable */
  applicableProducts: string[];
  /** Number of periods this discount applies to (for long-term discounts) */
  discountPeriods?: number;
  /** Number of extra service periods provided by this discount */
  extraPeriods?: number;
}
