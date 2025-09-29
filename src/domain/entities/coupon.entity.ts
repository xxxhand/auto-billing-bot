import { IsString, IsNumber, IsDate, IsOptional, IsArray, IsEnum, Min, IsNotEmpty } from 'class-validator';
import { BaseEntity } from './base-entity.abstract';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CouponPriority {
  BASIC = 1,
  RENEWAL = 2,
  CAMPAIGN = 3,
}

export class Coupon extends BaseEntity {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsEnum(CouponPriority)
  priority: CouponPriority;

  @IsDate()
  validFrom: Date;

  @IsDate()
  validUntil: Date;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsNumber()
  @Min(0)
  usedCount: number;

  @IsArray()
  @IsString({ each: true })
  usedBy: string[];

  constructor(id: string, code: string, type: DiscountType, value: number, priority: CouponPriority, validFrom: Date, validUntil: Date, usageLimit?: number) {
    super();
    this.id = id;
    this.code = code;
    this.type = type;
    this.value = value;
    this.priority = priority;
    this.validFrom = validFrom;
    this.validUntil = validUntil;
    this.usageLimit = usageLimit;
    this.usedCount = 0;
    this.usedBy = [];
  }

  isValid(): boolean {
    const now = new Date(Date.now());
    return now >= this.validFrom && now <= this.validUntil;
  }

  isUsageLimitReached(): boolean {
    return this.usageLimit ? this.usedCount >= this.usageLimit : false;
  }

  canBeUsedBy(userId: string): boolean {
    return !this.usedBy.includes(userId);
  }

  useBy(userId: string): void {
    if (!this.canBeUsedBy(userId)) {
      throw new Error('Coupon already used by this user');
    }
    if (this.isUsageLimitReached()) {
      throw new Error('Coupon usage limit reached');
    }
    this.usedBy.push(userId);
    this.usedCount++;
  }

  calculateDiscount(amount: number): number {
    if (this.type === DiscountType.PERCENTAGE) {
      return Math.min(amount * (this.value / 100), amount);
    } else {
      return Math.min(this.value, amount);
    }
  }
}
