import { Injectable } from '@nestjs/common';
import { PaymentService } from '../../infra/services/payment.service';
import { SubscriptionService } from '../../infra/services/subscription.service';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { Product } from '../../domain/entities/product.entity';

export interface ProcessPaymentResult {
  success: boolean;
  paymentResult?: PaymentResult;
  message?: string;
}

export interface PaymentHistoryResult {
  success: boolean;
  paymentHistory?: PaymentResult[];
  message?: string;
}

export interface PaymentAmountResult {
  success: boolean;
  amount?: number;
  message?: string;
}

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async processManualPayment(subscriptionId: string): Promise<ProcessPaymentResult> {
    try {
      // 驗證訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      // 處理手動付款
      const paymentResult = await this.paymentService.processPayment(subscriptionId, true);

      if (paymentResult.status === 'success') {
        // 付款成功，續訂訂閱
        await this.subscriptionService.renewSubscription(subscriptionId);

        return {
          success: true,
          paymentResult,
        };
      } else {
        // 付款失敗
        return {
          success: false,
          paymentResult,
          message: 'Payment processing failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSubscriptionPaymentHistory(subscriptionId: string): Promise<PaymentHistoryResult> {
    try {
      // 驗證訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      // 獲取付款歷史
      const paymentHistory = await this.paymentService.getPaymentHistory(subscriptionId);

      return {
        success: true,
        paymentHistory,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async calculateNextPaymentAmount(subscriptionId: string): Promise<PaymentAmountResult> {
    try {
      // 獲取訂閱信息
      const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      // 模擬產品信息（在實際實現中需要從ProductService獲取）
      const mockProduct: Product = Object.assign(new Product(), {
        id: subscription.productId,
        price: 100, // 模擬價格
        discountPercentage: 0,
      });

      // 計算下次付款金額
      const amount = this.paymentService.calculatePaymentAmount(
        subscription,
        mockProduct,
        5, // 續訂折扣5%
        subscription.couponCode ? 10 : 0, // 優惠券折扣10%
      );

      return {
        success: true,
        amount,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
