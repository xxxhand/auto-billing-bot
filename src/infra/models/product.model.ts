import { IBaseModel } from './base-model.interface';

export interface IProductModel extends IBaseModel {
  /** 產品ID */
  id: string;
  /** 產品名稱 */
  name: string;
  /** 週期類型 */
  cycleType: 'monthly' | 'yearly';
  /** 價格 */
  price: number;
}
