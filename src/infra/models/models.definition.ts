import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { ISubscriptionModel } from './subscription.model';
import { IProductModel } from './product.model';
import { IPaymentHistoryModel } from './payment-history.model';
import { IOperationLogModel } from './operation-log.model';
import { ICouponModel } from './coupon.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  SUBSCRIPTION = 'Subscriptions',
  PRODUCT = 'Products',
  PAYMENT_HISTORY = 'PaymentHistories',
  OPERATION_LOG = 'OperationLogs',
  COUPON = 'Coupons',
}

export type IExampleDocument = WithId<IExampleModel>;
export type ISubscriptionDocument = WithId<ISubscriptionModel>;
export type IProductDocument = WithId<IProductModel>;
export type IPaymentHistoryDocument = WithId<IPaymentHistoryModel>;
export type IOperationLogDocument = WithId<IOperationLogModel>;
export type ICouponDocument = WithId<ICouponModel>;
