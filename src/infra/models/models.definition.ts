import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { IUserModel } from './user.model';
import { IProductModel } from './product.model';
import { ISubscriptionModel } from './subscription.model';
import { IDiscountModel } from './discount.model';
import { IPromoCodeModel } from './promoCodes.model';
import { IPaymentAttemptModel } from './paymentAttempts.model';
import { IRefundModel } from './refunds.model';
import { IBillingLogModel } from './billingLogs.model';
import { IConfigModel } from './config.model';
import { IRulesModel } from './rules.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  USERS = 'users',
  PRODUCTS = 'products',
  SUBSCRIPTIONS = 'subscriptions',
  DISCOUNTS = 'discounts',
  PROMO_CODES = 'promoCodes',
  PAYMENT_ATTEMPTS = 'paymentAttempts',
  REFUNDS = 'refunds',
  BILLING_LOGS = 'billingLogs',
  CONFIG = 'config',
  RULES = 'rules',
  PAYMENT_HISTORY = 'paymentHistory',
  OPERATION_LOGS = 'operationLogs',
}

export type IExampleDocument = WithId<IExampleModel>;
export type IUserDocument = WithId<IUserModel>;
export type IProductDocument = WithId<IProductModel>;
export type ISubscriptionDocument = WithId<ISubscriptionModel>;
export type IDiscountDocument = WithId<IDiscountModel>;
export type IPromoCodeDocument = WithId<IPromoCodeModel>;
export type IPaymentAttemptDocument = WithId<IPaymentAttemptModel>;
export type IRefundDocument = WithId<IRefundModel>;
export type IBillingLogDocument = WithId<IBillingLogModel>;
export type IConfigDocument = WithId<IConfigModel>;
export type IRulesDocument = WithId<IRulesModel>;
