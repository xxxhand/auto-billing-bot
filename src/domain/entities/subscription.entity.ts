import { BaseEntity } from './base-entity.abstract';

export type SubscriptionStatus = 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled';

export class Subscription extends BaseEntity {
  public userId: string = '';
  public productId: string = '';
  public startDate: string = '';
  public nextBillingDate: string = '';
  public status: SubscriptionStatus = 'pending';
  public createdAt: string = '';
  public renewalCount: number = 0;
  public couponCode?: string;

  /**
   * 計算下次扣款日期
   * @param cycleType 週期類型
   * @returns 下次扣款日期的ISO字串
   */
  calculateNextBillingDate(cycleType: 'monthly' | 'yearly'): string {
    const currentDate = new Date(this.nextBillingDate);

    if (cycleType === 'monthly') {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(currentDate.getMonth() + 1);
      return nextMonth.toISOString();
    } else if (cycleType === 'yearly') {
      const nextYear = new Date(currentDate);
      nextYear.setFullYear(currentDate.getFullYear() + 1);
      return nextYear.toISOString();
    }

    throw new Error('Invalid cycle type');
  }

  /**
   * 啟用訂閱（從pending轉為active）
   */
  activate(): void {
    if (this.status !== 'pending') {
      throw new Error('Cannot activate subscription that is not pending');
    }
    this.status = 'active';
  }

  /**
   * 取消訂閱
   */
  cancel(): void {
    this.status = 'cancelled';
  }

  /**
   * 申請退款
   */
  requestRefund(): void {
    if (this.status !== 'active') {
      throw new Error('Cannot request refund for non-active subscription');
    }
    this.status = 'refunding';
  }

  /**
   * 方案轉換
   * @param newProductId 新產品ID
   * @param cycleType 新週期類型
   */
  switchPlan(newProductId: string, cycleType: 'monthly' | 'yearly'): void {
    this.productId = newProductId;
    this.nextBillingDate = this.calculateNextBillingDate(cycleType);
  }

  /**
   * 應用折扣
   * @param originalPrice 原始價格
   * @param renewalDiscount 續訂折扣百分比
   * @param couponDiscount 優惠券折扣百分比
   * @returns 折扣後價格
   */
  applyDiscount(originalPrice: number, renewalDiscount: number = 0, couponDiscount: number = 0): number {
    // 優惠券折扣優先級高於續訂折扣
    if (this.couponCode && couponDiscount > 0) {
      return originalPrice * (1 - couponDiscount);
    }

    // 續訂折扣（第二次及以後的續訂）
    if (this.renewalCount > 0 && renewalDiscount > 0) {
      return originalPrice * (1 - renewalDiscount);
    }

    return originalPrice;
  }
}
