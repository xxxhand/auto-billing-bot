/**
 * PromoCode value object - represents a promotional code for discounts
 * Immutable value object that encapsulates promotional code business rules
 */
export class PromoCode {
  public readonly code: string;
  public readonly discountId: string;
  public readonly usageLimit: number | null;
  public readonly isSingleUse: boolean;
  public readonly usedCount: number;
  public readonly minimumAmount: number;

  constructor(code: string, discountId: string, usageLimit: number | null = null, isSingleUse: boolean = false, usedCount: number = 0, minimumAmount: number = 0) {
    // Validation
    if (!code || code.trim().length === 0) {
      throw new Error('Promo code cannot be empty');
    }
    if (!discountId || discountId.trim().length === 0) {
      throw new Error('Discount ID cannot be empty');
    }
    if (usedCount < 0) {
      throw new Error('Used count cannot be negative');
    }
    if (usageLimit !== null && usageLimit <= 0) {
      throw new Error('Usage limit must be positive when specified');
    }
    if (minimumAmount < 0) {
      throw new Error('Minimum amount cannot be negative');
    }

    this.code = code.trim();
    this.discountId = discountId.trim();
    this.usageLimit = usageLimit;
    this.isSingleUse = isSingleUse;
    this.usedCount = usedCount;
    this.minimumAmount = minimumAmount;
  }

  /**
   * Check if this promo code can be used
   * Considers usage limits and single-use restrictions
   * @returns true if the promo code can be used, false otherwise
   */
  public canBeUsed(): boolean {
    // Check if single-use and already used
    if (this.isSingleUse && this.usedCount > 0) {
      return false;
    }

    // Check usage limit
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
      return false;
    }

    return true;
  }

  /**
   * Create a new PromoCode instance with incremented usage count
   * Used when the promo code is successfully applied
   * @returns A new PromoCode instance with usedCount + 1
   */
  public incrementUsage(): PromoCode {
    return new PromoCode(this.code, this.discountId, this.usageLimit, this.isSingleUse, this.usedCount + 1, this.minimumAmount);
  }

  /**
   * Check if the promo code is exhausted (cannot be used anymore)
   * @returns true if the promo code is exhausted, false otherwise
   */
  public isExhausted(): boolean {
    if (this.isSingleUse) {
      return this.usedCount > 0;
    }
    if (this.usageLimit !== null) {
      return this.usedCount >= this.usageLimit;
    }
    return false; // Unlimited use
  }
}
