import { validate } from 'class-validator';
import { Subscription, SubscriptionStatus, BillingCycleType } from './subscription.entity';

describe('Subscription Entity', () => {
  let validSubscription: Subscription;

  beforeEach(() => {
    validSubscription = new Subscription('sub-001', 'user-001', 'product-001', BillingCycleType.MONTHLY, new Date('2024-01-01'), SubscriptionStatus.PENDING);
  });

  describe('constructor', () => {
    it('should create a subscription with valid properties', () => {
      expect(validSubscription.id).toBe('sub-001');
      expect(validSubscription.userId).toBe('user-001');
      expect(validSubscription.productId).toBe('product-001');
      expect(validSubscription.status).toBe(SubscriptionStatus.PENDING);
      expect(validSubscription.billingCycle).toBe(BillingCycleType.MONTHLY);
      expect(validSubscription.startDate).toEqual(new Date('2024-01-01'));
      expect(validSubscription.renewalCount).toBe(0);
      expect(validSubscription.nextBillingDate).toBeDefined();
    });

    it('should calculate next billing date correctly for monthly cycle', () => {
      const expectedNextBilling = new Date('2024-02-01');
      expect(validSubscription.nextBillingDate).toEqual(expectedNextBilling);
    });

    it('should calculate next billing date correctly for yearly cycle', () => {
      const yearlySubscription = new Subscription('sub-002', 'user-002', 'product-002', BillingCycleType.YEARLY, new Date('2024-01-01'));
      const expectedNextBilling = new Date('2025-01-01');
      expect(yearlySubscription.nextBillingDate).toEqual(expectedNextBilling);
    });
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const errors = await validate(validSubscription);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty id', async () => {
      const invalidSubscription = new Subscription('', 'user-001', 'product-001', BillingCycleType.MONTHLY);
      const errors = await validate(invalidSubscription);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('status management', () => {
    it('should activate pending subscription', () => {
      validSubscription.activate();
      expect(validSubscription.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should throw error when activating non-pending subscription', () => {
      validSubscription.activate(); // First activate
      expect(() => validSubscription.activate()).toThrow('Only pending subscriptions can be activated');
    });

    it('should cancel subscription', () => {
      validSubscription.activate(); // Need to activate first
      validSubscription.cancel();
      expect(validSubscription.status).toBe(SubscriptionStatus.CANCELLED);
      expect(validSubscription.endDate).toBeDefined();
    });

    it('should throw error when cancelling already cancelled subscription', () => {
      validSubscription.activate();
      validSubscription.cancel();
      expect(() => validSubscription.cancel()).toThrow('Subscription is already cancelled');
    });
  });

  describe('business methods', () => {
    beforeEach(() => {
      validSubscription.activate();
    });

    it('should return true for active subscription', () => {
      expect(validSubscription.isActive()).toBe(true);
    });

    it('should return false for non-active subscription', () => {
      validSubscription.cancel();
      expect(validSubscription.isActive()).toBe(false);
    });

    it('should return true for cancelled subscription', () => {
      validSubscription.cancel();
      expect(validSubscription.isCancelled()).toBe(true);
    });

    it('should return false for non-cancelled subscription', () => {
      expect(validSubscription.isCancelled()).toBe(false);
    });

    it('should record billing correctly', () => {
      const initialRenewalCount = validSubscription.renewalCount;

      validSubscription.recordBilling();

      expect(validSubscription.renewalCount).toBe(initialRenewalCount + 1);
      expect(validSubscription.lastBillingDate).toBeDefined();
      expect(validSubscription.nextBillingDate).toBeDefined();
    });

    it('should calculate subscription days correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');
      const subscription = new Subscription('sub-test', 'user-test', 'product-test', BillingCycleType.MONTHLY, startDate);
      subscription.endDate = endDate;

      const days = subscription.getSubscriptionDays();
      expect(days).toBe(4); // 5 - 1 = 4 days
    });

    it('should calculate subscription days for ongoing subscription', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10); // 10 days ago
      const subscription = new Subscription('sub-test', 'user-test', 'product-test', BillingCycleType.MONTHLY, startDate);

      const days = subscription.getSubscriptionDays();
      expect(days).toBe(10);
    });
  });

  describe('billing cycle calculations', () => {
    it('should calculate next billing date for weekly cycle', () => {
      const subscription = new Subscription('sub-weekly', 'user-weekly', 'product-weekly', BillingCycleType.WEEKLY, new Date('2024-01-01'));
      const expectedNextBilling = new Date('2024-01-08');
      expect(subscription.nextBillingDate).toEqual(expectedNextBilling);
    });

    it('should calculate next billing date for quarterly cycle', () => {
      const subscription = new Subscription('sub-quarterly', 'user-quarterly', 'product-quarterly', BillingCycleType.QUARTERLY, new Date('2024-01-01'));
      const expectedNextBilling = new Date('2024-04-01');
      expect(subscription.nextBillingDate).toEqual(expectedNextBilling);
    });

    it('should handle leap year correctly for yearly billing', () => {
      const subscription = new Subscription('sub-yearly', 'user-yearly', 'product-yearly', BillingCycleType.YEARLY, new Date('2024-01-01')); // 2024 is a leap year
      const expectedNextBilling = new Date('2025-01-01');
      expect(subscription.nextBillingDate).toEqual(expectedNextBilling);
    });
  });

  describe('billing logic', () => {
    it('should not need billing for inactive subscription', () => {
      expect(validSubscription.needsBilling()).toBe(false);
    });

    it('should need billing for active subscription past due date', () => {
      validSubscription.activate();
      // Mock next billing date to be in the past
      validSubscription.nextBillingDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      expect(validSubscription.needsBilling()).toBe(true);
    });

    it('should not need billing for active subscription with future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future
      const subscription = new Subscription('sub-future', 'user-future', 'product-future', BillingCycleType.MONTHLY, futureDate);
      subscription.activate();
      // Next billing date is in the future
      expect(subscription.needsBilling()).toBe(false);
    });
  });
});
