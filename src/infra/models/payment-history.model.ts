import { IBaseModel } from './base-model.interface';

export interface IPaymentHistoryModel extends IBaseModel {
  subscriptionId: string;
  amount: number;
  status: 'success' | 'failed';
  failureReason?: string;
  retryCount: number;
  isManual: boolean;
  isAuto: boolean;
}
