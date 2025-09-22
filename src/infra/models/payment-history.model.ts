import { IBaseModel } from './base-model.interface';

export interface IPaymentHistoryModel extends IBaseModel {
  /** 訂閱ID */
  subscriptionId: string;
  /** 扣款金額 */
  amount: number;
  /** 支付狀態 */
  status: 'success' | 'failed';
  /** 失敗原因（可選） */
  failureReason?: string;
}
