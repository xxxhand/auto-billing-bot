import { Test, TestingModule } from '@nestjs/testing';
import { CommonService } from '@myapp/common';
import { BillingService } from './billing.service';
import { IPaymentGateway, PaymentResponse } from '../../domain/services/payment-gateway.interface';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { ProductRepository } from '../repositories/product.repository';
import { DiscountRepository } from '../repositories/discount.repository';
import { Subscription } from '../../domain/entities/subscription.entity';
import { ProductEntity } from '../../domain/entities/product.entity';
import { Discount } from '../../domain/entities/discount.entity';

describe('BillingService', () => {
  let service: BillingService;
  let paymentGateway: jest.Mocked<IPaymentGateway>;
  let taskQueue: jest.Mocked<ITaskQueue>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let paymentAttemptRepository: jest.Mocked<PaymentAttemptRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let commonService: jest.Mocked<CommonService>;
  let discountRepository: jest.Mocked<DiscountRepository>;

  beforeEach(async () => {
    const mockPaymentGateway = {
      charge: jest.fn(),
      refund: jest.fn(),
      getGatewayName: jest.fn(),
    };

    const mockTaskQueue = {
      publishTask: jest.fn(),
      consumeTasks: jest.fn(),
      acknowledgeTask: jest.fn(),
      rejectTask: jest.fn(),
      getQueueName: jest.fn(),
    };

    const mockSubscriptionRepository = {
      findById: jest.fn(),
      findActiveSubscriptionsDueForBilling: jest.fn(),
      save: jest.fn(),
    };

    const mockPaymentAttemptRepository = {
      findById: jest.fn(),
      findBySubscriptionId: jest.fn(),
      save: jest.fn(),
    };

    const mockProductRepository = {
      findByProductId: jest.fn(),
      findAll: jest.fn(),
    };

    const mockDiscountRepository = {
      findAll: jest.fn(),
      findByDiscountId: jest.fn(),
      findApplicableDiscounts: jest.fn(),
      findRenewalDiscounts: jest.fn(),
    };

    const mockCommonService = {
      getDefaultLogger: jest.fn().mockReturnValue({
        log: jest.fn(),
        error: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: 'IPaymentGateway',
          useValue: mockPaymentGateway,
        },
        {
          provide: 'ITaskQueue',
          useValue: mockTaskQueue,
        },
        {
          provide: SubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        {
          provide: PaymentAttemptRepository,
          useValue: mockPaymentAttemptRepository,
        },
        {
          provide: ProductRepository,
          useValue: mockProductRepository,
        },
        {
          provide: DiscountRepository,
          useValue: mockDiscountRepository,
        },
        {
          provide: CommonService,
          useValue: mockCommonService,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    paymentGateway = module.get('IPaymentGateway');
    taskQueue = module.get('ITaskQueue');
    subscriptionRepository = module.get(SubscriptionRepository);
    paymentAttemptRepository = module.get(PaymentAttemptRepository);
    productRepository = module.get(ProductRepository);
    commonService = module.get(CommonService);
    discountRepository = module.get(DiscountRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBilling', () => {
    it('should process successful payment', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(paymentGateway.charge).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should handle payment failure and queue retry', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: false,
        errorCode: 'NETWORK_ERROR',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      taskQueue.publishTask.mockResolvedValue(undefined);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(false);
      expect(result.queuedForRetry).toBe(true);
      expect(taskQueue.publishTask).toHaveBeenCalled();
    });

    it('should handle subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    it('should abort subscription if product not found', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(undefined); // Product not found
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PRODUCT_NOT_FOUND_ABORTED');
      expect(subscription.status).toBe('aborted');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
    });

    it('should apply renewal discount for second and subsequent renewals', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active', 1); // renewalCount = 1
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 200;

      const renewalDiscount = new Discount('renewal_123', 'fixed', 100, 1, new Date(0), new Date(9999, 11, 31), ['prod_123']);

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findRenewalDiscounts.mockResolvedValue([renewalDiscount]);
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(discountRepository.findRenewalDiscounts).toHaveBeenCalledWith('prod_123');
      expect(paymentGateway.charge).toHaveBeenCalledWith({
        attemptId: expect.any(String),
        userId: 'user_123',
        amount: 100, // 200 - 100 discount
        currency: 'TWD',
        description: expect.stringContaining('Subscription billing for sub_123'),
      });
    });
  });

  describe('handlePaymentFailure', () => {
    it('should queue retry for retryable failure', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');

      subscriptionRepository.findById.mockResolvedValue(subscription);
      taskQueue.publishTask.mockResolvedValue(undefined);

      const result = await service.handlePaymentFailure('sub_123', 'NETWORK_ERROR', 0);

      expect(result.queuedForRetry).toBe(true);
      expect(taskQueue.publishTask).toHaveBeenCalled();
    });

    it('should enter grace period for non-retryable failure', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');

      subscriptionRepository.findById.mockResolvedValue(subscription);

      const result = await service.handlePaymentFailure('sub_123', 'CARD_DECLINED', 0);

      expect(result.enteredGracePeriod).toBe(true);
      expect(result.queuedForRetry).toBe(false);
    });
  });

  describe('processBillingTask', () => {
    it('should acknowledge successful task', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);
      taskQueue.acknowledgeTask.mockResolvedValue(undefined);

      const result = await service.processBillingTask('task_123', 'sub_123', 'billing', 0);

      expect(result.success).toBe(true);
      expect(taskQueue.acknowledgeTask).toHaveBeenCalledWith('task_123');
    });

    it('should reject failed task', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: false,
        errorCode: 'CARD_DECLINED',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      taskQueue.rejectTask.mockResolvedValue(undefined);

      const result = await service.processBillingTask('task_123', 'sub_123', 'billing', 0);

      expect(result.success).toBe(false);
      expect(taskQueue.rejectTask).toHaveBeenCalledWith('task_123', false);
    });
  });
});
