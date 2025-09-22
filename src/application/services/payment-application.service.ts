import { Injectable } from '@nestjs/common';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { PaymentHistory } from '../../domain/entities/payment-history.entity';
import { PaymentService } from '../../domain/services/payment.service';
import { PaymentHistoryRepository } from '../../infra/repositories/payment-history.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentHistoryRepository: PaymentHistoryRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  /**
   * 處理支付
   */
  public async processPayment(subscriptionId: string, amount: number): Promise<PaymentResult> {
    // 執行支付
    const result = await this.paymentService.processPayment(subscriptionId, amount);

    // 記錄支付歷史
    const paymentHistory = new PaymentHistory();
    // paymentHistory.id = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // 生成唯一ID
    paymentHistory.subscriptionId = subscriptionId;
    paymentHistory.amount = amount;
    paymentHistory.status = result.status;
    paymentHistory.failureReason = result.failureReason;
    paymentHistory.createdAt = new Date().toISOString();

    await this.paymentHistoryRepository.save(paymentHistory);

    // 如果支付成功且訂閱狀態為pending，則激活訂閱
    if (result.status === 'success') {
      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (subscription && subscription.status === 'pending') {
        subscription.activate();
        await this.subscriptionRepository.save(subscription);
      }
    }

    return result;
  }
}
