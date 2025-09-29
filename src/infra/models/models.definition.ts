import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { ICouponModel } from './coupon.model';
import { IOperationLogModel } from './operation-log.model';
import { IRulesModel } from './rules.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  COUPON = 'Coupons',
  OPERATION_LOG = 'OperationLogs',
  RULES = 'Rules',
}

export type IExampleDocument = WithId<IExampleModel>;
export type ICouponDocument = WithId<ICouponModel>;
export type IOperationLogDocument = WithId<IOperationLogModel>;
export type IRulesDocument = WithId<IRulesModel>;
