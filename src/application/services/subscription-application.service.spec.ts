import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionApplicationService } from './subscription-application.service';
import { SubscriptionService } from '../../infra/services/subscription.service';
import { ProductService } from '../../infra/services/product.service';
import { PaymentService } from '../../infra/services/payment.service';
import { CommonService } from '@myapp/common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';

describe('SubscriptionApplicationService', () => {
  let service: SubscriptionApplicationService;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let productService: jest.Mocked<ProductService>;
  let paymentService: jest.Mocked<PaymentService>;

  beforeEach(async () => {
    const mockSubscriptionService = {
      createSubscription: jest.fn(),
      getUserSubscriptions: jest.fn(),
      activateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      switchPlan: jest.fn(),
      requestRefund: jest.fn(),
    };

    const mockProductService = {
      getProductById: jest.fn(),
    };

    const mockPaymentService = {
      processPayment: jest.fn(),
    };

    const mockCommonService = {
      getDefaultLogger: jest.fn().mockReturnValue({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      }),
      newResultInstance: jest.fn().mockReturnValue({
        withResult: jest.fn().mockReturnThis(),
        withTraceId: jest.fn().mockReturnThis(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionApplicationService,
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: ProductService,
          useValue: mockProductService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: CommonService,
          useValue: mockCommonService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionApplicationService>(SubscriptionApplicationService);
    subscriptionService = module.get(SubscriptionService);
    productService = module.get(ProductService);
    paymentService = module.get(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAndActivateSubscription', () => {
    it('should create subscription and process initial payment', async () => {
      const subscriptionData = {
        userId: 'user-123',
        productId: 'prod-1',
        couponCode: 'WELCOME10',
      };

      const product = Object.assign(new Product(), {
        id: 'prod-1',
        name: 'Premium Plan',
        price: 29.99,
      });

      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        ...subscriptionData,
        status: 'pending',
      });

      const paymentResult = new PaymentResult('success', 0, true, false);

      subscriptionService.createSubscription.mockResolvedValue(subscription);
      productService.getProductById.mockResolvedValue(product);
      paymentService.processPayment.mockResolvedValue(paymentResult);
      subscriptionService.activateSubscription.mockResolvedValue(true);

      const result = await service.createAndActivateSubscription(subscriptionData);

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(subscriptionData);
      expect(paymentService.processPayment).toHaveBeenCalledWith('sub-1', true);
      expect(subscriptionService.activateSubscription).toHaveBeenCalledWith('sub-1');
      expect(result.subscription).toEqual(subscription);
      expect(result.paymentResult).toEqual(paymentResult);
      expect(result.success).toBe(true);
    });

    it('should return failed result if payment fails', async () => {
      const subscriptionData = {
        userId: 'user-123',
        productId: 'prod-1',
      };

      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        ...subscriptionData,
        status: 'pending',
      });

      const paymentResult = new PaymentResult('failed', 0, true, false, 'Payment declined');

      subscriptionService.createSubscription.mockResolvedValue(subscription);
      paymentService.processPayment.mockResolvedValue(paymentResult);

      const result = await service.createAndActivateSubscription(subscriptionData);

      expect(result.success).toBe(false);
      expect(result.paymentResult).toEqual(paymentResult);
      expect(subscriptionService.activateSubscription).not.toHaveBeenCalled();
    });
  });

  describe('cancelUserSubscription', () => {
    it('should cancel user subscription and process refund if requested', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-123',
        status: 'active' as const,
      });

      subscriptionService.getUserSubscriptions.mockResolvedValue([subscription]);
      subscriptionService.cancelSubscription.mockResolvedValue(true);
      subscriptionService.requestRefund.mockResolvedValue(true);

      const result = await service.cancelUserSubscription('user-123', 'sub-1', true);

      expect(subscriptionService.getUserSubscriptions).toHaveBeenCalledWith('user-123');
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith('sub-1');
      expect(subscriptionService.requestRefund).toHaveBeenCalledWith('sub-1');
      expect(result.success).toBe(true);
    });

    it('should return false if subscription not found for user', async () => {
      subscriptionService.getUserSubscriptions.mockResolvedValue([]);

      const result = await service.cancelUserSubscription('user-123', 'sub-1', false);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found or does not belong to user');
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription to new product', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-123',
        productId: 'old-prod',
      });

      const newProduct = Object.assign(new Product(), {
        id: 'new-prod',
        name: 'Premium Plan',
        price: 49.99,
      });

      subscriptionService.getUserSubscriptions.mockResolvedValue([subscription]);
      productService.getProductById.mockResolvedValue(newProduct);
      subscriptionService.switchPlan.mockResolvedValue(true);

      const result = await service.upgradeSubscription('user-123', 'sub-1', 'new-prod');

      expect(subscriptionService.switchPlan).toHaveBeenCalledWith('sub-1', 'new-prod');
      expect(result.success).toBe(true);
    });

    it('should return false if new product not found', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-123',
      });

      subscriptionService.getUserSubscriptions.mockResolvedValue([subscription]);
      productService.getProductById.mockResolvedValue(undefined);

      const result = await service.upgradeSubscription('user-123', 'sub-1', 'non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('New product not found');
    });
  });
});
