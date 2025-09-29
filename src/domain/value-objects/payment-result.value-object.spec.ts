import { PaymentResult } from './payment-result.value-object';

describe('PaymentResult Value Object', () => {
  describe('successful payment', () => {
    it('should create successful payment result', () => {
      const result = new PaymentResult('success', 0, false, true);

      expect(result.status).toBe('success');
      expect(result.failureReason).toBeUndefined();
      expect(result.retryCount).toBe(0);
      expect(result.isManual).toBe(false);
      expect(result.isAuto).toBe(true);
    });

    it('should create successful manual payment result', () => {
      const result = new PaymentResult('success', 2, true, false);

      expect(result.status).toBe('success');
      expect(result.failureReason).toBeUndefined();
      expect(result.retryCount).toBe(2);
      expect(result.isManual).toBe(true);
      expect(result.isAuto).toBe(false);
    });
  });

  describe('failed payment', () => {
    it('should create failed payment result with reason', () => {
      const result = new PaymentResult('failed', 1, false, true, 'insufficient_funds');

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('insufficient_funds');
      expect(result.retryCount).toBe(1);
      expect(result.isManual).toBe(false);
      expect(result.isAuto).toBe(true);
    });

    it('should create failed payment result without reason', () => {
      const result = new PaymentResult('failed', 0, false, true);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBeUndefined();
      expect(result.retryCount).toBe(0);
      expect(result.isManual).toBe(false);
      expect(result.isAuto).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should track retry count for failed payments', () => {
      const result = new PaymentResult('failed', 3, true, false, 'network_error');

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('network_error');
      expect(result.retryCount).toBe(3);
      expect(result.isManual).toBe(true);
      expect(result.isAuto).toBe(false);
    });

    it('should handle zero retry count', () => {
      const result = new PaymentResult('success', 0, false, true);

      expect(result.retryCount).toBe(0);
    });
  });

  describe('payment type flags', () => {
    it('should correctly set auto payment flag', () => {
      const autoResult = new PaymentResult('success', 0, false, true);
      const manualResult = new PaymentResult('success', 0, true, false);

      expect(autoResult.isAuto).toBe(true);
      expect(autoResult.isManual).toBe(false);
      expect(manualResult.isAuto).toBe(false);
      expect(manualResult.isManual).toBe(true);
    });
  });

  describe('value object equality', () => {
    it('should be equal when all properties are the same', () => {
      const result1 = new PaymentResult('success', 1, true, false);
      const result2 = new PaymentResult('success', 1, true, false);

      expect(result1.status).toBe(result2.status);
      expect(result1.retryCount).toBe(result2.retryCount);
      expect(result1.isManual).toBe(result2.isManual);
      expect(result1.isAuto).toBe(result2.isAuto);
    });

    it('should be different when properties differ', () => {
      const result1 = new PaymentResult('success', 0, false, true);
      const result2 = new PaymentResult('failed', 0, false, true);

      expect(result1.status).not.toBe(result2.status);
    });
  });
});
