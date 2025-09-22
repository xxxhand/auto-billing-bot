import { IBaseModel } from './base-model.interface';

export interface IOperationLogModel extends IBaseModel {
  /** 訂閱ID */
  subscriptionId: string;
  /** 操作類型 */
  action: string;
}
