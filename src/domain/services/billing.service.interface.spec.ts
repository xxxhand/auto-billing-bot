import { Test, TestingModule } from '@nestjs/testing';
import { IBillingService, BillingResult } from './billing.service.interface';

describe('IBillingService Interface Contract', () => {
  let billingService: IBillingService;

  // Mock implementation for testing the interface contract
  const mockBillingService: IBillingService = {
    processBilling: jest.fn(),
    handlePaymentFailure: jest.fn(),
    processBillingTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'IBillingService',
          useValue: mockBillingService,
        },
      ],
    }).compile();

    billingService = module.get<IBillingService>('IBillingService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBilling', () => {
    it('should define processBilling method', () => {
      expect(typeof billingService.processBilling).toBe('function');
    });

    it('should accept subscriptionId and optional isRetry parameter', async () => {
      (billingService.processBilling as jest.Mock).mockResolvedValue({
        success: true,
      } as BillingResult);

      await expect(billingService.processBilling('sub_123')).resolves.toBeDefined();
      await expect(billingService.processBilling('sub_123', true)).resolves.toBeDefined();
    });

    it('should return a BillingResult', async () => {
      const result: BillingResult = {
        success: true,
        transactionId: 'txn_123',
      };

      (billingService.processBilling as jest.Mock).mockResolvedValue(result);

      const response = await billingService.processBilling('sub_123');
      expect(response).toEqual(result);
      expect(response.success).toBe(true);
      expect(response.transactionId).toBe('txn_123');
    });
  });

  describe('handlePaymentFailure', () => {
    it('should define handlePaymentFailure method', () => {
      expect(typeof billingService.handlePaymentFailure).toBe('function');
    });

    it('should accept subscriptionId, failureReason, and retryCount parameters', async () => {
      (billingService.handlePaymentFailure as jest.Mock).mockResolvedValue({
        success: false,
        queuedForRetry: true,
      } as BillingResult);

      await expect(
        billingService.handlePaymentFailure('sub_123', 'network_error', 1),
      ).resolves.toBeDefined();
    });

    it('should return a BillingResult', async () => {
      const result: BillingResult = {
        success: false,
        errorMessage: 'Payment failed',
        queuedForRetry: true,
      };

      (billingService.handlePaymentFailure as jest.Mock).mockResolvedValue(result);

      const response = await billingService.handlePaymentFailure('sub_123', 'network_error', 1);
      expect(response).toEqual(result);
      expect(response.success).toBe(false);
      expect(response.queuedForRetry).toBe(true);
    });
  });

  describe('processBillingTask', () => {
    it('should define processBillingTask method', () => {
      expect(typeof billingService.processBillingTask).toBe('function');
    });

    it('should accept taskId, subscriptionId, taskType, and retryCount parameters', async () => {
      (billingService.processBillingTask as jest.Mock).mockResolvedValue({
        success: true,
      } as BillingResult);

      await expect(
        billingService.processBillingTask('task_123', 'sub_123', 'billing', 0),
      ).resolves.toBeDefined();
    });

    it('should return a BillingResult', async () => {
      const result: BillingResult = {
        success: true,
        transactionId: 'txn_123',
      };

      (billingService.processBillingTask as jest.Mock).mockResolvedValue(result);

      const response = await billingService.processBillingTask('task_123', 'sub_123', 'billing', 0);
      expect(response).toEqual(result);
      expect(response.success).toBe(true);
    });
  });

  describe('BillingResult structure', () => {
    it('should support success result', () => {
      const result: BillingResult = {
        success: true,
        transactionId: 'txn_123',
      };

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_123');
      expect(result.errorMessage).toBeUndefined();
      expect(result.queuedForRetry).toBeUndefined();
    });

    it('should support failure with retry result', () => {
      const result: BillingResult = {
        success: false,
        errorMessage: 'Network error',
        errorCode: 'NETWORK_ERROR',
        queuedForRetry: true,
        enteredGracePeriod: false,
      };

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network error');
      expect(result.queuedForRetry).toBe(true);
      expect(result.enteredGracePeriod).toBe(false);
    });

    it('should support failure with grace period result', () => {
      const result: BillingResult = {
        success: false,
        errorMessage: 'Card declined',
        errorCode: 'CARD_DECLINED',
        queuedForRetry: false,
        enteredGracePeriod: true,
      };

      expect(result.success).toBe(false);
      expect(result.enteredGracePeriod).toBe(true);
      expect(result.queuedForRetry).toBe(false);
    });
  });
});