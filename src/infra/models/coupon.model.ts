import { IBaseModel } from './base-model.interface';

export interface ICouponModel extends IBaseModel {
  code: string;
  discountPercentage: number;
  usedBy: string[];
}
