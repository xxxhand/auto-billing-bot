import { IsString, IsDate, IsEnum, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';
import { BaseEntity } from './base-entity.abstract';

export enum SubscriptionStatus {
  PENDING = 'pending', // 待生效
  ACTIVE = 'active', // 已生效
  CANCELLED = 'cancelled', // 已取消
  GRACE_PERIOD = 'grace_period', // 寬限期
}

export enum BillingCycleType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  WEEKLY = 'weekly',
}

export class Subscription extends BaseEntity {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  productId: string;

  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @IsDate()
  startDate: Date;

  @IsOptional()
  @IsDate()
  endDate?: Date;

  @IsEnum(BillingCycleType)
  billingCycle: BillingCycleType;

  @IsNumber()
  @Min(0)
  renewalCount: number;

  @IsOptional()
  @IsDate()
  nextBillingDate?: Date;

  @IsOptional()
  @IsDate()
  lastBillingDate?: Date;

  @IsOptional()
  @IsDate()
  gracePeriodEndDate?: Date;

  @IsOptional()
  couponApplied?: { code: string; periods: number };

  constructor(
    id: string,
    userId: string,
    productId: string,
    billingCycle: BillingCycleType,
    startDate: Date = new Date(),
    status: SubscriptionStatus = SubscriptionStatus.PENDING,
  ) {
    super();
    this.id = id;
    this.userId = userId;
    this.productId = productId;
    this.status = status;
    this.startDate = startDate;
    this.billingCycle = billingCycle;
    this.renewalCount = 0;
    this.nextBillingDate = this.calculateNextBillingDate(startDate);
  }

  /**
   * Activate the subscription
   */
  activate(): void {
    if (this.status !== SubscriptionStatus.PENDING) {
      throw new Error('Only pending subscriptions can be activated');
    }
    this.status = SubscriptionStatus.ACTIVE;
  }

  /**
   * Cancel the subscription
   */
  cancel(): void {
    if (this.status === SubscriptionStatus.CANCELLED) {
      throw new Error('Subscription is already cancelled');
    }
    this.status = SubscriptionStatus.CANCELLED;
    this.endDate = new Date();
  }

  /**
   * Change billing cycle (for plan upgrades) - takes effect next billing cycle
   */
  changeBillingCycle(newBillingCycle: BillingCycleType): void {
    // Validate plan change according to spec: only allow upgrading to longer cycles
    const cycleOrder = [BillingCycleType.WEEKLY, BillingCycleType.MONTHLY, BillingCycleType.QUARTERLY, BillingCycleType.YEARLY];
    const currentIndex = cycleOrder.indexOf(this.billingCycle);
    const newIndex = cycleOrder.indexOf(newBillingCycle);

    if (newIndex <= currentIndex) {
      throw new Error('Invalid plan change: can only upgrade to longer billing cycles');
    }

    this.billingCycle = newBillingCycle;
    this.nextBillingDate = this.calculateNextBillingDate(new Date());
  }

  /**
   * Check if subscription is active
   */
  isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }

  /**
   * Check if subscription is cancelled
   */
  isCancelled(): boolean {
    return this.status === SubscriptionStatus.CANCELLED;
  }

  /**
   * Check if subscription needs billing
   */
  needsBilling(): boolean {
    if (!this.isActive() || !this.nextBillingDate) {
      return false;
    }
    return new Date() >= this.nextBillingDate;
  }

  /**
   * Record a successful billing
   */
  recordBilling(): void {
    this.lastBillingDate = new Date();
    this.nextBillingDate = this.calculateNextBillingDate(this.lastBillingDate);
    this.renewalCount++;
  }

  /**
   * Calculate next billing date based on billing cycle
   */
  private calculateNextBillingDate(fromDate: Date): Date {
    const nextDate = new Date(fromDate);

    switch (this.billingCycle) {
      case BillingCycleType.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case BillingCycleType.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case BillingCycleType.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case BillingCycleType.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Get subscription duration in days
   */
  getSubscriptionDays(): number {
    if (!this.endDate) {
      return Math.floor((new Date().getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    return Math.floor((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
}
