import { IsString, IsDate, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionStatus, BillingCycleType } from '../../domain/entities/subscription.entity';

export interface ISubscriptionModel {
  id: string;
  userId: string;
  productId: string;
  billingCycle: BillingCycleType;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date;
  nextBillingDate?: Date;
  lastBillingDate?: Date;
  gracePeriodEndDate?: Date;
  couponApplied?: { code: string; periods: number };
  renewalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateSubscriptionDto {
  @IsString()
  userId: string;

  @IsString()
  productId: string;

  @IsEnum(BillingCycleType)
  billingCycle: BillingCycleType;

  @IsOptional()
  @IsDate()
  startDate?: Date;
}
