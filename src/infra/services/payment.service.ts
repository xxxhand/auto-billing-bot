import { Injectable } from '@nestjs/common';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { Subscription } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';
import { PaymentHistoryRepository } from '../../infra/repositories/payment-history.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';

@Injectable()
export class PaymentService {
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(
    private readonly paymentHistoryRepository: PaymentHistoryRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async processPayment(subscriptionId: string, isManual: boolean): Promise<PaymentResult> {
    try {
      // 獲取訂閱和產品信息
      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        return new PaymentResult('failed', 0, isManual, !isManual, 'Subscription not found');
      }

      const product = await this.productRepository.findById(subscription.productId);
      if (!product) {
        return new PaymentResult('failed', 0, isManual, !isManual, 'Product not found');
      }

      // 模擬付款處理（在實際實現中，這裡會調用支付網關）
      const paymentResult = await this.simulatePaymentProcessing(isManual);

      // 計算付款金額
      const amount = this.calculatePaymentAmount(subscription, product, 5, 10); // 5%續訂折扣，10%優惠券折扣

      // 記錄付款歷史
      await this.paymentHistoryRepository.save(paymentResult, subscriptionId, amount);

      return paymentResult;
    } catch (error) {
      return new PaymentResult('failed', 0, isManual, !isManual, error.message);
    }
  }

  async retryPayment(subscriptionId: string, currentRetryCount: number): Promise<PaymentResult> {
    if (currentRetryCount >= this.MAX_RETRY_ATTEMPTS) {
      return new PaymentResult('failed', currentRetryCount, false, true, 'Max retry attempts exceeded');
    }

    // 獲取訂閱和產品信息
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return new PaymentResult('failed', currentRetryCount + 1, false, true, 'Subscription not found');
    }

    const product = await this.productRepository.findById(subscription.productId);
    if (!product) {
      return new PaymentResult('failed', currentRetryCount + 1, false, true, 'Product not found');
    }

    // 模擬重試付款處理
    const paymentResult = await this.simulatePaymentProcessing(false);

    // 更新retryCount
    paymentResult.retryCount = currentRetryCount + 1;

    // 計算付款金額
    const amount = this.calculatePaymentAmount(subscription, product, 5, 10);

    // 記錄付款歷史
    await this.paymentHistoryRepository.save(paymentResult, subscriptionId, amount);

    return paymentResult;
  }

  async getPaymentHistory(subscriptionId: string): Promise<PaymentResult[]> {
    return await this.paymentHistoryRepository.findBySubscriptionId(subscriptionId);
  }

  calculatePaymentAmount(subscription: Subscription, product: Product, renewalDiscount: number = 0, couponDiscount: number = 0): number {
    let amount = product.price;

    // 應用產品折扣
    if (product.discountPercentage && product.discountPercentage > 0) {
      amount = amount * (1 - product.discountPercentage / 100);
    }

    // 使用Subscription的applyDiscount方法應用續訂和優惠券折扣
    amount = subscription.applyDiscount(amount, renewalDiscount / 100, couponDiscount / 100);

    return Math.round(amount * 100) / 100; // 保留兩位小數
  }

  private async simulatePaymentProcessing(isManual: boolean): Promise<PaymentResult> {
    // 模擬付款處理 - 在實際實現中，這裡會調用真正的支付網關
    // 在測試環境中總是成功，在生產環境中使用隨機模擬
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const isSuccess = isTestEnvironment || Math.random() > 0.1;

    if (isSuccess) {
      return new PaymentResult('success', 0, isManual, !isManual);
    } else {
      return new PaymentResult('failed', 0, isManual, !isManual, 'Payment declined by gateway');
    }
  }
}
