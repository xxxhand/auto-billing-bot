import { Injectable } from '@nestjs/common';
import { Discount } from '../entities/discount.entity';

/**
 * Domain service for handling discount priority logic
 * Selects the best discount from multiple available discounts based on priority and discount amount
 */
@Injectable()
export class DiscountPriorityService {
  /**
   * Selects the best discount from a list of available discounts
   * Priority rules:
   * 1. Higher priority number takes precedence
   * 2. If priorities are equal, select the one with highest discount amount
   *
   * @param discounts Array of available discounts
   * @param originalPrice The original price before discount
   * @param productId Optional product ID to filter discounts applicable to the product
   * @returns The best discount to apply, or null if no discounts available
   */
  selectBestDiscount(discounts: Discount[], originalPrice: number, productId?: string): Discount | null {
    if (!discounts || discounts.length === 0) {
      return null;
    }

    // Filter out invalid discounts and those not applicable to the product
    const validDiscountsWithSavings = discounts
      .filter((discount) => discount && discount.isApplicable(new Date()))
      .filter((discount) => !productId || discount.isApplicableToProduct(productId)) // Filter by product applicability
      .map((discount) => ({
        discount,
        savings: this.calculateSavings(discount, originalPrice),
      }))
      .filter((item) => item.savings > 0); // Only consider discounts that actually save money

    if (validDiscountsWithSavings.length === 0) {
      return null;
    }

    // Sort by priority (descending), then by savings (descending)
    validDiscountsWithSavings.sort((a, b) => {
      // First compare by priority (higher priority first)
      if (a.discount.priority !== b.discount.priority) {
        return b.discount.priority - a.discount.priority;
      }
      // If priorities are equal, compare by savings (higher savings first)
      return b.savings - a.savings;
    });

    return validDiscountsWithSavings[0].discount;
  }

  /**
   * Calculate the savings amount for a discount
   * @param discount The discount to calculate savings for
   * @param originalPrice The original price
   * @returns The amount saved
   */
  private calculateSavings(discount: Discount, originalPrice: number): number {
    const discountedPrice = discount.calculateDiscountedPrice(originalPrice);
    return Math.max(0, originalPrice - discountedPrice);
  }

  /**
   * Filters discounts that are applicable to a specific product
   * @param discounts Array of discounts to filter
   * @param productId The product ID to check applicability for
   * @returns Array of discounts applicable to the product
   */
  filterApplicableDiscounts(discounts: Discount[], productId: string): Discount[] {
    if (!discounts || discounts.length === 0) {
      return [];
    }

    return discounts.filter((discount) => discount && discount.isApplicable(new Date()) && discount.isApplicableToProduct(productId));
  }

  /**
   * Gets all applicable discounts for a product, sorted by priority and savings
   * @param discounts Array of available discounts
   * @param productId The product ID to get applicable discounts for
   * @param originalPrice The original price (used for sorting by savings)
   * @returns Array of applicable discounts, sorted by priority and savings
   */
  getApplicableDiscounts(discounts: Discount[], productId: string, originalPrice: number): Discount[] {
    const applicableDiscounts = this.filterApplicableDiscounts(discounts, productId);

    // Sort by priority (descending), then by savings (descending)
    return applicableDiscounts
      .map((discount) => ({
        discount,
        savings: this.calculateSavings(discount, originalPrice),
      }))
      .sort((a, b) => {
        // First compare by priority (higher priority first)
        if (a.discount.priority !== b.discount.priority) {
          return b.discount.priority - a.discount.priority;
        }
        // If priorities are equal, compare by savings (higher savings first)
        return b.savings - a.savings;
      })
      .map((item) => item.discount);
  }
}
