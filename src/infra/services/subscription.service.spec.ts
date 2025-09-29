import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { CommonService } from '@myapp/common';
import { Subscription, SubscriptionStatus } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let productRepository: jest.Mocked<ProductRepository>;

  beforeEach(async () => {
    const mockSubscriptionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findDueSubscriptions: jest.fn(),
    };

    const mockProductRepository = {
      findById: jest.fn(),
    };

    const mockCommonService = {
      getDefaultLogger: jest.fn().mockReturnValue({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: SubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        {
          provide: ProductRepository,
          useValue: mockProductRepository,
        },
        {
          provide: CommonService,
          useValue: mockCommonService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepository = module.get(SubscriptionRepository);
    productRepository = module.get(ProductRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const product = Object.assign(new Product(), {
        id: 'product-1',
        name: 'Premium Plan',
        cycleType: 'monthly' as const,
        price: 29.99,
      });

      const subscriptionData = {
        userId: 'user-123',
        productId: 'product-1',
        couponCode: 'DISCOUNT10',
      };

      const expectedSubscription = new Subscription();
      Object.assign(expectedSubscription, {
        ...subscriptionData,
        startDate: expect.any(String),
        nextBillingDate: expect.any(String),
        status: 'pending',
        createdAt: expect.any(String),
        renewalCount: 0,
      });
      expectedSubscription.id = 'mock-id';

      productRepository.findById.mockResolvedValue(product);
      subscriptionRepository.save.mockResolvedValue(expectedSubscription);

      const result = await service.createSubscription(subscriptionData);

      expect(productRepository.findById).toHaveBeenCalledWith('product-1');
      expect(subscriptionRepository.save).toHaveBeenCalled();
      expect(result).toEqual(expectedSubscription);
    });

    it('should throw error if product not found', async () => {
      productRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.createSubscription({
          userId: 'user-123',
          productId: 'non-existent',
        }),
      ).rejects.toThrow('Product not found');
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return user subscriptions', async () => {
      const subscriptions = [
        Object.assign(new Subscription(), {
          id: '1',
          userId: 'user-123',
          productId: 'product-1',
          status: 'active' as SubscriptionStatus,
        }),
      ];

      subscriptionRepository.findByUserId.mockResolvedValue(subscriptions);

      const result = await service.getUserSubscriptions('user-123');

      expect(subscriptionRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(subscriptions);
    });
  });

  describe('getSubscriptionById', () => {
    it('should return subscription by id', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        userId: 'user-123',
        status: 'active' as SubscriptionStatus,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);

      const result = await service.getSubscriptionById('1');

      expect(subscriptionRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(subscription);
    });
  });

  describe('activateSubscription', () => {
    it('should activate a pending subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        status: 'pending' as SubscriptionStatus,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.activateSubscription('1');

      expect(subscription.status).toBe('active');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
      expect(result).toBe(true);
    });

    it('should return false if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.activateSubscription('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        status: 'active' as SubscriptionStatus,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.cancelSubscription('1');

      expect(subscription.status).toBe('cancelled');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
      expect(result).toBe(true);
    });

    it('should return false if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.cancelSubscription('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('requestRefund', () => {
    it('should request refund for active subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        status: 'active' as SubscriptionStatus,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.requestRefund('1');

      expect(subscription.status).toBe('refunding');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
      expect(result).toBe(true);
    });

    it('should return false if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.requestRefund('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('switchPlan', () => {
    it('should switch subscription plan', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        productId: 'old-product',
        nextBillingDate: '2024-01-01T00:00:00.000Z',
      });

      const newProduct = Object.assign(new Product(), {
        id: 'new-product',
        cycleType: 'yearly' as const,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(newProduct);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.switchPlan('1', 'new-product');

      expect(subscription.productId).toBe('new-product');
      expect(subscription.nextBillingDate).not.toBe('2024-01-01T00:00:00.000Z');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
      expect(result).toBe(true);
    });

    it('should return false if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.switchPlan('non-existent', 'new-product');

      expect(result).toBe(false);
    });

    it('should return false if product not found', async () => {
      const subscription = Object.assign(new Subscription(), { id: '1' });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(undefined);

      const result = await service.switchPlan('1', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('renewSubscription', () => {
    it('should renew an active subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: '1',
        status: 'active' as SubscriptionStatus,
        renewalCount: 1,
        nextBillingDate: '2024-01-01T00:00:00.000Z',
      });

      const product = Object.assign(new Product(), {
        id: 'product-1',
        cycleType: 'monthly' as const,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(product);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.renewSubscription('1');

      expect(subscription.renewalCount).toBe(2);
      expect(subscription.nextBillingDate).not.toBe('2024-01-01T00:00:00.000Z');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
      expect(result).toBe(true);
    });

    it('should return false if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.renewSubscription('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getDueSubscriptions', () => {
    it('should return subscriptions due for billing', async () => {
      const dueDate = '2024-01-15T00:00:00.000Z';
      const subscriptions = [
        Object.assign(new Subscription(), {
          id: '1',
          status: 'active' as SubscriptionStatus,
          nextBillingDate: '2024-01-10T00:00:00.000Z',
        }),
      ];

      subscriptionRepository.findDueSubscriptions.mockResolvedValue(subscriptions);

      const result = await service.getDueSubscriptions(dueDate);

      expect(subscriptionRepository.findDueSubscriptions).toHaveBeenCalledWith(dueDate);
      expect(result).toEqual(subscriptions);
    });
  });
});
