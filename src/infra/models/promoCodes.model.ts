import { IBaseModel } from './base-model.interface';

export interface IPromoCodeModel extends IBaseModel {
  /** Promo code (PK) */
  code: string;
  /** Related discount id (FK) */
  discountId: string;
  /** Total usage limit (null for unlimited) */
  usageLimit: number | null;
  /** Whether single use per user */
  isSingleUse: boolean;
  /** Number of times used */
  usedCount: number;
}
