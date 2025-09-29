import { Injectable } from '@nestjs/common';
import { Subscription, SubscriptionStatus, BillingCycleType } from '../entities/subscription.entity';
import { BillingCycle } from '../value-objects/billing-cycle.value-object';
import { Discount } from '../value-objects/discount.value-object';

export interface CreateSubscriptionRequest {
  userId: string;
  productId: string;
  billingCycle: BillingCycleType;
  startDate?: Date;
}

export interface SubscriptionBillingResult {
  success: boolean;
  amount: number;
  discountAmount: number;
  finalAmount: number;
  paymentId?: string;
  error?: string;
}

export interface SubscriptionSearchCriteria {
  userId?: string;
  productId?: string;
  status?: SubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class SubscriptionService {
  /**
   * Create a new subscription
   */
  createSubscription(request: CreateSubscriptionRequest): Subscription {
    const subscription = new Subscription(this.generateSubscriptionId(), request.userId, request.productId, request.billingCycle, request.startDate);

    // TODO: Validate product exists and is available
    // TODO: Check user doesn't already have active subscription for this product
    // TODO: Save to repository

    return subscription;
  }

  /**
   * Activate a pending subscription
   */
  activateSubscription(subscriptionId: string): Subscription {
    // TODO: Get subscription from repository
    const subscription = this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.activate();
    // TODO: Save to repository

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string): Subscription {
    // TODO: Get subscription from repository
    const subscription = this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.cancel();
    // TODO: Save to repository

    return subscription;
  }

  /**
   * Suspend a subscription
   */
  suspendSubscription(subscriptionId: string): Subscription {
    // TODO: Get subscription from repository
    const subscription = this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.suspend();
    // TODO: Save to repository

    return subscription;
  }

  /**
   * Resume a suspended subscription
   */
  resumeSubscription(subscriptionId: string): Subscription {
    // TODO: Get subscription from repository
    const subscription = this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.resume();
    // TODO: Save to repository

    return subscription;
  }

  /**
   * Process billing for a subscription
   */
  processBilling(subscriptionId: string, baseAmount: number, discount?: Discount): SubscriptionBillingResult {
    // TODO: Get subscription from repository
    const subscription = this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      return {
        success: false,
        amount: baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        error: 'Subscription not found',
      };
    }

    if (!subscription.isActive()) {
      return {
        success: false,
        amount: baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        error: 'Subscription is not active',
      };
    }

    if (!subscription.needsBilling()) {
      return {
        success: false,
        amount: baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        error: 'Subscription does not need billing yet',
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (discount) {
      discountAmount = discount.calculate(baseAmount);
    }

    const finalAmount = baseAmount - discountAmount;

    // TODO: Process payment
    const paymentId = this.generatePaymentId();

    // Record billing in subscription
    subscription.recordBilling(paymentId);
    // TODO: Save to repository

    return {
      success: true,
      amount: baseAmount,
      discountAmount,
      finalAmount,
      paymentId,
    };
  }

  /**
   * Get subscriptions by criteria
   */
  getSubscriptions(criteria: SubscriptionSearchCriteria): Subscription[] {
    // TODO: Implement repository search
    return [];
  }

  /**
   * Get subscription by ID
   */
  getSubscriptionById(subscriptionId: string): Subscription | null {
    // TODO: Implement repository get by ID
    return null;
  }

  /**
   * Get active subscriptions for a user
   */
  getActiveSubscriptionsForUser(userId: string): Subscription[] {
    return this.getSubscriptions({
      userId,
      status: SubscriptionStatus.ACTIVE,
    });
  }

  /**
   * Check if user can subscribe to a product
   */
  canUserSubscribeToProduct(userId: string, productId: string): boolean {
    const activeSubscriptions = this.getActiveSubscriptionsForUser(userId);
    return !activeSubscriptions.some((sub) => sub.productId === productId);
  }

  /**
   * Calculate renewal discount based on renewal count
   */
  calculateRenewalDiscount(renewalCount: number, amount: number): number {
    if (renewalCount < 1) {
      return 0;
    }

    // 5% per renewal, max 10%
    const discountPercentage = Math.min(renewalCount * 5, 10);
    return Math.round((amount * discountPercentage) / 100);
  }

  /**
   * Get subscriptions that need billing
   */
  getSubscriptionsNeedingBilling(): Subscription[] {
    // TODO: Implement repository query for subscriptions past due date
    return [];
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}