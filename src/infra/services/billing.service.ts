import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { v4 as uuidv4 } from 'uuid';
import { IPaymentGateway, IPaymentGatewayToken, PaymentRequest, PaymentResponse } from '../../domain/services/payment-gateway.interface';
import { ITaskQueue, BillingTask, ITaskQueueToken } from '../../domain/services/task-queue.interface';
import { IBillingService, BillingResult } from '../../domain/services/billing.service.interface';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { ProductRepository } from '../repositories/product.repository';
import { DiscountRepository } from '../repositories/discount.repository';
import { RulesRepository } from '../repositories/rules.repository';
import { PromoCodeRepository } from '../repositories/promoCode.repository';
import { RulesEngineService, RuleEvaluationContext } from '../../domain/services/rules-engine.service';
import { Discount } from '../../domain/entities/discount.entity';
import { PaymentAttempt, PaymentAttemptStatus } from '../../domain/entities/payment-attempt.entity';

@Injectable()
export class BillingService implements IBillingService {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    @Inject(IPaymentGatewayToken) private readonly paymentGateway: IPaymentGateway,
    @Inject(ITaskQueueToken) private readonly taskQueue: ITaskQueue,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly paymentAttemptRepository: PaymentAttemptRepository,
    private readonly productRepository: ProductRepository,
    private readonly discountRepository: DiscountRepository,
    private readonly rulesRepository: RulesRepository,
    private readonly promoCodeRepository: PromoCodeRepository,
    private readonly rulesEngineService: RulesEngineService,
  ) {
    this._Logger = this.commonService.getDefaultLogger(BillingService.name);
  }

  /**
   * Process billing for a subscription
   */
  async processBilling(subscriptionId: string, isRetry = false, retryCount = 0): Promise<BillingResult> {
    this._Logger.log(`Processing billing for subscription ${subscriptionId}, isRetry: ${isRetry}`);

    // Find subscription
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      this._Logger.error(`Subscription ${subscriptionId} not found`);
      return {
        success: false,
        errorMessage: 'Subscription not found',
        errorCode: 'SUBSCRIPTION_NOT_FOUND',
      };
    }

    // Check subscription status - allow pending for initial billing, allow grace for retries
    if (subscription.status !== 'active' && subscription.status !== 'pending' && !(subscription.status === 'grace' && isRetry)) {
      this._Logger.log(`Subscription ${subscriptionId} is not active, pending, or in grace period for retry, status: ${subscription.status}`);
      // TODO: Record cancel log to billingLogs
      // await this.billingLogRepository.save({ eventType: 'billing_cancelled', subscriptionId, details: { reason: 'inactive_status' } });
      return {
        success: false,
        errorMessage: 'Subscription not active, pending, or in grace period for retry',
        errorCode: 'SUBSCRIPTION_NOT_ACTIVE',
      };
    }

    // Check and apply pending conversion if applicable
    if (subscription.pendingConversion) {
      this._Logger.log(`Applying pending conversion for subscription ${subscriptionId}`);
      subscription.applyPendingConversion();
      await this.subscriptionRepository.save(subscription);
    }

    // Find product to get price
    const product = await this.productRepository.findByProductId(subscription.productId);
    if (!product) {
      this._Logger.error(`Product ${subscription.productId} not found, aborting subscription ${subscriptionId}`);
      subscription.status = 'aborted';
      await this.subscriptionRepository.save(subscription);
      return {
        success: false,
        errorMessage: 'Product not found, subscription aborted',
        errorCode: 'PRODUCT_NOT_FOUND_ABORTED',
      };
    }

    // Calculate amount with discounts
    let amount = product.price;

    // 嚴重的邏輯錯誤，初始的renewalCount應該是-1，第一次扣款時才會變成0
    // Apply promo code discount for initial billing (renewalCount === -1)
    let appliedPromoCodeDiscount: Discount | null = null;
    if (subscription.renewalCount === -1 && subscription.promoCode) {
      const result = await this.calculatePromoCodeDiscount(product, subscription, amount);
      amount = result.amount;
      appliedPromoCodeDiscount = result.discount;
    }

    // Apply first-time subscription discount for initial billing (renewalCount === -1)
    // Skip rules engine discount if we have a fixed_price promo code (highest priority)
    if (subscription.renewalCount === -1 && (!appliedPromoCodeDiscount || appliedPromoCodeDiscount.type !== 'fixed_price')) {
      amount = await this.calculateFirstTimeSubscriptionDiscount(product, subscription, amount);
    }

    // Handle appliedDiscountId discount periods management (separate from rules engine)
    // This applies to both first-time and renewal subscriptions
    if (subscription.remainingDiscountPeriods > 0 && subscription.appliedDiscountId) {
      const appliedDiscount = await this.discountRepository.findByDiscountId(subscription.appliedDiscountId);
      if (appliedDiscount && appliedDiscount.isApplicable(new Date())) {
        // Apply applied discount - this takes precedence and is applied separately from rules engine
        amount = appliedDiscount.calculateDiscountedPrice(amount);
        subscription.remainingDiscountPeriods -= 1;

        // Clear applied discount if no periods remaining
        if (subscription.remainingDiscountPeriods <= 0) {
          subscription.appliedDiscountId = null;
        }

        await this.subscriptionRepository.save(subscription);
      } else {
        // Discount no longer valid, clear it
        subscription.appliedDiscountId = null;
        subscription.remainingDiscountPeriods = 0;
        await this.subscriptionRepository.save(subscription);
      }
    }

    // Apply renewal discount for second and subsequent renewals
    if (subscription.renewalCount >= 0) {
      amount = await this.calculateRenewalDiscount(product, subscription, amount);
    }

    // Create payment attempt
    const attemptId = uuidv4();
    const paymentAttempt = new PaymentAttempt(attemptId, subscriptionId, PaymentAttemptStatus.PENDING, '', retryCount, amount);

    await this.paymentAttemptRepository.save(paymentAttempt);

    // Create payment request
    const paymentRequest: PaymentRequest = {
      attemptId,
      userId: subscription.userId,
      amount,
      currency: 'TWD',
      description: `Subscription billing${isRetry ? ' retry' : ''} for ${subscription.subscriptionId}`,
    };

    try {
      // Process payment
      const paymentResponse: PaymentResponse = await this.paymentGateway.charge(paymentRequest);

      if (paymentResponse.success) {
        // Payment successful
        paymentAttempt.status = PaymentAttemptStatus.SUCCESS;
        await this.paymentAttemptRepository.save(paymentAttempt);

        // Update subscription
        // Clear promoCode after first successful billing since it should only apply to initial subscription
        // This applies to both initial payment and retry payment success for first-time subscriptions
        if (subscription.renewalCount === -1) {
          subscription.clearPromoCode();
        }
        if (!isRetry) {
          subscription.renew();
        }
        subscription.status = 'active';
        await this.subscriptionRepository.save(subscription);

        this._Logger.log(`Payment successful for subscription ${subscriptionId}, transaction: ${paymentResponse.transactionId}`);

        return {
          success: true,
          transactionId: paymentResponse.transactionId,
        };
      } else {
        // Payment failed
        paymentAttempt.status = PaymentAttemptStatus.FAILED;
        paymentAttempt.failureReason = paymentResponse.errorCode || 'UNKNOWN_ERROR';
        await this.paymentAttemptRepository.save(paymentAttempt);

        // Handle payment failure
        return this.handlePaymentFailure(subscriptionId, paymentAttempt.failureReason, paymentAttempt.retryCount);
      }
    } catch (error) {
      this._Logger.error(`Payment processing error for subscription ${subscriptionId}: ${error.message}`);

      paymentAttempt.status = PaymentAttemptStatus.FAILED;
      paymentAttempt.failureReason = 'SYSTEM_ERROR';
      await this.paymentAttemptRepository.save(paymentAttempt);

      return this.handlePaymentFailure(subscriptionId, 'SYSTEM_ERROR', paymentAttempt.retryCount);
    }
  }

  /**
   * Handle payment failure for a subscription
   */
  async handlePaymentFailure(subscriptionId: string, failureReason: string, retryCount: number): Promise<BillingResult> {
    this._Logger.log(`Handling payment failure for subscription ${subscriptionId}, reason: ${failureReason}, retryCount: ${retryCount}`);

    // Find subscription
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return {
        success: false,
        errorMessage: 'Subscription not found',
        errorCode: 'SUBSCRIPTION_NOT_FOUND',
      };
    }

    // Handle failure using subscription logic
    const failureResult = subscription.handlePaymentFailure(failureReason);

    if (failureResult.shouldRetry && retryCount < 3) {
      // Queue retry task with delay (1 hour)
      const taskId = uuidv4();
      const retryTask: BillingTask = {
        taskId,
        subscriptionId,
        taskType: 'retry',
        retryCount: retryCount + 1,
        createdAt: new Date(),
      };

      await this.taskQueue.publishTask(retryTask, 60 * 60 * 1000); // 1 hour delay

      await this.subscriptionRepository.save(subscription);

      this._Logger.log(`Queued retry for subscription ${subscriptionId}, attempt ${retryCount + 1}`);

      return {
        success: false,
        errorMessage: failureResult.failureReason,
        errorCode: failureResult.failureReason,
        queuedForRetry: true,
      };
    } else if (failureResult.enteredGracePeriod) {
      // Entered grace period
      await this.subscriptionRepository.save(subscription);

      this._Logger.log(`Subscription ${subscriptionId} entered grace period`);

      return {
        success: false,
        errorMessage: failureResult.failureReason,
        errorCode: failureResult.failureReason,
        queuedForRetry: false,
        enteredGracePeriod: true,
      };
    } else {
      // Non-retryable failure, no grace period
      await this.subscriptionRepository.save(subscription);

      this._Logger.log(`Non-retryable failure for subscription ${subscriptionId}`);

      return {
        success: false,
        errorMessage: failureResult.failureReason,
        errorCode: failureResult.failureReason,
        queuedForRetry: false,
      };
    }
  }

  /**
   * Process a billing task from the queue
   */
  async processBillingTask(taskId: string, subscriptionId: string, taskType: 'billing' | 'retry' | 'manual_retry', retryCount: number): Promise<BillingResult> {
    this._Logger.log(`Processing billing task ${taskId} for subscription ${subscriptionId}, type: ${taskType}, retryCount: ${retryCount}`);

    // Validate task data
    if (!taskId || !subscriptionId || !taskType) {
      this._Logger.error(`Invalid task data: taskId=${taskId}, subscriptionId=${subscriptionId}, taskType=${taskType}`);
      await this.taskQueue.rejectTask(taskId, false);
      return {
        success: false,
        errorMessage: 'Invalid task data',
        errorCode: 'INVALID_TASK_DATA',
      };
    }

    // TODO: Acquire distributed lock for subscription
    // const lockAcquired = await this.distributedLock.acquire(`billing:${subscriptionId}`);
    // if (!lockAcquired) {
    //   this._Logger.warn(`Failed to acquire lock for subscription ${subscriptionId}, requeueing task`);
    //   await this.taskQueue.rejectTask(taskId, true); // Requeue
    //   return {
    //     success: false,
    //     errorMessage: 'Lock acquisition failed',
    //     errorCode: 'LOCK_FAILED',
    //   };
    // }

    try {
      const result = await this.processBilling(subscriptionId, taskType === 'retry' || taskType === 'manual_retry', retryCount);

      if (result.success) {
        await this.taskQueue.acknowledgeTask(taskId);
        this._Logger.log(`Billing task ${taskId} completed successfully`);
        // TODO: Record success log to billingLogs
        // await this.billingLogRepository.save({ ... });
      } else if (result.queuedForRetry) {
        await this.taskQueue.acknowledgeTask(taskId);
        this._Logger.log(`Billing task ${taskId} queued for retry`);
        // TODO: Record retry log
      } else {
        await this.taskQueue.rejectTask(taskId, false);
        this._Logger.log(`Billing task ${taskId} failed permanently`);
        // TODO: Record failure log
        // TODO: Send notification if entered grace period
        // if (result.enteredGracePeriod) await this.notificationService.sendGracePeriodNotification(subscriptionId);
      }

      return result;
    } catch (error) {
      this._Logger.error(`Error processing billing task ${taskId}: ${error.message}`);
      await this.taskQueue.rejectTask(taskId, true); // Requeue on error
      throw error;
    } finally {
      // TODO: Release distributed lock
      // await this.distributedLock.release(`billing:${subscriptionId}`);
    }
  }

  /**
   * Process refund for a subscription
   */
  async processRefund(subscriptionId: string, refundId: string, amount: number): Promise<BillingResult> {
    this._Logger.log(`Processing refund ${refundId} for subscription ${subscriptionId}, amount: ${amount}`);

    try {
      // Call payment gateway to process refund
      const refundResult = await this.paymentGateway.refund(refundId, amount, 'Subscription cancellation');

      if (refundResult.success) {
        this._Logger.log(`Refund ${refundId} processed successfully`);
        return {
          success: true,
          transactionId: refundResult.transactionId,
        };
      } else {
        this._Logger.error(`Refund ${refundId} failed: ${refundResult.errorMessage}`);
        return {
          success: false,
          errorMessage: refundResult.errorMessage || 'Refund failed',
          errorCode: refundResult.errorCode || 'REFUND_FAILED',
        };
      }
    } catch (error) {
      this._Logger.error(`Error processing refund ${refundId}: ${error.message}`);
      return {
        success: false,
        errorMessage: error.message,
        errorCode: 'REFUND_ERROR',
      };
    }
  }

  /**
   * Calculate first-time subscription discount using rules engine
   */
  private async calculateFirstTimeSubscriptionDiscount(product: any, subscription: any, currentAmount: number = 0): Promise<number> {
    const amount = currentAmount || product.price;

    // Get discount rules from repository
    const discountRules = await this.rulesRepository.findByType('discount');
    const applicableRules = this.rulesEngineService.filterApplicableRules(discountRules, 'discount');

    // Get applied discount info if exists
    let appliedDiscountInfo = null;
    if (subscription.appliedDiscountId && subscription.remainingDiscountPeriods > 0) {
      const appliedDiscount = await this.discountRepository.findByDiscountId(subscription.appliedDiscountId);
      if (appliedDiscount && appliedDiscount.isApplicable(new Date())) {
        appliedDiscountInfo = {
          discountId: appliedDiscount.discountId,
          type: appliedDiscount.type,
          value: appliedDiscount.value,
          remainingPeriods: subscription.remainingDiscountPeriods,
        };
      }
    }

    // Create evaluation context
    const context: RuleEvaluationContext = {
      userId: subscription.userId,
      productId: product.productId,
      product: {
        productId: product.productId,
        name: product.name,
        price: product.price,
        cycleType: product.cycleType,
      },
      subscription: {
        subscriptionId: subscription.subscriptionId,
        isFirstTimeSubscription: subscription.renewalCount === -1,
      },
      promoCode: subscription.promoCode ? {
        code: subscription.promoCode,
      } : undefined,
      appliedDiscount: appliedDiscountInfo,
      currentDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD string
      originalPrice: amount,
      discountedPrice: amount,
    };

    // Evaluate rules
    const result = this.rulesEngineService.evaluateRules(applicableRules, context);

    if (result.success && result.totalDiscount > 0) {
      return Math.max(0, amount - result.totalDiscount);
    }

    // Return current amount if no rules apply
    return amount;
  }

  /**
   * Calculate renewal discount using rules engine
   */
  private async calculateRenewalDiscount(product: any, subscription: any, currentAmount: number = 0): Promise<number> {
    const amount = currentAmount || product.price;

    // Get discount rules from repository
    const discountRules = await this.rulesRepository.findByType('discount');
    const applicableRules = this.rulesEngineService.filterApplicableRules(discountRules, 'discount');

    // Get applied discount info if exists
    let appliedDiscountInfo = null;
    if (subscription.appliedDiscountId && subscription.remainingDiscountPeriods > 0) {
      const appliedDiscount = await this.discountRepository.findByDiscountId(subscription.appliedDiscountId);
      if (appliedDiscount && appliedDiscount.isApplicable(new Date())) {
        appliedDiscountInfo = {
          discountId: appliedDiscount.discountId,
          type: appliedDiscount.type,
          value: appliedDiscount.value,
          remainingPeriods: subscription.remainingDiscountPeriods,
        };
      }
    }

    // Create evaluation context for renewal
    const context: RuleEvaluationContext = {
      userId: subscription.userId,
      productId: product.productId,
      product: {
        productId: product.productId,
        name: product.name,
        price: product.price,
        cycleType: product.cycleType,
      },
      subscription: {
        subscriptionId: subscription.subscriptionId,
        isFirstTimeSubscription: false, // For renewal
        renewalCount: subscription.renewalCount,
      },
      promoCode: subscription.promoCode ? {
        code: subscription.promoCode,
      } : undefined,
      appliedDiscount: appliedDiscountInfo,
      currentDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD string
      originalPrice: amount,
      discountedPrice: amount,
    };

    // Evaluate rules
    const result = this.rulesEngineService.evaluateRules(applicableRules, context);

    if (result.success && result.totalDiscount > 0) {
      return Math.max(0, amount - result.totalDiscount);
    }

    // Return current amount if no rules apply
    return amount;
  }

  /**
   * Calculate promo code discount for initial billing
   */
  private async calculatePromoCodeDiscount(product: any, subscription: any, currentAmount: number): Promise<{ amount: number; discount: Discount | null }> {
    if (!subscription.promoCode) {
      return { amount: currentAmount, discount: null };
    }

    // If subscription already has an applied discount, don't apply promo code discount again
    // This prevents double-discounting when promo code is applied to subscription
    if (subscription.appliedDiscountId && subscription.remainingDiscountPeriods > 0) {
      this._Logger.log(`Subscription ${subscription.subscriptionId} already has applied discount ${subscription.appliedDiscountId}, skipping promo code discount`);
      return { amount: currentAmount, discount: null };
    }

    // Find promo code entity
    const promoCodeEntity = await this.promoCodeRepository.findByCode(subscription.promoCode);
    if (!promoCodeEntity) {
      this._Logger.warn(`Promo code ${subscription.promoCode} not found for subscription ${subscription.subscriptionId}`);
      return { amount: currentAmount, discount: null };
    }

    // Find associated discount
    const discount = await this.discountRepository.findByDiscountId(promoCodeEntity.discountId);
    if (!discount) {
      this._Logger.warn(`Discount ${promoCodeEntity.discountId} not found for promo code ${subscription.promoCode}`);
      return { amount: currentAmount, discount: null };
    }

    // Check if discount is applicable to the product
    if (!discount.isApplicableToProduct(product.productId)) {
      this._Logger.warn(`Discount ${promoCodeEntity.discountId} not applicable to product ${product.productId}`);
      return { amount: currentAmount, discount: null };
    }

    // Apply discount
    const discountedAmount = discount.calculateDiscountedPrice(currentAmount);
    this._Logger.log(`Applied promo code ${subscription.promoCode} discount: ${currentAmount} -> ${discountedAmount}`);

    return { amount: discountedAmount, discount };
  }
}
