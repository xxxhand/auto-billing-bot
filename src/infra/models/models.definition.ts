import type { OptionalId } from 'mongodb';
import { IExampleModel } from './example.model';
import { IUserModel } from './user.model';
import { IProductModel } from './product.model';
import { ISubscriptionModel } from './subscription.model';
import { IDiscountModel } from './discount.model';
import { IPromoCodeModel } from './promoCodes.model';
import { IPromoCodeUsageModel } from './promoCodeUsages.model';
import { IPaymentAttemptModel } from './paymentAttempts.model';
import { IRefundModel } from './refunds.model';
import { IBillingLogModel } from './billingLogs.model';
import { IConfigModel } from './config.model';
import { IRulesModel } from './rules.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  USERS = 'Users',
  PRODUCTS = 'Products',
  SUBSCRIPTIONS = 'Subscriptions',
  DISCOUNTS = 'Discounts',
  PROMO_CODES = 'PromoCodes',
  PROMO_CODE_USAGES = 'PromoCodeUsages',
  PAYMENT_ATTEMPTS = 'PaymentAttempts',
  REFUNDS = 'Refunds',
  BILLING_LOGS = 'BillingLogs',
  CONFIG = 'Configs',
  RULES = 'Rules',
  PAYMENT_HISTORY = 'PaymentHistory',
  OPERATION_LOGS = 'OperationLogs',
}

export type IExampleDocument = OptionalId<IExampleModel>;
export type IUserDocument = OptionalId<IUserModel>;
export type IProductDocument = OptionalId<IProductModel>;
export type ISubscriptionDocument = OptionalId<ISubscriptionModel>;
export type IDiscountDocument = OptionalId<IDiscountModel>;
export type IPromoCodeDocument = OptionalId<IPromoCodeModel>;
export type IPromoCodeUsageDocument = OptionalId<IPromoCodeUsageModel>;
export type IPaymentAttemptDocument = OptionalId<IPaymentAttemptModel>;
export type IRefundDocument = OptionalId<IRefundModel>;
export type IBillingLogDocument = OptionalId<IBillingLogModel>;
export type IConfigDocument = OptionalId<IConfigModel>;
export type IRulesDocument = OptionalId<IRulesModel>;
