import { IBaseModel } from './base-model.interface';

/**
 * Config type enums as defined in the system design v0.7.1
 */
export type ConfigType = 'global' | 'product';

export interface IConfigModel extends IBaseModel {
  /** Config unique identifier (PK) */
  configId: string;
  /** Config type */
  type: ConfigType;
  /** Product ID (only valid when type is product) */
  productId?: string | null;
  /** Grace period length in days; defaults to 7 when not provided */
  gracePeriodDays?: number;
  /** Refund policy details */
  refundPolicy?: Record<string, any>;
}