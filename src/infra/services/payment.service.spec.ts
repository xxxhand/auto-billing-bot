import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PaymentHistoryRepository } from '../../infra/repositories/payment-history.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { Subscription } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentHistoryRepository: jest.Mocked<PaymentHistoryRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let productRepository: jest.Mocked<ProductRepository>;

  beforeEach(async () => {
    const mockPaymentHistoryRepository = {
      save: jest.fn(),
      findBySubscriptionId: jest.fn(),
    };

    const mockSubscriptionRepository = {
      findById: jest.fn(),
    };

    const mockProductRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PaymentHistoryRepository,
          useValue: mockPaymentHistoryRepository,
        },
        {
          provide: SubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        {
          provide: ProductRepository,
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentHistoryRepository = module.get(PaymentHistoryRepository);
    subscriptionRepository = module.get(SubscriptionRepository);
    productRepository = module.get(ProductRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should process manual payment successfully', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-1',
        productId: 'prod-1',
        status: 'pending' as const,
      });

      const product = Object.assign(new Product(), {
        id: 'prod-1',
        price: 29.99,
        discountPercentage: 10,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(product);
      paymentHistoryRepository.save.mockResolvedValue();

      const result = await service.processPayment('sub-1', true);

      expect(result.status).toBe('success');
      expect(result.isManual).toBe(true);
      expect(result.isAuto).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(paymentHistoryRepository.save).toHaveBeenCalledWith(
        result,
        'sub-1',
        26.99, // 29.99 * 0.9 rounded to 2 decimal places
      );
    });

    it('should process auto payment successfully', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-1',
        productId: 'prod-1',
        status: 'active' as const,
      });

      const product = Object.assign(new Product(), {
        id: 'prod-1',
        price: 29.99,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(product);
      paymentHistoryRepository.save.mockResolvedValue();

      const result = await service.processPayment('sub-1', false);

      expect(result.status).toBe('success');
      expect(result.isManual).toBe(false);
      expect(result.isAuto).toBe(true);
      expect(result.retryCount).toBe(0);
    });

    it('should fail payment if subscription not found', async () => {
      subscriptionRepository.findById.mockResolvedValue(undefined);

      const result = await service.processPayment('non-existent', true);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Subscription not found');
    });

    it('should fail payment if product not found', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        productId: 'prod-1',
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(undefined);

      const result = await service.processPayment('sub-1', true);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Product not found');
    });
  });

  describe('retryPayment', () => {
    it('should retry payment with increased retry count', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        productId: 'prod-1',
      });

      const product = Object.assign(new Product(), {
        id: 'prod-1',
        price: 29.99,
      });

      subscriptionRepository.findById.mockResolvedValue(subscription);
      productRepository.findById.mockResolvedValue(product);
      paymentHistoryRepository.save.mockResolvedValue();

      const result = await service.retryPayment('sub-1', 2);

      expect(result.status).toBe('success');
      expect(result.retryCount).toBe(3); // 2 + 1
      expect(result.isAuto).toBe(true);
      expect(result.isManual).toBe(false);
    });

    it('should fail retry if max retries exceeded', async () => {
      const result = await service.retryPayment('sub-1', 5);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Max retry attempts exceeded');
      expect(result.retryCount).toBe(5);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for subscription', async () => {
      const paymentResults = [new PaymentResult('success', 0, false, true), new PaymentResult('failed', 1, false, true, 'Payment declined')];

      paymentHistoryRepository.findBySubscriptionId.mockResolvedValue(paymentResults);

      const result = await service.getPaymentHistory('sub-1');

      expect(paymentHistoryRepository.findBySubscriptionId).toHaveBeenCalledWith('sub-1');
      expect(result).toEqual(paymentResults);
    });
  });

  describe('calculatePaymentAmount', () => {
    it('should calculate amount with subscription discount', () => {
      const subscription = Object.assign(new Subscription(), {
        renewalCount: 1,
        couponCode: 'SAVE20',
      });

      const product = Object.assign(new Product(), {
        price: 100,
        discountPercentage: 10,
      });

      const result = service.calculatePaymentAmount(subscription, product, 5, 20);

      expect(result).toBe(72); // 100 * 0.9 * 0.8 = 72
    });

    it('should calculate amount without discounts', () => {
      const subscription = Object.assign(new Subscription(), {
        renewalCount: 0,
      });

      const product = Object.assign(new Product(), {
        price: 50,
      });

      const result = service.calculatePaymentAmount(subscription, product, 0, 0);

      expect(result).toBe(50);
    });
  });
});
