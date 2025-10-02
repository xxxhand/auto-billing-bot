import { IBaseModel } from './base-model.interface';

export type PaymentAttemptStatus = 'success' | 'failed' | 'pending';

export interface IPaymentAttemptModel extends IBaseModel {
  /** Payment attempt unique identifier (PK) */
  attemptId: string;
  /** Related subscription id (FK) */
  subscriptionId: string;
  /** Payment attempt status */
  status: PaymentAttemptStatus;
  /** Failure reason (if failed) */
  failureReason: string | null;
  /** Number of retries */
  retryCount: number;
}