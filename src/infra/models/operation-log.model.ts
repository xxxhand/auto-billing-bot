import { IBaseModel } from './base-model.interface';

export interface IOperationLogModel extends IBaseModel {
  /** 操作日誌ID */
  id: string;
  /** 訂閱ID */
  subscriptionId: string;
  /** 操作類型 */
  action: string;
}
