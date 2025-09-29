import { Test, TestingModule } from '@nestjs/testing';
import { AutoBillingService } from './auto-billing.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { Subscription } from '../../domain/entities/subscription.entity';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';

describe('AutoBillingService', () => {
  let service: AutoBillingService;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let paymentService: jest.Mocked<PaymentService>;

  beforeEach(async () => {
    const mockSubscriptionService = {
      getDueSubscriptions: jest.fn(),
      renewSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    };

    const mockPaymentService = {
      processPayment: jest.fn(),
      retryPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoBillingService,
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    service = module.get<AutoBillingService>(AutoBillingService);
    subscriptionService = module.get(SubscriptionService);
    paymentService = module.get(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processAutoBilling', () => {
    it('should process auto billing for due subscriptions', async () => {
      const dueSubscriptions = [
        Object.assign(new Subscription(), {
          id: 'sub-1',
          userId: 'user-1',
          status: 'active' as const,
        }),
        Object.assign(new Subscription(), {
          id: 'sub-2',
          userId: 'user-2',
          status: 'active' as const,
        }),
      ];

      const successfulPayment = new PaymentResult('success', 0, false, true);
      const failedPayment = new PaymentResult('failed', 0, false, true, 'Payment declined');

      subscriptionService.getDueSubscriptions.mockResolvedValue(dueSubscriptions);
      paymentService.processPayment.mockResolvedValueOnce(successfulPayment).mockResolvedValueOnce(failedPayment);

      subscriptionService.renewSubscription.mockResolvedValue(true);

      const result = await service.processAutoBilling();

      expect(subscriptionService.getDueSubscriptions).toHaveBeenCalled();
      expect(paymentService.processPayment).toHaveBeenCalledTimes(2);
      expect(subscriptionService.renewSubscription).toHaveBeenCalledWith('sub-1');
      expect(result.successfulPayments).toBe(1);
      expect(result.failedPayments).toBe(1);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle empty due subscriptions', async () => {
      subscriptionService.getDueSubscriptions.mockResolvedValue([]);

      const result = await service.processAutoBilling();

      expect(result.successfulPayments).toBe(0);
      expect(result.failedPayments).toBe(0);
      expect(result.totalProcessed).toBe(0);
    });
  });

  describe('processFailedPayment', () => {
    it('should retry failed payment and renew on success', async () => {
      const retryPayment = new PaymentResult('success', 1, false, true);

      subscriptionService.renewSubscription.mockResolvedValue(true);
      paymentService.retryPayment.mockResolvedValue(retryPayment);

      const result = await service.processFailedPayment('sub-1', 0);

      expect(paymentService.retryPayment).toHaveBeenCalledWith('sub-1', 0);
      expect(subscriptionService.renewSubscription).toHaveBeenCalledWith('sub-1');
      expect(result).toBe(true);
    });

    it('should cancel subscription after max retries', async () => {
      const failedRetry = new PaymentResult('failed', 3, false, true, 'Max retry attempts exceeded');

      paymentService.retryPayment.mockResolvedValue(failedRetry);
      subscriptionService.cancelSubscription.mockResolvedValue(true);

      const result = await service.processFailedPayment('sub-1', 2);

      expect(paymentService.retryPayment).toHaveBeenCalledWith('sub-1', 2);
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith('sub-1');
      expect(result).toBe(false);
    });

    it('should return false if retry payment fails and not at max retries', async () => {
      const failedRetry = new PaymentResult('failed', 1, false, true, 'Payment declined');

      paymentService.retryPayment.mockResolvedValue(failedRetry);

      const result = await service.processFailedPayment('sub-1', 0);

      expect(result).toBe(false);
      expect(subscriptionService.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  describe('getBillingSummary', () => {
    it('should return billing summary for date range', async () => {
      const dueSubscriptions = [
        Object.assign(new Subscription(), {
          id: 'sub-1',
          status: 'active' as const,
        }),
        Object.assign(new Subscription(), {
          id: 'sub-2',
          status: 'cancelled' as const,
        }),
      ];

      subscriptionService.getDueSubscriptions.mockResolvedValue(dueSubscriptions);

      const result = await service.getBillingSummary('2024-01-01', '2024-01-31');

      expect(subscriptionService.getDueSubscriptions).toHaveBeenCalledWith('2024-01-31');
      expect(result.totalDueSubscriptions).toBe(2);
      expect(result.activeSubscriptions).toBe(1);
      expect(result.cancelledSubscriptions).toBe(1);
    });
  });
});
