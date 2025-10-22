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
  async getAvailableProducts(userId: string): Promise<ProductWithDiscount[]> {
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
      const discountedPrice = await this.calculateDiscountedPrice(product, userId);
      const applicableDiscounts = await this.getApplicableDiscounts(product);

      productsWithDiscounts.push({
        productId: product.productId,
        name: product.name,
        originalPrice: product.price,
        discountedPrice,
        cycleType: product.cycleType,
        applicableDiscounts,
      });
    }

    return productsWithDiscounts;
  }

  private async calculateDiscountedPrice(product: ProductEntity, userId: string): Promise<number> {
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
      currentDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD string
      originalPrice: product.price,
      discountedPrice: product.price,
    };

    const result = this.rulesEngineService.evaluateRules(applicableRules, context);

    if (result.success && result.totalDiscount > 0) {
      return Math.max(0, product.price - result.totalDiscount);
    }

    // Get all applicable discounts for this product
    const applicableDiscounts = await this.getApplicableDiscounts(product);

    if (applicableDiscounts.length === 0) {
      return product.price;
    }

    // Use discount priority service to select the best discount
    const bestDiscount = this.discountPriorityService.selectBestDiscount(applicableDiscounts, product.price);

    if (!bestDiscount) {
      return product.price;
    }

    return bestDiscount.calculateDiscountedPrice(product.price);
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
