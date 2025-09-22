import { BaseEntity } from './base-entity.abstract';
import { BillingCycleType } from '../value-objects/billing-cycle.value-object';

export class Product extends BaseEntity {
  public name: string = '';
  public cycleType: BillingCycleType = 'monthly';
  public price: number = 0;

  constructor() {
    super();
  }

  /**
   * 驗證產品資料的有效性
   */
  public isValid(): boolean {
    return this.name.trim().length > 0 && (this.cycleType === 'monthly' || this.cycleType === 'yearly') && this.price >= 0;
  }
}
