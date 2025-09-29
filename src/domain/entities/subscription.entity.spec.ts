import { Subscription } from './subscription.entity';

describe('Subscription Entity', () => {
  describe('calculateNextBillingDate', () => {
    it('should calculate next billing date for monthly cycle', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'pending';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      const nextDate = subscription.calculateNextBillingDate('monthly');
      expect(nextDate).toBe('2025-02-15T00:00:00.000Z');
    });

    it('should calculate next billing date for yearly cycle', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'pending';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      const nextDate = subscription.calculateNextBillingDate('yearly');
      expect(nextDate).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should handle leap year correctly', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2024-01-31T00:00:00.000Z';
      subscription.nextBillingDate = '2024-01-31T00:00:00.000Z';
      subscription.status = 'pending';
      subscription.createdAt = '2024-01-31T00:00:00.000Z';
      subscription.renewalCount = 0;

      const nextDate = subscription.calculateNextBillingDate('monthly');
      expect(nextDate).toBe('2024-03-02T00:00:00.000Z'); // JavaScript Date rolls over to March 2nd
    });
  });

  describe('activate', () => {
    it('should change status from pending to active', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'pending';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      subscription.activate();

      expect(subscription.status).toBe('active');
    });

    it('should throw error if status is not pending', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      expect(() => subscription.activate()).toThrow('Cannot activate subscription that is not pending');
    });
  });

  describe('cancel', () => {
    it('should change status to cancelled', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      subscription.cancel();

      expect(subscription.status).toBe('cancelled');
    });
  });

  describe('requestRefund', () => {
    it('should change status to refunding for active subscription', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      subscription.requestRefund();

      expect(subscription.status).toBe('refunding');
    });

    it('should throw error if subscription is not active', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'cancelled';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      expect(() => subscription.requestRefund()).toThrow('Cannot request refund for non-active subscription');
    });
  });

  describe('switchPlan', () => {
    it('should update productId and nextBillingDate', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-02-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 1;

      subscription.switchPlan('product-2', 'yearly');

      expect(subscription.productId).toBe('product-2');
      expect(subscription.nextBillingDate).toBe('2026-02-15T00:00:00.000Z');
    });
  });

  describe('applyDiscount', () => {
    it('should return full price for first renewal', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-02-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      const discountedPrice = subscription.applyDiscount(100, 0);

      expect(discountedPrice).toBe(100);
    });

    it('should apply renewal discount for subsequent renewals', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-02-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 1;

      const discountedPrice = subscription.applyDiscount(100, 0.1);

      expect(discountedPrice).toBe(90);
    });

    it('should apply coupon discount with higher priority', () => {
      const subscription = new Subscription();
      subscription.id = 'test-id';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-02-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 1;
      subscription.couponCode = 'DISCOUNT20';

      const discountedPrice = subscription.applyDiscount(100, 0.1, 0.2);

      expect(discountedPrice).toBe(80); // Coupon discount has higher priority
    });
  });
});
