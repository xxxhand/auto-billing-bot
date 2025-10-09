import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';

export interface IUserModel extends IBaseModel {
  /** Unique identifier of the user */
  userId: ObjectId;
  /** Tenant identifier for future multi-tenant support */
  tenantId: string;
  /** Encrypted payload containing user sensitive data (e.g. payment info) */
  encryptedData: string;
}
