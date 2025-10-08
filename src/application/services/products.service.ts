import { Inject, Injectable } from '@nestjs/common';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { DiscountPriorityService } from '../../domain/services/discount-priority.service';
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
    private readonly discountPriorityService: DiscountPriorityService,
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
      const discountedPrice = await this.calculateDiscountedPrice(product);
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

  private async calculateDiscountedPrice(product: ProductEntity): Promise<number> {
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

  private async getApplicableDiscounts(product: ProductEntity): Promise<Discount[]> {
    // TODO: Implement discount retrieval logic
    // For now, return empty array - will be implemented when discount repository is available
    return [];
  }
}
