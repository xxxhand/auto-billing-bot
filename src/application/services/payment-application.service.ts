import { Injectable } from '@nestjs/common';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { PaymentHistory } from '../../domain/entities/payment-history.entity';
import { PaymentService } from '../../domain/services/payment.service';
import { PaymentHistoryRepository } from '../../infra/repositories/payment-history.repository';

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentHistoryRepository: PaymentHistoryRepository,
  ) {}

  /**
   * 處理支付
   */
  public async processPayment(subscriptionId: string, amount: number): Promise<PaymentResult> {
    // 執行支付
    const result = await this.paymentService.processPayment(subscriptionId, amount);

    // 記錄支付歷史
    const paymentHistory = new PaymentHistory();
    paymentHistory.subscriptionId = subscriptionId;
    paymentHistory.amount = amount;
    paymentHistory.status = result.status;
    paymentHistory.failureReason = result.failureReason;
    paymentHistory.createdAt = new Date().toISOString();

    await this.paymentHistoryRepository.save(paymentHistory);

    return result;
  }
}
