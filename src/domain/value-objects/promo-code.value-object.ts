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
  public readonly assignedUserId?: string;
  public readonly applicableProducts: string[];

  constructor(code: string, discountId: string, usageLimit: number | null = null, isSingleUse: boolean = false, usedCount: number = 0, minimumAmount: number = 0, assignedUserId?: string, applicableProducts: string[] = []) {
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
    this.assignedUserId = assignedUserId;
    this.applicableProducts = applicableProducts;
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
    return new PromoCode(this.code, this.discountId, this.usageLimit, this.isSingleUse, this.usedCount + 1, this.minimumAmount, this.assignedUserId, this.applicableProducts);
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

  /**
   * Check if the promo code is assigned to a specific user
   * @returns true if the promo code is assigned to a specific user, false otherwise
   */
  public isAssignedToUser(): boolean {
    return this.assignedUserId !== undefined && this.assignedUserId !== null;
  }

  /**
   * Check if the promo code can be used by a specific user
   * For assigned promo codes, only the assigned user can use it
   * @param userId The user ID to check
   * @returns true if the user can use this promo code, false otherwise
   */
  public canBeUsedByUser(userId: string): boolean {
    if (!this.isAssignedToUser()) {
      return true; // Not assigned, anyone can use
    }
    return this.assignedUserId === userId;
  }

  /**
   * Check if the promo code is applicable to a specific product
   * @param productId The product ID to check
   * @returns true if the promo code applies to the product (or is global)
   */
  public isApplicableToProduct(productId: string): boolean {
    // Empty applicableProducts means global applicable
    return this.applicableProducts.length === 0 || this.applicableProducts.includes(productId);
  }
}
