import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService, CreateSubscriptionRequest } from './subscription.service';
import { Subscription, SubscriptionStatus, BillingCycleType } from '../entities/subscription.entity';
import { Discount, DiscountType } from '../value-objects/discount.value-object';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionService],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubscription', () => {
    it('should create a subscription with valid data', () => {
      const request: CreateSubscriptionRequest = {
        userId: 'user-001',
        productId: 'product-001',
        billingCycle: BillingCycleType.MONTHLY,
        startDate: new Date('2024-01-01'),
      };

      const subscription = service.createSubscription(request);

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe('user-001');
      expect(subscription.productId).toBe('product-001');
      expect(subscription.billingCycle).toBe(BillingCycleType.MONTHLY);
      expect(subscription.status).toBe(SubscriptionStatus.PENDING);
      expect(subscription.startDate).toEqual(new Date('2024-01-01'));
    });

    it('should create subscription with default start date', () => {
      const request: CreateSubscriptionRequest = {
        userId: 'user-001',
        productId: 'product-001',
        billingCycle: BillingCycleType.YEARLY,
      };

      const subscription = service.createSubscription(request);

      expect(subscription).toBeDefined();
      expect(subscription.billingCycle).toBe(BillingCycleType.YEARLY);
      expect(subscription.startDate).toBeDefined();
    });
  });

  describe('activateSubscription', () => {
    it('should throw error for non-existent subscription', () => {
      expect(() => service.activateSubscription('non-existent')).toThrow('Subscription not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should throw error for non-existent subscription', () => {
      expect(() => service.cancelSubscription('non-existent')).toThrow('Subscription not found');
    });
  });

  describe('suspendSubscription', () => {
    it('should throw error for non-existent subscription', () => {
      expect(() => service.suspendSubscription('non-existent')).toThrow('Subscription not found');
    });
  });

  describe('resumeSubscription', () => {
    it('should throw error for non-existent subscription', () => {
      expect(() => service.resumeSubscription('non-existent')).toThrow('Subscription not found');
    });
  });

  describe('processBilling', () => {
    it('should return error for non-existent subscription', () => {
      const result = service.processBilling('non-existent', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
      expect(result.finalAmount).toBe(100);
    });

    it('should return error for inactive subscription', () => {
      // Mock inactive subscription
      const mockSubscription = new Subscription('sub-001', 'user-001', 'product-001', BillingCycleType.MONTHLY);
      mockSubscription.cancel(); // Make it inactive

      // Mock the getSubscriptionById method
      jest.spyOn(service as any, 'getSubscriptionById').mockReturnValue(mockSubscription);

      const result = service.processBilling('sub-001', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription is not active');
    });

    it('should process billing successfully with discount', () => {
      // Create active subscription with past due date
      const subscription = new Subscription('sub-001', 'user-001', 'product-001', BillingCycleType.MONTHLY, new Date('2024-01-01'));
      subscription.activate();
      subscription.nextBillingDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Past due

      // Mock the getSubscriptionById method
      jest.spyOn(service as any, 'getSubscriptionById').mockReturnValue(subscription);

      const discount = new Discount(DiscountType.PERCENTAGE, 10); // 10% discount
      const result = service.processBilling('sub-001', 100, discount);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(100);
      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount).toBe(90);
      expect(result.paymentId).toBeDefined();
    });

    it('should process billing successfully without discount', () => {
      // Create active subscription with past due date
      const subscription = new Subscription('sub-001', 'user-001', 'product-001', BillingCycleType.MONTHLY, new Date('2024-01-01'));
      subscription.activate();
      subscription.nextBillingDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Past due

      // Mock the getSubscriptionById method
      jest.spyOn(service as any, 'getSubscriptionById').mockReturnValue(subscription);

      const result = service.processBilling('sub-001', 100);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(100);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(100);
      expect(result.paymentId).toBeDefined();
    });
  });

  describe('calculateRenewalDiscount', () => {
    it('should return 0 for first subscription', () => {
      const discount = service.calculateRenewalDiscount(0, 100);
      expect(discount).toBe(0);
    });

    it('should calculate 5% discount for first renewal', () => {
      const discount = service.calculateRenewalDiscount(1, 100);
      expect(discount).toBe(5);
    });

    it('should calculate 10% discount for second renewal', () => {
      const discount = service.calculateRenewalDiscount(2, 100);
      expect(discount).toBe(10);
    });

    it('should cap discount at 10% for high renewal counts', () => {
      const discount = service.calculateRenewalDiscount(5, 100);
      expect(discount).toBe(10);
    });

    it('should handle decimal amounts correctly', () => {
      const discount = service.calculateRenewalDiscount(1, 99);
      expect(discount).toBe(5); // 99 * 0.05 = 4.95, rounded to 5
    });
  });

  describe('getSubscriptions', () => {
    it('should return empty array', () => {
      const result = service.getSubscriptions({});
      expect(result).toEqual([]);
    });
  });

  describe('getSubscriptionById', () => {
    it('should return null for non-existent subscription', () => {
      const result = service.getSubscriptionById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getActiveSubscriptionsForUser', () => {
    it('should return active subscriptions for user', () => {
      const result = service.getActiveSubscriptionsForUser('user-001');
      expect(result).toEqual([]);
    });
  });

  describe('canUserSubscribeToProduct', () => {
    it('should return true when user has no active subscription for product', () => {
      const result = service.canUserSubscribeToProduct('user-001', 'product-001');
      expect(result).toBe(true);
    });
  });

  describe('getSubscriptionsNeedingBilling', () => {
    it('should return empty array', () => {
      const result = service.getSubscriptionsNeedingBilling();
      expect(result).toEqual([]);
    });
  });
});