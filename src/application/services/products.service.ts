import { Inject, Injectable } from '@nestjs/common';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { DiscountRepository } from '../../infra/repositories/discount.repository';
import { DiscountPriorityService } from '../../domain/services/discount-priority.service';
import { RulesEngineService } from '../../domain/services/rules-engine.service';
import { RulesRepository } from '../../infra/repositories/rules.repository';
import { ProductEntity } from '../../domain/entities/product.entity';
import { Discount } from '../../domain/entities/discount.entity';

export interface ProductWithDiscount {
  productId: string;
  name: string;
  originalPrice: number;
  discountedPrice: number;
  cycleType: string;
  applicableDiscounts: Discount[];
  appliedDiscount?: {
    type: string;
    value: number;
    promoCode?: string;
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly discountRepository: DiscountRepository,
    private readonly discountPriorityService: DiscountPriorityService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly rulesRepository: RulesRepository,
  ) {}

  /**
   * Get all available products for a user with real-time discount prices
   * Filters out products the user is already subscribed to
   */
  async getAvailableProducts(userId: string, promoCode?: string): Promise<ProductWithDiscount[]> {
    // Get all products
    const allProducts = await this.productRepository.findAll();

    // Get user's active subscriptions
    const userSubscriptions = await this.subscriptionRepository.findByUserId(userId);
    const subscribedProductIds = userSubscriptions.filter((sub) => sub.status === 'active').map((sub) => sub.productId);

    // Filter out already subscribed products
    const availableProducts = allProducts.filter((product) => !subscribedProductIds.includes(product.productId));

    // Calculate discounted prices for each product
    const productsWithDiscounts: ProductWithDiscount[] = [];

    for (const product of availableProducts) {
      const { discountedPrice, appliedDiscount } = await this.calculateDiscountedPriceAndDetails(product, userId, promoCode);
      const applicableDiscounts = await this.getApplicableDiscounts(product);

      productsWithDiscounts.push({
        productId: product.productId,
        name: product.name,
        originalPrice: product.price,
        discountedPrice,
        cycleType: product.cycleType,
        applicableDiscounts,
        appliedDiscount,
      });
    }

    return productsWithDiscounts;
  }

  private async calculateDiscountedPriceAndDetails(product: ProductEntity, userId: string, promoCode?: string): Promise<{ discountedPrice: number; appliedDiscount?: { type: string; value: number; promoCode?: string } }> {
    // First, check if this is a first-time subscription for the user
    const isFirstTimeSubscription = await this.isFirstTimeSubscription(userId);

    // Apply rules-based discounts first (highest priority)
    const discountRules = await this.rulesRepository.findByType('discount');
    const applicableRules = this.rulesEngineService.filterApplicableRules(discountRules, 'discount');

    const context = {
      userId,
      product: {
        productId: product.productId,
        name: product.name,
        price: product.price,
        cycleType: product.cycleType,
      },
      subscription: {
        isFirstTimeSubscription: isFirstTimeSubscription,
      },
      promoCode: promoCode ? {
        code: promoCode,
      } : undefined,
      currentDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD string
      originalPrice: product.price,
      discountedPrice: product.price,
    };

    const result = this.rulesEngineService.evaluateRules(applicableRules, context);

    if (result.success && result.totalDiscount > 0) {
      let finalPrice: number;
      let appliedDiscount: { type: string; value: number; promoCode?: string } | undefined;

      // Check if finalPrice was set directly (for fixed_price discounts)
      if (result.context.finalPrice !== undefined) {
        finalPrice = Math.max(0, result.context.finalPrice);

        // Extract applied discount details from the rule that was applied
        const appliedRuleId = result.appliedRules[0];
        if (appliedRuleId) {
          const appliedRule = discountRules.find(rule => rule.ruleId === appliedRuleId);
          if (appliedRule && appliedRule.actions.discount) {
            const discountAction = appliedRule.actions.discount as any;
            appliedDiscount = {
              type: discountAction.type,
              value: discountAction.value,
              promoCode: promoCode,
            };
          }
        }
      } else {
        // Otherwise use the calculated discount
        finalPrice = Math.max(0, product.price - result.totalDiscount);
      }

      return { discountedPrice: finalPrice, appliedDiscount };
    }

    // Get all applicable discounts for this product
    const applicableDiscounts = await this.getApplicableDiscounts(product);

    if (applicableDiscounts.length === 0) {
      return { discountedPrice: product.price };
    }

    // Use discount priority service to select the best discount
    const bestDiscount = this.discountPriorityService.selectBestDiscount(applicableDiscounts, product.price);

    if (!bestDiscount) {
      return { discountedPrice: product.price };
    }

    return {
      discountedPrice: bestDiscount.calculateDiscountedPrice(product.price),
      appliedDiscount: {
        type: bestDiscount.type,
        value: bestDiscount.value,
      }
    };
  }

  /**
   * Check if this is a first-time subscription for the user
   * @param userId The user ID to check
   * @returns true if the user has no active subscriptions, false otherwise
   */
  private async isFirstTimeSubscription(userId: string): Promise<boolean> {
    const userSubscriptions = await this.subscriptionRepository.findByUserId(userId);
    const activeSubscriptions = userSubscriptions.filter((sub) => sub.status === 'active');
    return activeSubscriptions.length === 0;
  }

  private async getApplicableDiscounts(product: ProductEntity): Promise<Discount[]> {
    // Get all applicable discounts for this product
    return await this.discountRepository.findApplicableDiscounts(product.productId);
  }
}
