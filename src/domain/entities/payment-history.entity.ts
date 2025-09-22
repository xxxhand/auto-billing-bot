import { BaseEntity } from './base-entity.abstract';

export type PaymentStatus = 'success' | 'failed';

export class PaymentHistory extends BaseEntity {
  public subscriptionId: string = '';
  public amount: number = 0;
  public status: PaymentStatus = 'failed';
  public failureReason?: string;
  public createdAt: string = '';

  constructor() {
    super();
  }
}
