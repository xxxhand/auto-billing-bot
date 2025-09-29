import { BaseEntity } from './base-entity.abstract';

export type ProductCycleType = 'monthly' | 'yearly';

export class Product extends BaseEntity {
  public name: string = '';
  public cycleType: ProductCycleType = 'monthly';
  public price: number = 0;
  public discountPercentage?: number;
}
