import { BaseEntity } from './base-entity.abstract';
import { BillingCycle, BillingCycleType } from '../value-objects/billing-cycle.value-object';

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled';

export class Subscription extends BaseEntity {
  public userId: string = '';
  public productId: string = '';
  public startDate: string = ''; // ISO 8601
  public nextBillingDate: string = ''; // ISO 8601
  public status: SubscriptionStatus = 'pending';
  public createdAt: string = ''; // ISO 8601

  constructor() {
    super();
  }

  /**
   * 計算下次扣款日期
   * 根據產品週期處理大小月與閏年
   */
  public calculateNextBillingDate(cycleType: BillingCycleType): string {
    const billingCycle = new BillingCycle(cycleType);
    return billingCycle.calculateNextDate(this.startDate);
  }

  /**
   * 激活訂閱（首次扣款成功後）
   */
  public activate(): void {
    if (this.status === 'pending') {
      this.status = 'active';
    } else {
      throw new Error('只能從 pending 狀態激活訂閱');
    }
  }

  /**
   * 取消訂閱
   */
  public cancel(): void {
    if (this.status === 'pending' || this.status === 'active') {
      this.status = 'cancelled';
    } else {
      throw new Error('訂閱已經被取消');
    }
  }
}
