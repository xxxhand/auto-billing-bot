import { Injectable } from '@nestjs/common';
import { PaymentResult } from '../value-objects/payment-result.value-object';

@Injectable()
export class PaymentService {
  /**
   * 處理支付邏輯（模擬）
   * @param subscriptionId 訂閱ID
   * @param amount 支付金額
   * @returns 支付結果
   */
  public async processPayment(subscriptionId: string, amount: number): Promise<PaymentResult> {
    // 模擬支付處理延遲
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 80% 成功率，20% 失敗
    const isSuccess = Math.random() < 0.8;

    if (isSuccess) {
      return PaymentResult.success();
    } else {
      // 隨機選擇失敗原因
      const failureReasons = ['insufficient_funds', 'card_declined', 'network_error', 'card_expired'];
      const randomReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      return PaymentResult.failed(randomReason);
    }
  }
}
