import type { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';

/**
 * Subscription status enums as defined in the system design v0.7.1
 */
export type SubscriptionStatus = 'pending' | 'active' | 'grace' | 'cancelled' | 'refunding' | 'aborted';

export interface ISubscriptionModel extends IBaseModel {
  /** Subscription unique identifier (PK) */
  subscriptionId: string;
  /** Related user id (FK) */
  userId: ObjectId;
  /** Related product id (FK) */
  productId: string;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Billing cycle type, consistent with product.cycleType */
  cycleType: string;
  /** Subscription start date */
  startDate: Date;
  /** Next billing date */
  nextBillingDate: Date;
  /** Renewal counter, default 0 */
  renewalCount: number;
  /** Remaining discount periods, default 0 */
  remainingDiscountPeriods: number;
  /** Applied discount ID for current discount periods */
  appliedDiscountId?: string | null;
  /** Promo code used for this subscription */
  promoCode?: string | null;
  /** Pending conversion request (contains newCycleType, requestedAt), effective next cycle */
  pendingConversion?: {
    newCycleType: string;
    requestedAt: Date;
  } | null;
  /** Grace period end date, set when entering grace status */
  gracePeriodEndDate?: Date | null;
}
