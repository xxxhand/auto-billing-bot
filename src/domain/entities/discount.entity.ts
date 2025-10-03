import { BaseEntity } from './base-entity.abstract';

/**
 * Discount type enums as defined in the system design v0.7.1
 */
export type DiscountType = 'fixed' | 'percentage';

/**
 * Discount entity - represents a discount that can be applied to subscriptions
 */
export class Discount extends BaseEntity {
  public discountId: string;
  public type: DiscountType;
  public value: number;
  public priority: number;
  public startDate: Date;
  public endDate: Date;

  constructor(
    discountId: string,
    type: DiscountType,
    value: number,
    priority: number,
    startDate: Date,
    endDate: Date,
  ) {
    super();
    this.id = discountId; // Use discountId as the entity ID
    this.discountId = discountId;
    this.type = type;
    this.value = value;
    this.priority = priority;
    this.startDate = startDate;
    this.endDate = endDate;
  }

  /**
   * Check if the discount is applicable at the given date
   * @param now The current date to check against
   * @returns true if the discount is within its validity period
   */
  public isApplicable(now: Date): boolean {
    return now >= this.startDate && now <= this.endDate;
  }

  /**
   * Calculate the discounted price based on discount type
   * @param originalPrice The original price before discount
   * @returns The discounted price
   */
  public calculateDiscountedPrice(originalPrice: number): number {
    switch (this.type) {
      case 'percentage':
        return originalPrice * (1 - this.value / 100);
      case 'fixed':
        return Math.max(0, originalPrice - this.value);
      default:
        return originalPrice;
    }
  }
}