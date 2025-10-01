import { IBaseModel } from './base-model.interface';

export type ProductCycleType = 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'fixedDays';

export interface IProductModel extends IBaseModel {
  /** Unique identifier of the product */
  productId: string;
  /** Human friendly product name */
  name: string;
  /** Base price of the product */
  price: number;
  /** Billing cycle type definition */
  cycleType: ProductCycleType;
  /** Specific cycle length in days (only used when cycleType is fixedDays) */
  cycleValue?: number | null;
  /** Grace period length in days; defaults to 7 when not provided */
  gracePeriodDays?: number;
}
