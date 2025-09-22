import { IBaseModel } from './base-model.interface';

export interface IUserModel extends IBaseModel {
  /** 使用者電子郵件 */
  email: string;
}
