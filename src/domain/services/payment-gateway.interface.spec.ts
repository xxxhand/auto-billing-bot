import { IPaymentGateway, PaymentRequest, PaymentResponse } from './payment-gateway.interface';

describe('PaymentGateway Interface Contract', () => {
  // Mock implementation for testing the interface contract
  class MockPaymentGateway implements IPaymentGateway {
    async charge(request: PaymentRequest): Promise<PaymentResponse> {
      return {
        success: true,
        transactionId: 'mock_txn_123',
        providerResponse: { mock: true }
      };
    }

    async refund(transactionId: string, amount: number, reason?: string): Promise<PaymentResponse> {
      return {
        success: true,
        transactionId: `refund_${transactionId}`,
        providerResponse: { refunded: true }
      };
    }

    getGatewayName(): string {
      return 'mock';
    }
  }

  let gateway: IPaymentGateway;

  beforeEach(() => {
    gateway = new MockPaymentGateway();
  });

  describe('Interface Contract', () => {
    it('should implement charge method', async () => {
      const request: PaymentRequest = {
        attemptId: 'attempt_123',
        userId: 'user_456',
        amount: 1000,
        currency: 'TWD',
        description: 'Test payment',
        metadata: { orderId: 'order_789' }
      };

      const result = await gateway.charge(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.transactionId).toBeDefined();
      expect(result.errorMessage).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should implement refund method', async () => {
      const result = await gateway.refund('txn_123', 500, 'Customer request');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.transactionId).toBeDefined();
    });

    it('should implement getGatewayName method', () => {
      const name = gateway.getGatewayName();

      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('PaymentRequest Structure', () => {
    it('should validate required PaymentRequest fields', () => {
      const request: PaymentRequest = {
        attemptId: 'attempt_123',
        userId: 'user_456',
        amount: 1000,
        currency: 'TWD',
        description: 'Test payment'
      };

      expect(request.attemptId).toBeDefined();
      expect(request.userId).toBeDefined();
      expect(request.amount).toBeGreaterThan(0);
      expect(request.currency).toBeDefined();
      expect(request.description).toBeDefined();
    });

    it('should allow optional metadata in PaymentRequest', () => {
      const request: PaymentRequest = {
        attemptId: 'attempt_123',
        userId: 'user_456',
        amount: 1000,
        currency: 'TWD',
        description: 'Test payment',
        metadata: { orderId: 'order_789', source: 'web' }
      };

      expect(request.metadata).toBeDefined();
      expect(request.metadata?.orderId).toBe('order_789');
      expect(request.metadata?.source).toBe('web');
    });
  });

  describe('PaymentResponse Structure', () => {
    it('should validate PaymentResponse structure for success', () => {
      const response: PaymentResponse = {
        success: true,
        transactionId: 'txn_123',
        providerResponse: { confirmed: true }
      };

      expect(response.success).toBe(true);
      expect(response.transactionId).toBeDefined();
      expect(response.errorMessage).toBeUndefined();
      expect(response.errorCode).toBeUndefined();
    });

    it('should validate PaymentResponse structure for failure', () => {
      const response: PaymentResponse = {
        success: false,
        errorMessage: 'Insufficient funds',
        errorCode: 'INSUFFICIENT_FUNDS',
        providerResponse: { error: 'balance_too_low' }
      };

      expect(response.success).toBe(false);
      expect(response.transactionId).toBeUndefined();
      expect(response.errorMessage).toBeDefined();
      expect(response.errorCode).toBeDefined();
    });
  });
});