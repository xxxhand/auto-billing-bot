import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { ICouponModel } from './coupon.model';
import { IOperationLogModel } from './operation-log.model';
import { IRulesModel } from './rules.model';
import { ISubscriptionModel } from './subscription.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  COUPON = 'Coupons',
  OPERATION_LOG = 'OperationLogs',
  RULES = 'Rules',
  SUBSCRIPTION = 'Subscriptions',
}

export type IExampleDocument = WithId<IExampleModel>;
export type ICouponDocument = WithId<ICouponModel>;
export type IOperationLogDocument = WithId<IOperationLogModel>;
export type IRulesDocument = WithId<IRulesModel>;
export type ISubscriptionDocument = WithId<ISubscriptionModel>;
