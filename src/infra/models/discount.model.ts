import { IBaseModel } from './base-model.interface';

/**
 * Discount type enums as defined in the system design v0.7.1
 */
export type DiscountType = 'fixed' | 'percentage';

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
}
