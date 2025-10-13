import type { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';

export interface IPromoCodeUsageModel extends IBaseModel {
  /** Usage record unique identifier (PK) */
  usageId: string;
  /** Related promo code (FK) */
  promoCode: string;
  /** User who used the promo code */
  userId: ObjectId;
  /** When the promo code was used */
  usedAt: Date;
  /** Order amount when promo code was applied */
  orderAmount: number;
}
