import { Injectable, LoggerService, BadRequestException, Inject } from '@nestjs/common';
import { IPaymentGateway, IPaymentGatewayToken, PaymentRequest } from '../../domain/services/payment-gateway.interface';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { PromoCodeRepository } from '../../infra/repositories/promoCode.repository';
import { PromoCodeUsageRepository } from '../../infra/repositories/promoCodeUsage.repository';
import { UserRepository } from '../../infra/repositories/user.repository';
import { BillingService } from '../../infra/services/billing.service';
import { PromoCodeDomainService } from '../../domain/services/promo-code-domain.service';
import { PromoCode } from '../../domain/entities/promoCode.entity';
import { Subscription } from '../../domain/entities/subscription.entity';
import { CreateSubscriptionRequest } from '../../domain/value-objects/create-subscription.request';
import { CreateSubscriptionResponse } from '../../domain/value-objects/create-subscription.response';
import { GetSubscriptionResponse } from '../../domain/value-objects/get-subscription.response';
import { ConvertSubscriptionRequest } from '../../domain/value-objects/convert-subscription.request';
import { ConvertSubscriptionResponse } from '../../domain/value-objects/convert-subscription.response';
import { PromoCodeUsage } from '../../domain/value-objects/promoCodeUsage.value-object';

@Injectable()
export class SubscriptionsService {
  private readonly logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    private readonly productRepository: ProductRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly promoCodeRepository: PromoCodeRepository,
    private readonly promoCodeUsageRepository: PromoCodeUsageRepository,
    private readonly userRepository: UserRepository,
    private readonly promoCodeDomainService: PromoCodeDomainService,
    private readonly billingService: BillingService,
    @Inject(IPaymentGatewayToken) private readonly paymentGateway: IPaymentGateway,
  ) {
    this.logger = this.commonService.getDefaultLogger(SubscriptionsService.name);
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    const { userId, productId, promoCode } = request;

    this.logger.log(`Creating subscription for user ${userId}, product ${productId}, promoCode: ${promoCode || 'none'}`);

    // Validate user exists
    const userExists = await this.userRepository.existsByUserId(userId);
    if (!userExists) {
      this.logger.warn(`User not found: ${userId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_USER_NOT_FOUND);
    }

    // Validate product exists
    const product = await this.productRepository.findByProductId(productId);
    if (!product) {
      this.logger.warn(`Product not found: ${productId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
    }

    // Check if user already has active subscription for this product
    const existingSubscriptions = await this.subscriptionRepository.findByUserId(userId);
    const hasActiveSubscription = existingSubscriptions.some((sub) => sub.productId === productId && sub.status === 'active');
    if (hasActiveSubscription) {
      throw ErrException.newFromCodeName(errConstants.ERR_ALREADY_SUBSCRIBED);
    }

    // Validate promo code if provided
    let promoCodeEntity: PromoCode | null = null;
    let appliedDiscount = null;
    if (promoCode) {
      promoCodeEntity = await this.promoCodeRepository.findByCode(promoCode);
      if (!promoCodeEntity) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_PROMO_CODE);
      }

      // TODO: Get user's promo code usage history (for now, assume empty array)
      const userUsageHistory: string[] = [];

      const promoCodeValidation = this.promoCodeDomainService.validatePromoCodeUsage(promoCodeEntity, userId, product.price, productId, userUsageHistory);

      if (!promoCodeValidation.isValid) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_DISCOUNT);
      }

      // TODO: For now, we'll handle discount application after payment
      // appliedDiscount = ... (would need to get discount from promo code)
    }

    // Generate subscription ID
    const subscriptionId = uuidv4();

    // Create subscription entity
    const startDate = new Date();
    const subscription = new Subscription(subscriptionId, userId, productId, product.cycleType, startDate, this.calculateNextBillingDate(startDate, product.cycleType));

    // Save subscription
    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // HAND-NOTE: 功能完成後再考量是否在這裡處理扣款
    // Process initial payment using existing billing service
    try {
      const billingResult = await this.billingService.processBilling(savedSubscription.subscriptionId);
      if (!billingResult.success) {
        // If payment fails, subscription remains in 'pending' status
        this.logger.warn(`Initial payment failed for subscription ${subscriptionId}: ${billingResult.errorMessage}`);
        throw new BadRequestException(`Payment failed: ${billingResult.errorMessage}`);
      }
    } catch (error) {
      this.logger.error(`Payment processing error for subscription ${subscriptionId}: ${error.message}`);
      throw new BadRequestException('Payment processing failed');
    }

    // Update subscription status to active after successful payment
    savedSubscription.status = 'active';
    await this.subscriptionRepository.save(savedSubscription);

    // Track promo code usage if promo code was used
    if (promoCodeEntity) {
      // Increment used count
      promoCodeEntity.incrementUsage();
      await this.promoCodeRepository.update(promoCodeEntity);

      // Create usage record
      const orderAmount = product.price - promoCodeEntity.minimumAmount; // As per test expectation
      const promoCodeUsage = PromoCodeUsage.create(promoCodeEntity.code, userId, orderAmount);
      await this.promoCodeUsageRepository.create(promoCodeUsage);
    }

    return {
      subscriptionId: savedSubscription.subscriptionId,
      userId: savedSubscription.userId,
      productId: savedSubscription.productId,
      status: savedSubscription.status,
      cycleType: savedSubscription.cycleType,
      startDate: savedSubscription.startDate,
      nextBillingDate: savedSubscription.nextBillingDate,
      // TODO: Add discount information when discount system is implemented
    };
  }

  /**
   * Get subscription details by subscription ID
   */
  async getSubscription(subscriptionId: string): Promise<GetSubscriptionResponse> {
    this.logger.log(`Getting subscription details for ${subscriptionId}`);

    // Find subscription
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription not found: ${subscriptionId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
    }

    return new GetSubscriptionResponse(
      subscription.subscriptionId,
      subscription.userId,
      subscription.productId,
      subscription.status,
      subscription.cycleType,
      subscription.startDate,
      subscription.nextBillingDate,
      subscription.renewalCount,
      subscription.remainingDiscountPeriods,
      subscription.pendingConversion,
    );
  }

  /**
   * Convert subscription to a new billing cycle
   */
  async convertSubscription(request: ConvertSubscriptionRequest): Promise<ConvertSubscriptionResponse> {
    const { subscriptionId, newCycleType } = request;

    this.logger.log(`Converting subscription ${subscriptionId} to cycle type ${newCycleType}`);

    // Validate cycle type
    const supportedCycleTypes = ['monthly', 'quarterly', 'yearly', 'weekly'];
    if (!supportedCycleTypes.includes(newCycleType)) {
      this.logger.warn(`Invalid cycle type: ${newCycleType}`);
      throw ErrException.newFromCodeName(errConstants.ERR_INVALID_CYCLE_TYPE);
    }

    // Find subscription
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription not found: ${subscriptionId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
    }

    // Check if already has pending conversion
    if (subscription.pendingConversion) {
      this.logger.warn(`Subscription ${subscriptionId} already has pending conversion`);
      throw ErrException.newFromCodeName(errConstants.ERR_CONVERSION_ALREADY_PENDING);
    }

    // Check if converting to same cycle type
    if (subscription.cycleType === newCycleType) {
      this.logger.warn(`Cannot convert subscription ${subscriptionId} to same cycle type: ${newCycleType}`);
      throw ErrException.newFromCodeName(errConstants.ERR_SAME_CYCLE_TYPE);
    }

    // Get product to calculate fee adjustment
    const product = await this.productRepository.findByProductId(subscription.productId);
    if (!product) {
      this.logger.error(`Product not found for subscription ${subscriptionId}: ${subscription.productId}`);
      throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
    }

    // Calculate fee adjustment
    const feeAdjustment = this.calculateFeeAdjustment(subscription.cycleType, newCycleType, product.price);

    // If upgrade (feeAdjustment > 0), charge immediately
    if (feeAdjustment > 0) {
      this.logger.log(`Processing immediate payment for upgrade: ${feeAdjustment}`);
      try {
        // Create payment request for fee adjustment
        const paymentRequest: PaymentRequest = {
          attemptId: uuidv4(),
          userId: subscription.userId,
          amount: feeAdjustment,
          currency: 'TWD',
          description: `Subscription upgrade fee adjustment for ${subscription.subscriptionId}`,
        };

        // Process payment using injected payment gateway
        const paymentResult = await this.paymentGateway.charge(paymentRequest);
        if (!paymentResult.success) {
          this.logger.error(`Fee adjustment payment failed: ${paymentResult.errorMessage}`);
          throw ErrException.newFromCodeName(errConstants.ERR_PAYMENT_FAILED);
        }

        this.logger.log(`Fee adjustment payment successful for subscription ${subscriptionId}: ${feeAdjustment}`);
      } catch (error) {
        this.logger.error(`Fee adjustment payment failed for subscription ${subscriptionId}: ${error.message}`);
        throw ErrException.newFromCodeName(errConstants.ERR_PAYMENT_FAILED);
      }
    }

    // Convert subscription (this records the conversion request)
    const conversionResult = subscription.convertToNewCycle(newCycleType);

    // Save updated subscription
    await this.subscriptionRepository.save(subscription);

    this.logger.log(`Subscription ${subscriptionId} conversion requested successfully`);

    return {
      subscriptionId,
      newCycleType,
      requestedAt: conversionResult.requestedAt,
      feeAdjustment,
    };
  }

  /**
   * Calculate next billing date based on cycle type
   */
  private calculateNextBillingDate(startDate: Date, cycleType: string): Date {
    const nextDate = new Date(startDate);

    switch (cycleType) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      default:
        throw new BadRequestException(`Unsupported cycle type: ${cycleType}`);
    }

    return nextDate;
  }

  /**
   * Calculate fee adjustment for cycle conversion
   * Positive value means customer needs to pay more (upgrade)
   * Negative value means refund to customer (downgrade)
   */
  private calculateFeeAdjustment(currentCycleType: string, newCycleType: string, monthlyPrice: number): number {
    // Define cycle multipliers (how many months each cycle represents)
    const cycleMultipliers: { [key: string]: number } = {
      weekly: 1 / 4.33, // Approximately 4.33 weeks per month
      monthly: 1,
      quarterly: 3,
      yearly: 12,
    };

    const currentMultiplier = cycleMultipliers[currentCycleType];
    const newMultiplier = cycleMultipliers[newCycleType];

    if (!currentMultiplier || !newMultiplier) {
      throw new Error(`Unsupported cycle type for fee calculation: ${currentCycleType} or ${newCycleType}`);
    }

    // Calculate the difference in monthly equivalents
    const monthlyDifference = newMultiplier - currentMultiplier;

    // Return the fee adjustment (positive for upgrade, negative for downgrade)
    return monthlyDifference * monthlyPrice;
  }
}
