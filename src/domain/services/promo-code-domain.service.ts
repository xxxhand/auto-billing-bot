import { PromoCode } from '../entities/promoCode.entity';
import { Discount } from '../entities/discount.entity';

/**
 * Validation result for promo code usage
 */
export interface PromoCodeValidationResult {
  isValid: boolean;
  errorMessage?: string;
  discountAmount?: number;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
}

/**
 * Domain service for handling promo code business logic
 * Encapsulates complex business rules for promo code validation and usage
 */
export class PromoCodeDomainService {
  /**
   * Validate if a user can use a promo code for an order
   * Checks minimum amount, user usage history, and promo code availability
   * Returns discount calculation if valid
   *
   * @param promoCode The promo code to validate
   * @param discount The discount entity associated with the promo code
   * @param userId The user attempting to use the promo code
   * @param orderAmount The order amount
   * @param productIds The product IDs for the order
   * @param userUsageHistory Array of promo codes already used by this user
   * @returns Validation result with success status, error message, and discount details if applicable
   */
  public validatePromoCodeUsage(
    promoCode: PromoCode,
    discount: Discount,
    userId: string,
    orderAmount: number,
    productIds: string[],
    userUsageHistory: string[] = []
  ): PromoCodeValidationResult {
    // Check if promo code can be used at all
    if (!promoCode.canBeUsed()) {
      return {
        isValid: false,
        errorMessage: 'This promo code is no longer available',
      };
    }

    // Check if user can use this promo code (assigned user check)
    if (!promoCode.canBeUsedByUser(userId)) {
      return {
        isValid: false,
        errorMessage: 'This promo code is not available for your account',
      };
    }

    // Check product applicability
    const hasApplicableProduct = productIds.some(productId => discount.isApplicableToProduct(productId));
    if (!hasApplicableProduct) {
      return {
        isValid: false,
        errorMessage: 'This promo code is not applicable to the selected products',
      };
    }

    // HAND-NOTE: 是否要有這個檢查，折扣金額大於訂單金額就不能用?
    // Check minimum order amount
    if (!this.isOrderAmountValid(promoCode, orderAmount)) {
      return {
        isValid: false,
        errorMessage: `Order amount must be at least ${promoCode.minimumAmount} to use this promo code`,
      };
    }

    // Check user usage restrictions
    if (!this.canUserUsePromoCode(promoCode, userUsageHistory)) {
      return {
        isValid: false,
        errorMessage: 'This promo code has already been used by this user',
      };
    }

    // Calculate discount amount
    const originalPrice = orderAmount;
    const discountedPrice = discount.calculateDiscountedPrice(originalPrice);
    const discountAmount = originalPrice - discountedPrice;

    return {
      isValid: true,
      discountAmount,
      discountType: discount.type,
      discountValue: discount.value,
    };
  }

  /**
   * Check if a user can use a specific promo code based on their usage history
   * Handles both single-use and shared promo codes
   *
   * @param promoCode The promo code to check
   * @param userUsageHistory Array of promo codes already used by this user
   * @returns true if the user can use this promo code, false otherwise
   */
  public canUserUsePromoCode(promoCode: PromoCode, userUsageHistory: string[]): boolean {
    // If promo code is exhausted, no one can use it
    if (promoCode.isExhausted()) {
      return false;
    }

    // Check if user has already used this promo code
    // This applies to both single-use and shared promo codes
    // Single-use: user can only use once
    // Shared: user can only use once per promo code (scenario 2 logic)
    return !userUsageHistory.includes(promoCode.code);
  }

  /**
   * Check if the order amount meets the promo code's minimum requirement
   *
   * @param promoCode The promo code with minimum amount requirement
   * @param orderAmount The order amount to check
   * @returns true if order amount is valid, false otherwise
   */
  public isOrderAmountValid(promoCode: PromoCode, orderAmount: number): boolean {
    return orderAmount >= promoCode.minimumAmount;
  }
}
