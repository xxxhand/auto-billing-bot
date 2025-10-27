import { Injectable } from '@nestjs/common';
import { PromoCodeRepository } from '../../infra/repositories/promoCode.repository';
import { PromoCodeUsageRepository } from '../../infra/repositories/promoCodeUsage.repository';
import { DiscountRepository } from '../../infra/repositories/discount.repository';
import { UserRepository } from '../../infra/repositories/user.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { PromoCodeDomainService } from '../../domain/services/promo-code-domain.service';
import { DiscountType } from '../../domain/entities/discount.entity';
import { PromoCodeUsage } from '../../domain/value-objects/promoCodeUsage.value-object';
import { ErrException, errConstants } from '@myapp/common';

export interface AvailablePromoCode {
  code: string;
  discountId: string;
  isSingleUse: boolean;
  remainingUses: number;
  minimumAmount: number;
  applicableProducts: string[];
}

export interface AppliedPromoCodeResult {
  code: string;
  discountId: string;
  discountType: DiscountType;
  discountValue: number;
  originalAmount: number;
  discountedAmount: number;
  savings: number;
}

export interface AppliedPromoCodeToSubscriptionResult {
  code: string;
  discountId: string;
  appliedToSubscription: true;
  subscriptionId: string;
  remainingDiscountPeriods: number;
  message: string;
}

/**
 * Application service for handling promo code operations
 */
@Injectable()
export class PromoCodeService {
  constructor(
    private readonly promoCodeRepository: PromoCodeRepository,
    private readonly promoCodeUsageRepository: PromoCodeUsageRepository,
    private readonly discountRepository: DiscountRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly promoCodeDomainService: PromoCodeDomainService,
  ) {}

  /**
   * Get available promo codes for a user
   * Filters promo codes based on user eligibility, usage history, and product applicability
   *
   * @param userId The user ID
   * @param productId Optional product ID to filter applicable promo codes
   * @returns List of available promo codes with details
   */
  public async getAvailablePromoCodesForUser(userId: string, productId?: string): Promise<AvailablePromoCode[]> {
    // Get all potentially applicable promo codes
    const applicablePromoCodes = await this.promoCodeRepository.findApplicablePromoCodes(userId, productId);

    // Get user's usage history
    const userUsageHistory = await this.promoCodeUsageRepository.findByUserId(userId);
    const usedPromoCodes = userUsageHistory.map(usage => usage.promoCode);

    // Filter promo codes that the user can actually use
    const availablePromoCodes: AvailablePromoCode[] = [];

    for (const promoCode of applicablePromoCodes) {
      // Check if user can use this promo code based on domain rules
      if (this.promoCodeDomainService.canUserUsePromoCode(promoCode, usedPromoCodes)) {
        // Calculate remaining uses
        const remainingUses = promoCode.usageLimit ? promoCode.usageLimit - promoCode.usedCount : Infinity;

        availablePromoCodes.push({
          code: promoCode.code,
          discountId: promoCode.discountId,
          isSingleUse: promoCode.isSingleUse,
          remainingUses: remainingUses === Infinity ? -1 : remainingUses, // -1 indicates unlimited
          minimumAmount: promoCode.minimumAmount,
          applicableProducts: promoCode.applicableProducts,
        });
      }
    }

    return availablePromoCodes;
  }

  /**
   * Apply a promo code to an order or subscription
   * Validates the promo code usage and applies it to the order if valid, or to a subscription for long-term use
   *
   * @param userId The user ID
   * @param promoCode The promo code to apply
   * @param orderDetails The order details including amount and products
   * @param applyToSubscription Whether to apply the discount to a subscription for long-term use
   * @param subscriptionId The subscription ID (required if applyToSubscription is true)
   * @returns The applied promo code result with discount details or subscription update info
   */
  public async applyPromoCode(
    userId: string,
    promoCode: string,
    orderDetails: { amount: number; products: string[] },
    applyToSubscription: boolean = false,
    subscriptionId?: string
  ): Promise<AppliedPromoCodeResult | AppliedPromoCodeToSubscriptionResult> {
    // Check if user exists
    const userExists = await this.userRepository.existsByUserId(userId);
    if (!userExists) {
      throw ErrException.newFromCodeName(errConstants.ERR_USER_NOT_FOUND);
    }

    // Validate order amount
    if (orderDetails.amount <= 0) {
      throw ErrException.newFromCodeName(errConstants.ERR_ORDER_AMOUNT_INVALID);
    }

    // Validate product IDs
    if (!orderDetails.products || orderDetails.products.length === 0) {
      throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_IDS_REQUIRED);
    }

