import { Injectable } from '@nestjs/common';
import { SubscriptionService, CreateSubscriptionRequest } from '../../domain/services/subscription.service';
import { CouponService } from '../../domain/services/coupon.service';
import { Subscription, BillingCycleType } from '../../domain/entities/subscription.entity';

export interface CreateSubscriptionData {
  userId: string;
  productId: string;
  billingCycle: BillingCycleType;
  couponCode?: string;
  startDate?: Date;
}

@Injectable()
export class SubscriptionApplicationService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly couponService: CouponService,
  ) {}

  /**
   * Create a new subscription with optional coupon validation
   */
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    // TODO: Validate coupon if provided (requires coupon lookup by code)
    // if (data.couponCode) {
    //   await this.couponService.validateCoupon(data.couponCode, data.productId);
    // }

    // Create subscription
    const request: CreateSubscriptionRequest = {
      userId: data.userId,
      productId: data.productId,
      billingCycle: data.billingCycle,
      startDate: data.startDate,
    };

    return this.subscriptionService.createSubscription(request);
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptionService.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    return subscription;
  }

  /**
   * Get active subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionService.getActiveSubscriptionsForUser(userId);
  }

  /**
   * Change subscription plan
   */
  async changeSubscriptionPlan(subscriptionId: string, newBillingCycle: BillingCycleType): Promise<Subscription> {
    return this.subscriptionService.changePlan(subscriptionId, newBillingCycle);
  }
}
