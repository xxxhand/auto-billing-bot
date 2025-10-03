import { IBaseModel } from './base-model.interface';

export interface IBillingLogModel extends IBaseModel {
  /** Log unique identifier (PK) */
  logId: string;
  /** Related subscription id (FK) */
  subscriptionId: string;
  /** Event type (e.g., "payment_attempt", "subscription_created") */
  eventType: string;
  /** Event details */
  details: Record<string, any>;
}