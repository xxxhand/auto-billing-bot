import { BaseEntity } from './base-entity.abstract';

/**
 * PromoCode entity - represents a promotional code that can be applied to subscriptions
 * This is a value object in the domain model
 */
export class PromoCode extends BaseEntity {
  public code: string;
  public discountId: string;
  public usageLimit: number | null;
  public isSingleUse: boolean;
  public usedCount: number;
  public minimumAmount: number;
  public assignedUserId?: string;
  public applicableProducts: string[];

  constructor(
    code: string,
    discountId: string,
    usageLimit: number | null,
    isSingleUse: boolean,
    usedCount: number,
    minimumAmount: number,
    assignedUserId?: string,
    applicableProducts: string[] = [],
  ) {
    super();
    this.id = code; // Use code as the entity ID
    this.code = code;
    this.discountId = discountId;
    this.usageLimit = usageLimit;
    this.isSingleUse = isSingleUse;
    this.usedCount = usedCount;
    this.minimumAmount = minimumAmount;
    this.assignedUserId = assignedUserId;
    this.applicableProducts = applicableProducts;
  }

  /**
   * Check if the promo code can be used (not exceeded usage limit)
   * @returns true if the promo code can still be used
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
   * Check if the promo code is applicable to a specific product
   * @param productId The product ID to check
   * @returns true if the promo code applies to the product (or is global)
   */
  public isApplicableToProduct(productId: string): boolean {
    // Empty applicableProducts means global applicable
    return this.applicableProducts.length === 0 || this.applicableProducts.includes(productId);
  }

  /**
   * Check if the promo code meets the minimum amount requirement
   * @param orderAmount The order amount to check
   * @returns true if the order amount meets the minimum requirement
   */
  public meetsMinimumAmount(orderAmount: number): boolean {
    return orderAmount >= this.minimumAmount;
  }

  /**
   * Check if the promo code is assigned to a specific user (exclusive)
   * @param userId The user ID to check
   * @returns true if the promo code is either global or assigned to the user
   */
  public isAssignedToUser(userId: string): boolean {
    return !this.assignedUserId || this.assignedUserId === userId;
  }

  /**
   * Check if the promo code is assigned to any specific user
   * @returns true if the promo code is assigned to a specific user, false otherwise
   */
  public isAssignedToAnyUser(): boolean {
    return this.assignedUserId !== undefined && this.assignedUserId !== null;
  }

  /**
   * Check if the promo code can be used by a specific user
   * For assigned promo codes, only the assigned user can use it
   * @param userId The user ID to check
   * @returns true if the user can use this promo code, false otherwise
   */
  public canBeUsedByUser(userId: string): boolean {
    if (!this.isAssignedToAnyUser()) {
      return true; // Not assigned, anyone can use
    }
    return this.assignedUserId === userId;
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
   * Increment the usage count (called when promo code is successfully used)
   */
  public incrementUsage(): void {
    this.usedCount += 1;
  }
}
