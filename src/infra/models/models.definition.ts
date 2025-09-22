import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { IUserModel } from './user.model';
import { IProductModel } from './product.model';
import { ISubscriptionModel } from './subscription.model';
import { IPaymentHistoryModel } from './payment-history.model';
import { IOperationLogModel } from './operation-log.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  USERS = 'users',
  PRODUCTS = 'products',
  SUBSCRIPTIONS = 'subscriptions',
  PAYMENT_HISTORY = 'paymentHistory',
  OPERATION_LOGS = 'operationLogs',
}

export type IExampleDocument = WithId<IExampleModel>;
export type IUserDocument = WithId<IUserModel>;
export type IProductDocument = WithId<IProductModel>;
export type ISubscriptionDocument = WithId<ISubscriptionModel>;
export type IPaymentHistoryDocument = WithId<IPaymentHistoryModel>;
export type IOperationLogDocument = WithId<IOperationLogModel>;
