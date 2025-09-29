import { IBaseModel } from './base-model.interface';

export interface IProductModel extends IBaseModel {
  name: string;
  cycleType: 'monthly' | 'yearly';
  price: number;
  discountPercentage?: number;
}
