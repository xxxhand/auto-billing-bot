import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { Subscription } from '../../domain/entities/subscription.entity';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';

export interface AutoBillingResult {
  totalProcessed: number;
  successfulPayments: number;
  failedPayments: number;
  errors: string[];
}

export interface BillingSummary {
  totalDueSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

@Injectable()
export class AutoBillingService {
  private readonly logger = new Logger(AutoBillingService.name);
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
  ) {}

  async processAutoBilling(): Promise<AutoBillingResult> {
    const result: AutoBillingResult = {
      totalProcessed: 0,
      successfulPayments: 0,
      failedPayments: 0,
      errors: [],
    };

    try {
      // 獲取當前到期的訂閱
      const currentDate = new Date().toISOString();
      const dueSubscriptions = await this.subscriptionService.getDueSubscriptions(currentDate);

      result.totalProcessed = dueSubscriptions.length;

      for (const subscription of dueSubscriptions) {
        try {
          // 處理自動付款
          const paymentResult = await this.paymentService.processPayment(subscription.id, false);

          if (paymentResult.status === 'success') {
            // 付款成功，續訂訂閱
            await this.subscriptionService.renewSubscription(subscription.id);
            result.successfulPayments++;
            this.logger.log(`Auto billing successful for subscription ${subscription.id}`);
          } else {
            // 付款失敗，處理失敗邏輯
            result.failedPayments++;
            await this.handlePaymentFailure(subscription, paymentResult);
            this.logger.warn(`Auto billing failed for subscription ${subscription.id}: ${paymentResult.failureReason}`);
          }
        } catch (error) {
          result.failedPayments++;
          result.errors.push(`Failed to process subscription ${subscription.id}: ${error.message}`);
          this.logger.error(`Error processing auto billing for subscription ${subscription.id}`, error);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to process auto billing: ${error.message}`);
      this.logger.error('Error in auto billing process', error);
    }

    return result;
  }

  async processFailedPayment(subscriptionId: string, currentRetryCount: number): Promise<boolean> {
    try {
      // 重試付款
      const paymentResult = await this.paymentService.retryPayment(subscriptionId, currentRetryCount);

      if (paymentResult.status === 'success') {
        // 重試成功，續訂訂閱
        await this.subscriptionService.renewSubscription(subscriptionId);
        this.logger.log(`Payment retry successful for subscription ${subscriptionId}`);
        return true;
      } else {
        // 重試失敗
        if (paymentResult.retryCount >= this.MAX_RETRY_ATTEMPTS) {
          // 達到最大重試次數，取消訂閱
          await this.subscriptionService.cancelSubscription(subscriptionId);
          this.logger.warn(`Subscription ${subscriptionId} cancelled after max retry attempts`);
        }
        return false;
      }
    } catch (error) {
      this.logger.error(`Error processing failed payment for subscription ${subscriptionId}`, error);
      return false;
    }
  }

  async getBillingSummary(startDate: string, endDate: string): Promise<BillingSummary> {
    const dueSubscriptions = await this.subscriptionService.getDueSubscriptions(endDate);

    const activeSubscriptions = dueSubscriptions.filter((sub) => sub.status === 'active').length;
    const cancelledSubscriptions = dueSubscriptions.filter((sub) => sub.status === 'cancelled').length;

    return {
      totalDueSubscriptions: dueSubscriptions.length,
      activeSubscriptions,
      cancelledSubscriptions,
      dateRange: {
        startDate,
        endDate,
      },
    };
  }

  private async handlePaymentFailure(subscription: Subscription, paymentResult: PaymentResult): Promise<void> {
    // 在實際實現中，這裡可能會：
    // 1. 發送付款失敗通知給用戶
    // 2. 記錄失敗原因
    // 3. 安排重試時間
    // 4. 將訂閱標記為寬限期狀態

    this.logger.warn(`Payment failed for subscription ${subscription.id}: ${paymentResult.failureReason}. Retry count: ${paymentResult.retryCount}`);

    // 如果重試次數未達上限，可以安排重試
    if (paymentResult.retryCount < this.MAX_RETRY_ATTEMPTS) {
      // 在實際實現中，這裡會安排定時任務來重試
      this.logger.log(`Scheduling retry for subscription ${subscription.id}`);
    }
  }
}
