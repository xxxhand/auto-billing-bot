import { BaseEntity } from './base-entity.abstract';

/**
 * Refund status enums
 */
export type RefundStatus = 'pending' | 'completed' | 'failed';

/**
 * Refund entity representing a refund transaction
 */
export class Refund extends BaseEntity {
  public refundId: string;
  public subscriptionId: string;
  public amount: number;
  public status: RefundStatus;
  public createdAt: Date;
  public processedAt?: Date;

  constructor(
    refundId: string,
    subscriptionId: string,
    amount: number,
    status: RefundStatus = 'pending',
    createdAt: Date = new Date(),
    processedAt?: Date,
  ) {
    super();
    this.refundId = refundId;
    this.subscriptionId = subscriptionId;
    this.amount = amount;
    this.status = status;
    this.createdAt = createdAt;
    this.processedAt = processedAt;
  }

  /**
   * Mark refund as completed
   */
  public complete(): void {
    this.status = 'completed';
    this.processedAt = new Date();
  }

  /**
   * Mark refund as failed
   */
  public fail(): void {
    this.status = 'failed';
    this.processedAt = new Date();
  }

  /**
   * Check if refund is in a final state
   */
  public isFinal(): boolean {
    return this.status === 'completed' || this.status === 'failed';
  }
}