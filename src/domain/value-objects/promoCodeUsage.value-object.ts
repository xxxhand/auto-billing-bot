/**
 * Value object representing a promo code usage record
 * Immutable object that captures when and how a promo code was used
 */
export class PromoCodeUsage {
  public usageId: string;
  public promoCode: string;
  public userId: string;
  public usedAt: Date;
  public orderAmount: number;

  constructor(usageId: string, promoCode: string, userId: string, usedAt: Date, orderAmount: number) {
    this.usageId = usageId;
    this.promoCode = promoCode;
    this.userId = userId;
    this.usedAt = usedAt;
    this.orderAmount = orderAmount;
  }

  /**
   * Create a new promo code usage record
   */
  public static create(promoCode: string, userId: string, orderAmount: number): PromoCodeUsage {
    const { v4: uuidv4 } = require('uuid');
    return new PromoCodeUsage(uuidv4(), promoCode, userId, new Date(), orderAmount);
  }

  /**
   * Check if this usage record belongs to a specific user
   */
  public isUsedByUser(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Check if this usage record is for a specific promo code
   */
  public isForPromoCode(promoCode: string): boolean {
    return this.promoCode === promoCode;
  }
}
