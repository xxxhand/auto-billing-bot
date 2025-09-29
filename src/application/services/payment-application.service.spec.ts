import { Test, TestingModule } from '@nestjs/testing';
import { PaymentApplicationService } from './payment-application.service';
import { PaymentService } from '../../infra/services/payment.service';
import { SubscriptionService } from '../../infra/services/subscription.service';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';
import { Subscription } from '../../domain/entities/subscription.entity';

describe('PaymentApplicationService', () => {
  let service: PaymentApplicationService;
  let paymentService: jest.Mocked<PaymentService>;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(async () => {
    const mockPaymentService = {
      processPayment: jest.fn(),
      getPaymentHistory: jest.fn(),
      calculatePaymentAmount: jest.fn(),
    };

    const mockSubscriptionService = {
      getSubscriptionById: jest.fn(),
      renewSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentApplicationService,
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
      ],
    }).compile();

    service = module.get<PaymentApplicationService>(PaymentApplicationService);
    paymentService = module.get(PaymentService);
    subscriptionService = module.get(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processManualPayment', () => {
    it('should process manual payment for subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-1',
        status: 'active' as const,
      });

      const paymentResult = new PaymentResult('success', 0, true, false);

      subscriptionService.getSubscriptionById.mockResolvedValue(subscription);
      paymentService.processPayment.mockResolvedValue(paymentResult);
      subscriptionService.renewSubscription.mockResolvedValue(true);

      const result = await service.processManualPayment('sub-1');

      expect(subscriptionService.getSubscriptionById).toHaveBeenCalledWith('sub-1');
      expect(paymentService.processPayment).toHaveBeenCalledWith('sub-1', true);
      expect(subscriptionService.renewSubscription).toHaveBeenCalledWith('sub-1');
      expect(result.success).toBe(true);
      expect(result.paymentResult).toEqual(paymentResult);
    });

    it('should return failed result if subscription not found', async () => {
      subscriptionService.getSubscriptionById.mockResolvedValue(undefined);

      const result = await service.processManualPayment('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
    });

    it('should return failed result if payment fails', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        status: 'active' as const,
      });

      const paymentResult = new PaymentResult('failed', 0, true, false, 'Payment declined');

      subscriptionService.getSubscriptionById.mockResolvedValue(subscription);
      paymentService.processPayment.mockResolvedValue(paymentResult);

      const result = await service.processManualPayment('sub-1');

      expect(result.success).toBe(false);
      expect(result.paymentResult).toEqual(paymentResult);
      expect(subscriptionService.renewSubscription).not.toHaveBeenCalled();
    });
  });

  describe('getSubscriptionPaymentHistory', () => {
    it('should return payment history for subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        userId: 'user-1',
      });

      const paymentHistory = [new PaymentResult('success', 0, true, false), new PaymentResult('failed', 1, false, true, 'Payment declined')];

      subscriptionService.getSubscriptionById.mockResolvedValue(subscription);
      paymentService.getPaymentHistory.mockResolvedValue(paymentHistory);

      const result = await service.getSubscriptionPaymentHistory('sub-1');

      expect(subscriptionService.getSubscriptionById).toHaveBeenCalledWith('sub-1');
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('sub-1');
      expect(result.success).toBe(true);
      expect(result.paymentHistory).toEqual(paymentHistory);
    });

    it('should return failed result if subscription not found', async () => {
      subscriptionService.getSubscriptionById.mockResolvedValue(undefined);

      const result = await service.getSubscriptionPaymentHistory('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
    });
  });

  describe('calculateNextPaymentAmount', () => {
    it('should calculate next payment amount for subscription', async () => {
      const subscription = Object.assign(new Subscription(), {
        id: 'sub-1',
        productId: 'prod-1',
        renewalCount: 2,
        couponCode: 'RENEWAL10',
      });

      subscriptionService.getSubscriptionById.mockResolvedValue(subscription);
      paymentService.calculatePaymentAmount.mockReturnValue(85); // 100 * 0.9 (coupon) - no renewal discount applied

      const result = await service.calculateNextPaymentAmount('sub-1');

      expect(subscriptionService.getSubscriptionById).toHaveBeenCalledWith('sub-1');
      expect(paymentService.calculatePaymentAmount).toHaveBeenCalledWith(
        subscription,
        expect.objectContaining({
          id: 'prod-1',
          price: 100,
          discountPercentage: 0,
        }),
        5, // renewal discount
        10, // coupon discount
      );
      expect(result.success).toBe(true);
      expect(result.amount).toBe(85);
    });

    it('should return failed result if subscription not found', async () => {
      subscriptionService.getSubscriptionById.mockResolvedValue(undefined);

      const result = await service.calculateNextPaymentAmount('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
    });
  });
});
