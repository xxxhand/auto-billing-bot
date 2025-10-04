import { PaymentAttempt, PaymentAttemptStatus } from './payment-attempt.entity';

describe('PaymentAttempt Entity', () => {
  describe('shouldRetry', () => {
    it('should return true when retryCount is less than 3 and failureReason is retryable', () => {
      // Arrange
      const paymentAttempt = new PaymentAttempt('attempt_123', 'sub_123', PaymentAttemptStatus.FAILED, 'NETWORK_ERROR', 1);

      // Act
      const result = paymentAttempt.shouldRetry();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when retryCount is 3 or more', () => {
      // Arrange
      const paymentAttempt = new PaymentAttempt('attempt_123', 'sub_123', PaymentAttemptStatus.FAILED, 'NETWORK_ERROR', 3);

      // Act
      const result = paymentAttempt.shouldRetry();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when failureReason is not retryable', () => {
      // Arrange
      const paymentAttempt = new PaymentAttempt('attempt_123', 'sub_123', PaymentAttemptStatus.FAILED, 'INSUFFICIENT_FUNDS', 1);

      // Act
      const result = paymentAttempt.shouldRetry();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when status is not failed', () => {
      // Arrange
      const paymentAttempt = new PaymentAttempt('attempt_123', 'sub_123', PaymentAttemptStatus.SUCCESS, 'NETWORK_ERROR', 1);

      // Act
      const result = paymentAttempt.shouldRetry();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when retryCount is 2 and failureReason is retryable', () => {
      // Arrange
      const paymentAttempt = new PaymentAttempt('attempt_123', 'sub_123', PaymentAttemptStatus.FAILED, 'GATEWAY_TIMEOUT', 2);

      // Act
      const result = paymentAttempt.shouldRetry();

      // Assert
      expect(result).toBe(true);
    });
  });
});
