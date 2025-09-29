import { BaseEntity } from './base-entity.abstract';

export class Coupon extends BaseEntity {
  public code: string = '';
  public discountPercentage: number = 0;
  public usedBy: string[] = [];

  /**
   * 檢查用戶是否可以使用此優惠券
   * @param userId 用戶ID
   * @returns 是否有效
   */
  isValidForUser(userId: string): boolean {
    return !this.usedBy.includes(userId);
  }
}
