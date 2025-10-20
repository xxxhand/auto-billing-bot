import { Inject, Injectable } from '@nestjs/common';
import { DiscountRepository } from '../../infra/repositories/discount.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { Discount } from '../../domain/entities/discount.entity';
import { ApplyDiscountRequest } from '../../domain/value-objects/apply-discount.request';
import { ApplyDiscountResponse } from '../../domain/value-objects/apply-discount.response';
import { CommonService, ErrException, errConstants } from '@myapp/common';

export interface DiscountResponse {
  discountId: string;
  type: string;
  value: number;
  priority: number;
  startDate: Date;
  endDate: Date;
  applicableProducts: string[];
}

@Injectable()
export class DiscountsService {
  private readonly logger: any;

  constructor(
    private readonly commonService: CommonService,
    private readonly discountRepository: DiscountRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly productRepository: ProductRepository,
  ) {
    this.logger = this.commonService.getDefaultLogger(DiscountsService.name);
  }

  /**
   * Get all applicable discounts
   * Returns discounts that are currently valid (within start/end date range)
   */
  async getApplicableDiscounts(): Promise<DiscountResponse[]> {
    const allDiscounts = await this.discountRepository.findAll();
    const now = new Date();

    // Filter discounts that are currently valid
    const applicableDiscounts = allDiscounts.filter(discount => discount.isApplicable(now));

    return applicableDiscounts.map((discount) => ({
      discountId: discount.discountId,
      type: discount.type,
      value: discount.value,
      priority: discount.priority,
      startDate: discount.startDate,
      endDate: discount.endDate,
      applicableProducts: discount.applicableProducts,
    }));
  }

  /**
   * Apply a discount to a subscription
   * @param discountId The ID of the discount to apply
   * @param request The apply discount request containing subscription details
   * @returns The result of applying the discount
   */
  async applyDiscountToSubscription(discountId: string, request: ApplyDiscountRequest): Promise<ApplyDiscountResponse> {
    this.logger.log(`Applying discount ${discountId} to subscription ${request.subscriptionId}`);

    // Get the discount
    const discount = await this.discountRepository.findByDiscountId(discountId);
    if (!discount) {
      this.logger.warn(`Discount not found: ${discountId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_DISCOUNT_NOT_FOUND);
    }

    // Get the subscription
    const subscription = await this.subscriptionRepository.findById(request.subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription not found: ${request.subscriptionId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
    }

    // Get the product to get the original price
    const product = await this.productRepository.findByProductId(subscription.productId);
    if (!product) {
      this.logger.warn(`Product not found: ${subscription.productId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
    }

    // Check if discount is applicable to the product
    if (!discount.isApplicableToProduct(product.productId)) {
      this.logger.warn(`Discount ${discountId} is not applicable to product ${product.productId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_DISCOUNT_NOT_APPLICABLE);
    }

    // Check if discount is currently valid
    if (!discount.isApplicable(new Date())) {
      this.logger.warn(`Discount ${discountId} is not currently valid`);
      throw ErrException.newFromCodeName(errConstants.ERR_DISCOUNT_EXPIRED);
    }

    // Apply the discount to the subscription
    const originalPrice = product.price;
    const discountedPrice = subscription.applyDiscount(discount, originalPrice, request.discountPeriods);

    // Save the updated subscription
    await this.subscriptionRepository.save(subscription);

    this.logger.log(`Discount ${discountId} successfully applied to subscription ${request.subscriptionId}`);

    return {
      subscriptionId: subscription.subscriptionId,
      discountId: discount.discountId,
      originalPrice,
      discountedPrice,
      discountPeriods: request.discountPeriods,
      appliedAt: new Date(),
    };
  }
}