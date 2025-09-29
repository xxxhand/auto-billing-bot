import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CouponPriority {
  BASIC = 1,
  RENEWAL = 2,
  CAMPAIGN = 3,
}

export interface ICouponModel {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  priority: CouponPriority;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  usedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  value: number;

  @IsEnum(CouponPriority)
  priority: CouponPriority;

  @IsDate()
  validFrom: Date;

  @IsDate()
  validUntil: Date;

  @IsOptional()
  @IsNumber()
  usageLimit?: number;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsEnum(CouponPriority)
  priority?: CouponPriority;

  @IsOptional()
  @IsDate()
  validFrom?: Date;

  @IsOptional()
  @IsDate()
  validUntil?: Date;

  @IsOptional()
  @IsNumber()
  usageLimit?: number;
}
