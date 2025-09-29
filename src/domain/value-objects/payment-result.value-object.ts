export type PaymentStatus = 'success' | 'failed';

export class PaymentResult {
  constructor(
    public status: PaymentStatus,
    public retryCount: number,
    public isManual: boolean,
    public isAuto: boolean,
    public failureReason?: string,
  ) {}
}
