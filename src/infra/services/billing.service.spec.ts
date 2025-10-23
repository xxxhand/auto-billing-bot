import { Test, TestingModule } from '@nestjs/testing';
import { CommonService } from '@myapp/common';
import { BillingService } from './billing.service';
import { IPaymentGateway, PaymentResponse } from '../../domain/services/payment-gateway.interface';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { ProductRepository } from '../repositories/product.repository';
import { DiscountRepository } from '../repositories/discount.repository';
import { RulesRepository } from '../repositories/rules.repository';
import { RulesEngineService } from '../../domain/services/rules-engine.service';
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
  let rulesRepository: jest.Mocked<RulesRepository>;
  let rulesEngineService: jest.Mocked<RulesEngineService>;

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

    const mockRulesRepository = {
      findByRuleId: jest.fn(),
      findByType: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      deleteByRuleId: jest.fn(),
      deleteById: jest.fn(),
    };

    const mockRulesEngineService = {
      evaluateRules: jest.fn(),
      filterApplicableRules: jest.fn(),
      validateRules: jest.fn(),
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
          provide: RulesRepository,
          useValue: mockRulesRepository,
        },
        {
          provide: RulesEngineService,
          useValue: mockRulesEngineService,
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
    rulesRepository = module.get(RulesRepository);
    rulesEngineService = module.get(RulesEngineService);
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
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
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
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
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
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      discountRepository.findRenewalDiscounts.mockResolvedValue([renewalDiscount]);
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules for first-time
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
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

    it('should apply applied discount for remaining discount periods', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      subscription.remainingDiscountPeriods = 2;
      subscription.appliedDiscountId = 'disc_123';

      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const appliedDiscount = new Discount('disc_123', 'percentage', 20, 1, new Date(0), new Date(9999, 11, 31), ['prod_123']); // 20% off

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findByDiscountId.mockResolvedValue(appliedDiscount);
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules for first-time
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(discountRepository.findByDiscountId).toHaveBeenCalledWith('disc_123');
      expect(paymentGateway.charge).toHaveBeenCalledWith({
        attemptId: expect.any(String),
        userId: 'user_123',
        amount: 80, // 100 * 0.8 = 80 (20% discount)
        currency: 'TWD',
        description: expect.stringContaining('Subscription billing for sub_123'),
      });
      expect(subscription.remainingDiscountPeriods).toBe(1); // Decreased by 1
      expect(subscription.appliedDiscountId).toBe('disc_123'); // Still set
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should clear applied discount when no periods remaining', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      subscription.remainingDiscountPeriods = 1; // Last period
      subscription.appliedDiscountId = 'disc_123';

      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const appliedDiscount = new Discount('disc_123', 'percentage', 20, 1, new Date(0), new Date(9999, 11, 31), ['prod_123']);

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findByDiscountId.mockResolvedValue(appliedDiscount);
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules for first-time
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(true);
      expect(subscription.remainingDiscountPeriods).toBe(0);
      expect(subscription.appliedDiscountId).toBeNull(); // Cleared
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should clear promoCode after first successful payment', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      subscription.promoCode = 'PROMO123'; // Set promo code
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(subscription.promoCode).toBeNull(); // Promo code should be cleared
      expect(paymentGateway.charge).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should clear promoCode on retry payment success for first-time subscription', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active');
      subscription.promoCode = 'PROMO123'; // Set promo code
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123', true, 1); // isRetry = true

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(subscription.promoCode).toBeNull(); // Promo code should be cleared even on retry for first-time subscription
      expect(paymentGateway.charge).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should not clear promoCode on renewal payment success', async () => {
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', new Date(), new Date(), 'active', 1); // renewalCount = 1 (already renewed once)
      subscription.promoCode = null; // Promo code should already be cleared
      const product = new ProductEntity();
      product.productId = 'prod_123';
      product.price = 100;

      const paymentResponse: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
      };

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findByProductId.mockResolvedValue(product);
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      discountRepository.findRenewalDiscounts.mockResolvedValue([]);
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.processBilling('sub_123'); // isRetry = false

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(subscription.promoCode).toBeNull(); // Promo code should remain null for renewals
      expect(subscription.renewalCount).toBe(2); // Should be incremented
      expect(paymentGateway.charge).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
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
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
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
      discountRepository.findByDiscountId.mockResolvedValue(undefined); // No applied discount
      rulesRepository.findByType.mockResolvedValue([]); // No discount rules
      rulesEngineService.filterApplicableRules.mockReturnValue([]);
      rulesEngineService.evaluateRules.mockReturnValue({
        context: {},
        appliedRules: [],
        totalDiscount: 0,
        totalBonus: 0,
        success: true,
      });
      paymentGateway.charge.mockResolvedValue(paymentResponse);
      paymentAttemptRepository.save.mockResolvedValue(undefined);
      taskQueue.rejectTask.mockResolvedValue(undefined);

      const result = await service.processBillingTask('task_123', 'sub_123', 'billing', 0);

      expect(result.success).toBe(false);
      expect(taskQueue.rejectTask).toHaveBeenCalledWith('task_123', false);
    });
  });
});
