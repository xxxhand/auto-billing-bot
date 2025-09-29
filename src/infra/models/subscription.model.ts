import { IBaseModel } from './base-model.interface';

export interface ISubscriptionModel extends IBaseModel {
  userId: string;
  productId: string;
  startDate: string;
  nextBillingDate: string;
  status: 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled';
  renewalCount: number;
  couponCode?: string;
}