    // Get the promo code entity
    const promoCodeEntity = await this.promoCodeRepository.findByCode(promoCode);
    if (!promoCodeEntity) {
      throw ErrException.newFromCodeName(errConstants.ERR_PROMO_CODE_NOT_FOUND);
    }

    // Get the discount entity
    const discountEntity = await this.discountRepository.findByDiscountId(promoCodeEntity.discountId);
    if (!discountEntity) {
      throw ErrException.newFromCodeName(errConstants.ERR_DISCOUNT_NOT_FOUND);
    }

    // Get user's usage history
    const userUsageHistory = await this.promoCodeUsageRepository.findByUserId(userId);
    const usedPromoCodes = userUsageHistory.map(usage => usage.promoCode);

    // Validate promo code usage using domain service
    // For subscription application, we allow re-using promo codes that were previously used for one-time discounts
    const effectiveUserUsageHistory = applyToSubscription ? [] : usedPromoCodes;
    const validationResult = this.promoCodeDomainService.validatePromoCodeUsage(
      promoCodeEntity,
      discountEntity,
      userId,
      orderDetails.amount,
      orderDetails.products,
      effectiveUserUsageHistory
    );

    if (!validationResult.isValid) {
      throw ErrException.newFromCodeName(errConstants.ERR_INVALID_DISCOUNT);
    }

    // Handle subscription application if requested
    if (applyToSubscription) {
      if (!subscriptionId) {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_ID_EMPTY);
      }

      // Validate subscription ownership
      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      if (subscription.userId !== userId) {
        throw ErrException.newFromCodeName(errConstants.ERR_USER_NOT_FOUND); // User doesn't own this subscription
      }

      // Check if subscription already has an applied discount
      if (subscription.appliedDiscountId && subscription.remainingDiscountPeriods > 0) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_DISCOUNT); // Already has active discount
      }

      // Apply discount to subscription
      const discountPeriods = discountEntity.discountPeriods || 3; // Use discount's discountPeriods or default to 3
      subscription.applyPromoCodeDiscount(discountEntity.discountId, discountPeriods);
      await this.subscriptionRepository.save(subscription);

      // Record the promo code usage
      const promoCodeUsage = PromoCodeUsage.create(promoCode, userId, orderDetails.amount);
      await this.promoCodeUsageRepository.create(promoCodeUsage);

      // Update promo code usage count
      await this.promoCodeRepository.incrementUsageCount(promoCodeEntity.code);

      return {
        code: promoCodeEntity.code,
        discountId: promoCodeEntity.discountId,
        appliedToSubscription: true,
        subscriptionId,
        remainingDiscountPeriods: discountPeriods,
        message: `優惠已應用至訂閱，將在接下來的${discountPeriods}個週期中生效`,
      };
    }

    // Record the promo code usage for one-time discount
    const promoCodeUsage = PromoCodeUsage.create(promoCode, userId, orderDetails.amount);
    await this.promoCodeUsageRepository.create(promoCodeUsage);

    // Update promo code usage count
    await this.promoCodeRepository.incrementUsageCount(promoCodeEntity.code);

    // Calculate final amounts for one-time discount
    const originalAmount = orderDetails.amount;
    const discountedAmount = originalAmount - (validationResult.discountAmount || 0);
    const savings = validationResult.discountAmount || 0;

    return {
      code: promoCodeEntity.code,
      discountId: promoCodeEntity.discountId,
      discountType: validationResult.discountType || 'fixed',
      discountValue: validationResult.discountValue || 0,
      originalAmount,
      discountedAmount,
      savings,
    };
  }
}