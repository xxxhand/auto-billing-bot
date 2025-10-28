import { BaseEntity } from './base-entity.abstract';

/**
 * Discount type enums as defined in the system design v0.7.1
 */
export type DiscountType = 'fixed' | 'percentage' | 'fixed_price';

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
  public applicableProducts: string[];
  public discountPeriods: number;
  public extraPeriods: number;
  public valid: boolean = true;

  constructor(discountId: string, type: DiscountType, value: number, priority: number, startDate: Date, endDate: Date, applicableProducts: string[] = [], discountPeriods: number = 1, extraPeriods: number = 0) {
    super();
    this.id = discountId; // Use discountId as the entity ID
    this.discountId = discountId;
    this.type = type;
    this.value = value;
    this.priority = priority;
    this.startDate = startDate;
    this.endDate = endDate;
    this.applicableProducts = applicableProducts;
    this.discountPeriods = discountPeriods;
    this.extraPeriods = extraPeriods;
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
   * Check if the discount is applicable to a specific product
   * @param productId The product ID to check
   * @returns true if the discount applies to the product (or is global)
   */
  public isApplicableToProduct(productId: string): boolean {
    // Empty applicableProducts means global applicable
    return this.applicableProducts.length === 0 || this.applicableProducts.includes(productId);
  }

  /**
   * Calculate the discounted price based on discount type
   * @param originalPrice The original price before discount
   * @returns The discounted price
   */
  calculateDiscountedPrice(originalPrice: number): number {
    switch (this.type) {
      case 'percentage':
        return originalPrice * (1 - this.value / 100);
      case 'fixed':
        return Math.max(0, originalPrice - this.value);
      case 'fixed_price':
        return this.value;
      default:
        return originalPrice;
    }
  }

  /**
   * Check if the discount contains extra service periods
   * @returns true if the discount provides extra periods
   */
  public hasExtraPeriods(): boolean {
    return this.extraPeriods > 0;
  }

  /**
   * Get the number of extra service periods provided by this discount
   * @returns The number of extra periods
   */
  public getExtraPeriods(): number {
    return this.extraPeriods;
  }
}
