import { IBaseModel } from './base-model.interface';

export interface IOperationLogModel extends IBaseModel {
  subscriptionId: string;
  action: string;
}
