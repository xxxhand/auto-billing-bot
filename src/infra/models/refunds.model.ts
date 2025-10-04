import { IBaseModel } from './base-model.interface';

export type RefundStatus = 'pending' | 'completed' | 'failed';

export interface IRefundModel extends IBaseModel {
  /** Refund unique identifier (PK) */
  refundId: string;
  /** Related subscription id (FK) */
  subscriptionId: string;
  /** Refund amount */
  amount: number;
  /** Refund status */
  status: RefundStatus;
}
