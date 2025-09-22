import { IBaseModel } from './base-model.interface';

export interface ISubscriptionModel extends IBaseModel {
  /** 使用者ID */
  userId: string;
  /** 產品ID */
  productId: string;
  /** 訂閱開始日（ISO 8601） */
  startDate: string;
  /** 下次扣款日（ISO 8601） */
  nextBillingDate: string;
  /** 訂閱狀態 */
  status: 'pending' | 'active' | 'cancelled';
}
