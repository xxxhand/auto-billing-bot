import { PromoCode } from '../value-objects/promo-code.value-object';

/**
 * Validation result for promo code usage
 */
export interface PromoCodeValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Domain service for handling promo code business logic
 * Encapsulates complex business rules for promo code validation and usage
 */
export class PromoCodeDomainService {
  /**
   * Validate if a user can use a promo code for an order
   * Checks minimum amount, user usage history, and promo code availability
   *
   * @param promoCode The promo code to validate
   * @param userId The user attempting to use the promo code
   * @param orderAmount The order amount
   * @param userUsageHistory Array of promo codes already used by this user
   * @returns Validation result with success status and error message if applicable
   */
  public validatePromoCodeUsage(
    promoCode: PromoCode,
    userId: string,
    orderAmount: number,
    userUsageHistory: string[]
  ): PromoCodeValidationResult {
    // Check if promo code can be used at all
    if (!promoCode.canBeUsed()) {
      return {
        isValid: false,
        errorMessage: 'This promo code is no longer available'
      };
    }

    // Check if user can use this promo code (assigned user check)
    if (!promoCode.canBeUsedByUser(userId)) {
      return {
        isValid: false,
        errorMessage: 'This promo code is not available for your account'
      };
    }

    // Check minimum order amount
    if (!this.isOrderAmountValid(promoCode, orderAmount)) {
      return {
        isValid: false,
        errorMessage: `Order amount must be at least ${promoCode.minimumAmount} to use this promo code`
      };
    }

    // Check user usage restrictions
    if (!this.canUserUsePromoCode(promoCode, userUsageHistory)) {
      return {
        isValid: false,
        errorMessage: 'This promo code has already been used by this user'
      };
    }

    return { isValid: true };
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