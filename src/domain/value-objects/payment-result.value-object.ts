export type PaymentStatus = 'success' | 'failed';

export class PaymentResult {
  constructor(
    public readonly status: PaymentStatus,
    public readonly failureReason?: string,
  ) {}

  /**
   * 檢查支付是否成功
   */
  public isSuccess(): boolean {
    return this.status === 'success';
  }

  /**
   * 檢查支付是否失敗
   */
  public isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * 創建成功的支付結果
   */
  public static success(): PaymentResult {
    return new PaymentResult('success');
  }

  /**
   * 創建失敗的支付結果
   */
  public static failed(reason: string): PaymentResult {
    return new PaymentResult('failed', reason);
  }
}
