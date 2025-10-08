import { Test, TestingModule } from '@nestjs/testing';
import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentRequest } from '../../domain/services/payment-gateway.interface';

describe('MockPaymentGateway', () => {
  let gateway: MockPaymentGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockPaymentGateway],
    }).compile();

    gateway = module.get<MockPaymentGateway>(MockPaymentGateway);
  });

  describe('getGatewayName', () => {
    it('should return "mock"', () => {
      expect(gateway.getGatewayName()).toBe('mock');
    });
  });

  describe('charge', () => {
    it('should successfully process a payment', async () => {
      // Use a request that should result in success
      const request: PaymentRequest = {
        attemptId: 'success_test_001',
        userId: 'user_success_001',
        amount: 1000,
        currency: 'TWD',
        description: 'Test successful payment'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(true);
      expect(response.transactionId).toBeDefined();
      expect(response.transactionId).toMatch(/^mock_txn_\d+_\d+$/);
      expect(response.errorMessage).toBeUndefined();
      expect(response.errorCode).toBeUndefined();
      expect(response.providerResponse).toBeDefined();
      expect(response.providerResponse.status).toBe('completed');
      expect(response.providerResponse.amount).toBe(1000);
      expect(response.providerResponse.currency).toBe('TWD');
    });

    it('should fail with insufficient funds', async () => {
      const request: PaymentRequest = {
        attemptId: 'insuff_funds_test_001',
        userId: 'user_insuff',
        amount: 1000,
        currency: 'TWD',
        description: 'Test insufficient funds'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('INSUFFICIENT_FUNDS');
      expect(response.errorMessage).toBe('Insufficient funds');
    });

    it('should fail with network error', async () => {
      const request: PaymentRequest = {
        attemptId: 'network_error_test_001',
        userId: 'user_network_001',
        amount: 1000,
        currency: 'TWD',
        description: 'Test network error'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('NETWORK_ERROR');
      expect(response.errorMessage).toBe('Network connection failed');
    });

    it('should fail with card expired', async () => {
      const request: PaymentRequest = {
        attemptId: 'card_expired_test_001',
        userId: 'user_expired',
        amount: 1000,
        currency: 'TWD',
        description: 'Test card expired'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('CARD_EXPIRED');
      expect(response.errorMessage).toBe('Card has expired');
    });

    it('should fail with invalid card', async () => {
      const request: PaymentRequest = {
        attemptId: 'invalid_card_test_001',
        userId: 'user_invalid',
        amount: 1000,
        currency: 'TWD',
        description: 'Test invalid card'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('INVALID_CARD');
      expect(response.errorMessage).toBe('Invalid card details');
    });

    it('should fail with payment declined', async () => {
      const request: PaymentRequest = {
        attemptId: 'declined_test_001',
        userId: 'user_declined',
        amount: 1000,
        currency: 'TWD',
        description: 'Test payment declined'
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('DECLINED');
      expect(response.errorMessage).toBe('Payment declined by issuer');
    });

    it('should have deterministic behavior for same input', async () => {
      const request: PaymentRequest = {
        attemptId: 'deterministic_test',
        userId: 'user_deterministic',
        amount: 500,
        currency: 'TWD',
        description: 'Deterministic test'
      };

      // Call multiple times with same input
      const response1 = await gateway.charge(request);
      const response2 = await gateway.charge(request);

      // Results should be the same (both success or both same failure)
      expect(response1.success).toBe(response2.success);
      if (response1.success) {
        expect(response1.transactionId).toBeDefined();
        expect(response2.transactionId).toBeDefined();
      } else {
        expect(response1.errorCode).toBe(response2.errorCode);
        expect(response1.errorMessage).toBe(response2.errorMessage);
      }
    });

    it('should include metadata in successful response', async () => {
      const request: PaymentRequest = {
        attemptId: 'attempt_metadata_001',
        userId: 'user_metadata_001',
        amount: 2000,
        currency: 'USD',
        description: 'Test with metadata',
        metadata: { orderId: 'order_123', source: 'web' }
      };

      const response = await gateway.charge(request);

      expect(response.success).toBe(true);
      expect(response.providerResponse.amount).toBe(2000);
      expect(response.providerResponse.currency).toBe('USD');
    });
  });

  describe('refund', () => {
    it('should successfully process a refund', async () => {
      const transactionId = 'original_txn_123';
      const refundAmount = 500;
      const reason = 'Customer requested refund';

      const response = await gateway.refund(transactionId, refundAmount, reason);

      expect(response.success).toBe(true);
      expect(response.transactionId).toBeDefined();
      expect(response.transactionId).toMatch(/^refund_original_txn_123_\d+$/);
      expect(response.providerResponse).toBeDefined();
      expect(response.providerResponse.originalTransactionId).toBe(transactionId);
      expect(response.providerResponse.refundAmount).toBe(refundAmount);
      expect(response.providerResponse.refundReason).toBe(reason);
      expect(response.providerResponse.refundedAt).toBeDefined();
    });

    it('should process refund without reason', async () => {
      const transactionId = 'original_txn_456';
      const refundAmount = 300;

      const response = await gateway.refund(transactionId, refundAmount);

      expect(response.success).toBe(true);
      expect(response.providerResponse.refundReason).toBe('Customer request');
    });

    it('should generate unique refund transaction IDs', async () => {
      const transactionId = 'original_txn_789';
      const refundAmount = 100;

      const response1 = await gateway.refund(transactionId, refundAmount);
      const response2 = await gateway.refund(transactionId, refundAmount);

      expect(response1.transactionId).not.toBe(response2.transactionId);
      expect(response1.transactionId).toMatch(/^refund_original_txn_789_\d+$/);
      expect(response2.transactionId).toMatch(/^refund_original_txn_789_\d+$/);
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time for charge', async () => {
      const request: PaymentRequest = {
        attemptId: 'performance_test',
        userId: 'user_performance',
        amount: 100,
        currency: 'TWD',
        description: 'Performance test'
      };

      const startTime = Date.now();
      await gateway.charge(request);
      const endTime = Date.now();

      // Should complete within 500ms (allowing for some variance)
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should respond within reasonable time for refund', async () => {
      const startTime = Date.now();
      await gateway.refund('txn_perf_test', 100);
      const endTime = Date.now();

      // Should complete within 500ms
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});