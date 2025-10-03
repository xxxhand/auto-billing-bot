import { BaseEntity } from './base-entity.abstract';
import { Discount } from './discount.entity';

/**
 * Subscription status enums as defined in the system design v0.7.1
 */
export type SubscriptionStatus = 'pending' | 'active' | 'grace' | 'cancelled' | 'refunding';

/**
 * Subscription aggregate root - the main entity controlling subscription lifecycle
 */
export class Subscription extends BaseEntity {
  public subscriptionId: string;
  public userId: string;
  public productId: string;
  public status: SubscriptionStatus;
  public cycleType: string;
  public startDate: Date;
  public nextBillingDate: Date;
  public renewalCount: number;
  public remainingDiscountPeriods: number;

  constructor(
    subscriptionId: string,
    userId: string,
    productId: string,
    cycleType: string,
    startDate: Date,
    nextBillingDate: Date,
    status: SubscriptionStatus = 'pending',
    renewalCount: number = 0,
    remainingDiscountPeriods: number = 0,
  ) {
    super();
    this.id = subscriptionId; // Use subscriptionId as the entity ID
    this.subscriptionId = subscriptionId;
    this.userId = userId;
    this.productId = productId;
    this.status = status;
    this.cycleType = cycleType;
    this.startDate = startDate;
    this.nextBillingDate = nextBillingDate;
    this.renewalCount = renewalCount;
    this.remainingDiscountPeriods = remainingDiscountPeriods;
  }

  /**
   * Calculate next billing date based on cycleType, handling leap years and month variations
   * @returns Date - The calculated next billing date
   */
  public calculateNextBillingDate(): Date {
    const currentBillingDate = new Date(this.nextBillingDate);

    switch (this.cycleType) {
      case 'monthly':
        // Check if original start date was end of month
        const originalStartDay = this.startDate.getDate();
        const originalMonthLastDay = new Date(
          this.startDate.getFullYear(),
          this.startDate.getMonth() + 1,
          0
        ).getDate();

        if (originalStartDay === originalMonthLastDay) {
          // End-of-month billing: calculate next month's last day
          const nextMonthYear = currentBillingDate.getFullYear();
          const nextMonthIndex = currentBillingDate.getMonth() + 1;

          // Handle year transition
          const actualYear = nextMonthIndex > 11 ? nextMonthYear + 1 : nextMonthYear;
          const actualMonth = nextMonthIndex > 11 ? 0 : nextMonthIndex;

          const nextMonthLastDay = new Date(actualYear, actualMonth + 1, 0).getDate();
          return new Date(actualYear, actualMonth, nextMonthLastDay);
        } else {
          // Regular billing: just add one month
          const nextMonth = new Date(currentBillingDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return nextMonth;
        }

      case 'quarterly':
        const nextQuarter = new Date(currentBillingDate);
        nextQuarter.setMonth(nextQuarter.getMonth() + 3);
        return nextQuarter;

      case 'yearly':
        const nextYear = new Date(currentBillingDate);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;

      case 'weekly':
        const nextWeek = new Date(currentBillingDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;

      case 'fixedDays':
        // For fixedDays, we assume the cycleValue is stored elsewhere
        // This would need to be enhanced when we have access to product cycleValue
        throw new Error('fixedDays cycleType requires cycleValue from product, not yet implemented');

      default:
        throw new Error(`Unsupported cycleType: ${this.cycleType}`);
    }
  }

  /**
   * Apply discount to calculate discounted price and optionally update remaining discount periods
   * @param discount The discount entity to apply
   * @param originalPrice The original price before discount
   * @param discountPeriods Optional: number of periods this discount applies to
   * @returns The discounted price
   */
  public applyDiscount(discount: Discount, originalPrice: number, discountPeriods?: number): number {
    if (discountPeriods !== undefined) {
      this.remainingDiscountPeriods = discountPeriods;
    }
    return discount.calculateDiscountedPrice(originalPrice);
  }
}