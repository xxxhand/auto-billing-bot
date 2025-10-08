import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { v4 as uuidv4 } from 'uuid';
import { IPaymentGateway, IPaymentGatewayToken, PaymentRequest, PaymentResponse } from '../../domain/services/payment-gateway.interface';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';
import { IBillingService, BillingResult } from '../../domain/services/billing.service.interface';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { Subscription } from '../../domain/entities/subscription.entity';
import { PaymentAttempt, PaymentAttemptStatus } from '../../domain/entities/payment-attempt.entity';

@Injectable()
export class BillingService implements IBillingService {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    @Inject(IPaymentGatewayToken) private readonly paymentGateway: IPaymentGateway,
    @Inject('ITaskQueue') private readonly taskQueue: ITaskQueue,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly paymentAttemptRepository: PaymentAttemptRepository,
  ) {
    this._Logger = this.commonService.getDefaultLogger(BillingService.name);
  }

  /**
   * Process billing for a subscription
   */
  async processBilling(subscriptionId: string, isRetry = false): Promise<BillingResult> {
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

    // Create payment attempt
    const attemptId = uuidv4();
    const paymentAttempt = new PaymentAttempt(
      attemptId,
      subscriptionId,
      PaymentAttemptStatus.PENDING,
      null,
      isRetry ? 1 : 0,
    );

    await this.paymentAttemptRepository.save(paymentAttempt);

    // Create payment request
    const paymentRequest: PaymentRequest = {
      attemptId,
      userId: subscription.userId,
      amount: 100, // TODO: Get actual amount from product
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
  async handlePaymentFailure(
    subscriptionId: string,
    failureReason: string,
    retryCount: number,
  ): Promise<BillingResult> {
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
  async processBillingTask(
    taskId: string,
    subscriptionId: string,
    taskType: 'billing' | 'retry' | 'manual_retry',
    retryCount: number,
  ): Promise<BillingResult> {
    this._Logger.log(`Processing billing task ${taskId} for subscription ${subscriptionId}, type: ${taskType}, retryCount: ${retryCount}`);

    try {
      const result = await this.processBilling(subscriptionId, taskType === 'retry' || taskType === 'manual_retry');

      if (result.success) {
        await this.taskQueue.acknowledgeTask(taskId);
        this._Logger.log(`Billing task ${taskId} completed successfully`);
      } else if (result.queuedForRetry) {
        await this.taskQueue.acknowledgeTask(taskId);
        this._Logger.log(`Billing task ${taskId} queued for retry`);
      } else {
        await this.taskQueue.rejectTask(taskId, false);
        this._Logger.log(`Billing task ${taskId} failed permanently`);
      }

      return result;
    } catch (error) {
      this._Logger.error(`Error processing billing task ${taskId}: ${error.message}`);
      await this.taskQueue.rejectTask(taskId, true); // Requeue on error
      throw error;
    }
  }
}