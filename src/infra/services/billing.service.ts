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

    // Check subscription status
    if (subscription.status !== 'active') {
      this._Logger.log(`Subscription ${subscriptionId} is not active, status: ${subscription.status}`);
      // TODO: Record cancel log to billingLogs
      // await this.billingLogRepository.save({ eventType: 'billing_cancelled', subscriptionId, details: { reason: 'inactive_status' } });
      return {
        success: false,
        errorMessage: 'Subscription not active',
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
    if (subscription.remainingDiscountPeriods > 0) {
      amount = 0; // Free period
      subscription.remainingDiscountPeriods -= 1;
      await this.subscriptionRepository.save(subscription);
    }

    // Apply renewal discount for second and subsequent renewals
    if (subscription.renewalCount >= 1) {
      const renewalDiscounts = await this.discountRepository.findRenewalDiscounts(subscription.productId);
      if (renewalDiscounts.length > 0) {
        // Apply the highest priority renewal discount
        const highestPriorityDiscount = renewalDiscounts[0];
        amount = subscription.applyDiscount(highestPriorityDiscount, amount);
      }
    }

    // Create payment attempt
    const attemptId = uuidv4();
    const paymentAttempt = new PaymentAttempt(attemptId, subscriptionId, PaymentAttemptStatus.PENDING, '', retryCount);

    await this.paymentAttemptRepository.save(paymentAttempt);

    // Create payment request
    const paymentRequest: PaymentRequest = {
      attemptId,
      userId: subscription.userId,
      amount,
      currency: 'TWD',
      description: `Subscription billing for ${subscription.subscriptionId}`,
    };

    try {
      // Process payment
      const paymentResponse: PaymentResponse = await this.paymentGateway.charge(paymentRequest);

      if (paymentResponse.success) {
        // Payment successful
        paymentAttempt.status = PaymentAttemptStatus.SUCCESS;
        await this.paymentAttemptRepository.save(paymentAttempt);

        // Update subscription
        subscription.renew();
        subscription.nextBillingDate = subscription.calculateNextBillingDate();
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
}
