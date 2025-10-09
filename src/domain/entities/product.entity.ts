import { BaseEntity } from './base-entity.abstract';
import { ProductCycleType } from '../../infra/models/product.model';

export class ProductEntity extends BaseEntity {
  public productId: string = '';
  public name: string = '';
  public price: number = 0;
  public cycleType: ProductCycleType = 'monthly';
  public cycleValue?: number | null;
  public gracePeriodDays: number = 7;
}
