import { Test, TestingModule } from '@nestjs/testing';
import { PaymentFailureClassifierService, PaymentFailureType } from './payment-failure-classifier.service';

describe('PaymentFailureClassifierService', () => {
  let service: PaymentFailureClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentFailureClassifierService],
    }).compile();

    service = module.get<PaymentFailureClassifierService>(PaymentFailureClassifierService);
  });

  describe('classifyFailure', () => {
    describe('Network and connectivity errors', () => {
      it('should classify network error as retryable', () => {
        const result = service.classifyFailure('NETWORK_ERROR', 'Network connection failed');

        expect(result.failureType).toBe(PaymentFailureType.NETWORK_ERROR);
        expect(result.isRetryable).toBe(true);
        expect(result.maxRetryAttempts).toBe(3);
        expect(result.retryDelayMs).toBe(300000); // 5 minutes
        expect(result.shouldEnterGracePeriod).toBe(false);
        expect(result.description).toBe('Network connectivity issue');
        expect(result.userAction).toBe('Please try again in a few minutes');
      });

      it('should classify gateway timeout as retryable', () => {
        const result = service.classifyFailure('GATEWAY_TIMEOUT', 'Gateway timeout');

        expect(result.failureType).toBe(PaymentFailureType.GATEWAY_TIMEOUT);
        expect(result.isRetryable).toBe(true);
        expect(result.maxRetryAttempts).toBe(2);
        expect(result.retryDelayMs).toBe(600000); // 10 minutes
        expect(result.shouldEnterGracePeriod).toBe(false);
      });

      it('should classify connection timeout as network error', () => {
        const result = service.classifyFailure('CONNECTION_TIMEOUT', 'Connection timed out');

        expect(result.failureType).toBe(PaymentFailureType.NETWORK_ERROR);
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('Card and payment method errors', () => {
      it('should classify insufficient funds as non-retryable', () => {
        const result = service.classifyFailure('INSUFFICIENT_FUNDS', 'Insufficient funds');

        expect(result.failureType).toBe(PaymentFailureType.INSUFFICIENT_FUNDS);
        expect(result.isRetryable).toBe(false);
        expect(result.maxRetryAttempts).toBe(0);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please add funds to your account and try again');
      });

      it('should classify card expired as non-retryable', () => {
        const result = service.classifyFailure('CARD_EXPIRED', 'Card has expired');

        expect(result.failureType).toBe(PaymentFailureType.CARD_EXPIRED);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please update your card details');
      });

      it('should classify invalid card as non-retryable', () => {
        const result = service.classifyFailure('INVALID_CARD', 'Invalid card details');

        expect(result.failureType).toBe(PaymentFailureType.INVALID_CARD);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please check your card details and try again');
      });

      it('should classify card declined as non-retryable', () => {
        const result = service.classifyFailure('DECLINED', 'Payment declined by issuer');

        expect(result.failureType).toBe(PaymentFailureType.CARD_DECLINED);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please contact your card issuer or try a different card');
      });
    });

    describe('System and processing errors', () => {
      it('should classify system error as retryable with limited attempts', () => {
        const result = service.classifyFailure('SYSTEM_ERROR', 'Internal system error');

        expect(result.failureType).toBe(PaymentFailureType.SYSTEM_ERROR);
        expect(result.isRetryable).toBe(true);
        expect(result.maxRetryAttempts).toBe(1);
        expect(result.retryDelayMs).toBe(1800000); // 30 minutes
        expect(result.shouldEnterGracePeriod).toBe(false);
      });

      it('should classify fraud detection as non-retryable', () => {
        const result = service.classifyFailure('FRAUD_DETECTED', 'Transaction flagged as fraud');

        expect(result.failureType).toBe(PaymentFailureType.FRAUD_DETECTED);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please contact customer support');
      });
    });

    describe('Amount and currency errors', () => {
      it('should classify currency not supported as non-retryable', () => {
        const result = service.classifyFailure('CURRENCY_ERROR', 'Currency not supported');

        expect(result.failureType).toBe(PaymentFailureType.CURRENCY_NOT_SUPPORTED);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
      });

      it('should classify amount too high as non-retryable', () => {
        const result = service.classifyFailure('AMOUNT_TOO_HIGH', 'Amount exceeds maximum limit');

        expect(result.failureType).toBe(PaymentFailureType.AMOUNT_TOO_HIGH);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
      });

      it('should classify amount too low as non-retryable', () => {
        const result = service.classifyFailure('AMOUNT_TOO_LOW', 'Amount below minimum limit');

        expect(result.failureType).toBe(PaymentFailureType.AMOUNT_TOO_LOW);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
      });
    });

    describe('Duplicate and special cases', () => {
      it('should classify duplicate transaction as non-retryable without grace period', () => {
        const result = service.classifyFailure('DUPLICATE_TRANSACTION', 'Transaction already processed');

        expect(result.failureType).toBe(PaymentFailureType.DUPLICATE_TRANSACTION);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(false); // No grace period for duplicates
        expect(result.userAction).toBe('Please check your account for the completed transaction');
      });

      it('should classify unknown errors as non-retryable', () => {
        const result = service.classifyFailure('UNKNOWN_ERROR', 'Something went wrong');

        expect(result.failureType).toBe(PaymentFailureType.UNKNOWN_ERROR);
        expect(result.isRetryable).toBe(false);
        expect(result.shouldEnterGracePeriod).toBe(true);
        expect(result.userAction).toBe('Please contact customer support');
      });
    });

    describe('Error code mapping', () => {
      it('should map various network-related error codes correctly', () => {
        const networkCodes = [
          { code: 'network_error', message: 'Network issue' },
          { code: 'connection_failed', message: 'Connection failed' },
          { code: 'timeout', message: 'Request timeout' },
        ];

        networkCodes.forEach(({ code, message }) => {
          const result = service.classifyFailure(code, message);
          expect(result.failureType).toBe(PaymentFailureType.NETWORK_ERROR);
          expect(result.isRetryable).toBe(true);
        });
      });

      it('should map various card-related error codes correctly', () => {
        const cardMappings = [
          { code: 'insufficient_funds', message: 'Not enough money', expected: PaymentFailureType.INSUFFICIENT_FUNDS },
          { code: 'card_expired', message: 'Card expired', expected: PaymentFailureType.CARD_EXPIRED },
          { code: 'invalid_card', message: 'Bad card', expected: PaymentFailureType.INVALID_CARD },
          { code: 'declined', message: 'Card declined', expected: PaymentFailureType.CARD_DECLINED },
        ];

        cardMappings.forEach(({ code, message, expected }) => {
          const result = service.classifyFailure(code, message);
          expect(result.failureType).toBe(expected);
          expect(result.isRetryable).toBe(false);
        });
      });
    });
  });

  describe('getRetryStrategy', () => {
    it('should return no retry strategy for non-retryable failures', () => {
      const strategy = service.getRetryStrategy(PaymentFailureType.INSUFFICIENT_FUNDS);

      expect(strategy.maxAttempts).toBe(0);
      expect(strategy.baseDelayMs).toBe(0);
      expect(strategy.useExponentialBackoff).toBe(false);
    });

    it('should return appropriate retry strategy for network errors', () => {
      const strategy = service.getRetryStrategy(PaymentFailureType.NETWORK_ERROR);

      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.baseDelayMs).toBe(300000); // 5 minutes
      expect(strategy.useExponentialBackoff).toBe(true);
      expect(strategy.maxDelayMs).toBe(86400000); // 24 hours
    });

    it('should return appropriate retry strategy for gateway timeout', () => {
      const strategy = service.getRetryStrategy(PaymentFailureType.GATEWAY_TIMEOUT);

      expect(strategy.maxAttempts).toBe(2);
      expect(strategy.baseDelayMs).toBe(600000); // 10 minutes
      expect(strategy.useExponentialBackoff).toBe(true);
    });

    it('should return appropriate retry strategy for system errors', () => {
      const strategy = service.getRetryStrategy(PaymentFailureType.SYSTEM_ERROR);

      expect(strategy.maxAttempts).toBe(1);
      expect(strategy.baseDelayMs).toBe(1800000); // 30 minutes
      expect(strategy.useExponentialBackoff).toBe(true);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should return null when max attempts exceeded', () => {
      const strategy = { maxAttempts: 3, baseDelayMs: 1000, useExponentialBackoff: false };

      expect(service.calculateRetryDelay(3, strategy)).toBeNull();
      expect(service.calculateRetryDelay(5, strategy)).toBeNull();
    });

    it('should return fixed delay when exponential backoff is disabled', () => {
      const strategy = { maxAttempts: 5, baseDelayMs: 60000, useExponentialBackoff: false };

      expect(service.calculateRetryDelay(0, strategy)).toBe(60000);
      expect(service.calculateRetryDelay(1, strategy)).toBe(60000);
      expect(service.calculateRetryDelay(2, strategy)).toBe(60000);
    });

    it('should return exponential backoff delays when enabled', () => {
      const strategy = { maxAttempts: 5, baseDelayMs: 60000, useExponentialBackoff: true };

      expect(service.calculateRetryDelay(0, strategy)).toBe(60000);      // 1x
      expect(service.calculateRetryDelay(1, strategy)).toBe(120000);     // 2x
      expect(service.calculateRetryDelay(2, strategy)).toBe(240000);     // 4x
      expect(service.calculateRetryDelay(3, strategy)).toBe(480000);     // 8x
    });

    it('should respect maximum delay cap', () => {
      const strategy = {
        maxAttempts: 10,
        baseDelayMs: 60000,
        useExponentialBackoff: true,
        maxDelayMs: 3600000 // 1 hour cap
      };

      // Calculate what delay would be without cap: 60000 * 2^6 = 3,840,000 (64 minutes)
      expect(service.calculateRetryDelay(6, strategy)).toBe(3600000); // Capped at 1 hour
    });

    it('should use default strategy when none provided', () => {
      expect(service.calculateRetryDelay(0)).toBe(3600000); // 1 hour base delay
      expect(service.calculateRetryDelay(1)).toBe(7200000); // 2 hours (exponential)
      expect(service.calculateRetryDelay(2)).toBe(14400000); // 4 hours
    });
  });

  describe('shouldEnterGracePeriod', () => {
    it('should return true for non-retryable failures', () => {
      expect(service.shouldEnterGracePeriod('INSUFFICIENT_FUNDS', 'No money')).toBe(true);
      expect(service.shouldEnterGracePeriod('CARD_EXPIRED', 'Card expired')).toBe(true);
      expect(service.shouldEnterGracePeriod('INVALID_CARD', 'Bad card')).toBe(true);
      expect(service.shouldEnterGracePeriod('DECLINED', 'Declined')).toBe(true);
      expect(service.shouldEnterGracePeriod('FRAUD_DETECTED', 'Fraud')).toBe(true);
    });

    it('should return false for retryable failures', () => {
      expect(service.shouldEnterGracePeriod('NETWORK_ERROR', 'Network issue')).toBe(false);
      expect(service.shouldEnterGracePeriod('GATEWAY_TIMEOUT', 'Timeout')).toBe(false);
      expect(service.shouldEnterGracePeriod('SYSTEM_ERROR', 'System error')).toBe(false);
    });

    it('should return false for duplicate transactions', () => {
      expect(service.shouldEnterGracePeriod('DUPLICATE_TRANSACTION', 'Already processed')).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete payment failure workflow for network error', () => {
      // Classify the failure
      const classification = service.classifyFailure('NETWORK_ERROR', 'Connection failed');
      expect(classification.isRetryable).toBe(true);

      // Get retry strategy
      const strategy = service.getRetryStrategy(classification.failureType);
      expect(strategy.maxAttempts).toBe(3);

      // Calculate retry delays
      expect(service.calculateRetryDelay(0, strategy)).toBe(300000);  // 5 min
      expect(service.calculateRetryDelay(1, strategy)).toBe(600000);  // 10 min (exponential)
      expect(service.calculateRetryDelay(2, strategy)).toBe(1200000); // 20 min

      // Should not enter grace period
      expect(service.shouldEnterGracePeriod('NETWORK_ERROR', 'Connection failed')).toBe(false);
    });

    it('should handle complete payment failure workflow for card declined', () => {
      // Classify the failure
      const classification = service.classifyFailure('DECLINED', 'Card declined');
      expect(classification.isRetryable).toBe(false);

      // Get retry strategy
      const strategy = service.getRetryStrategy(classification.failureType);
      expect(strategy.maxAttempts).toBe(0);

      // No retry delays available
      expect(service.calculateRetryDelay(0, strategy)).toBeNull();

      // Should enter grace period
      expect(service.shouldEnterGracePeriod('DECLINED', 'Card declined')).toBe(true);
    });

    it('should handle edge case with empty error codes', () => {
      const result = service.classifyFailure('', '');

      expect(result.failureType).toBe(PaymentFailureType.UNKNOWN_ERROR);
      expect(result.isRetryable).toBe(false);
      expect(result.shouldEnterGracePeriod).toBe(true);
    });

    it('should handle case-insensitive error codes', () => {
      const result1 = service.classifyFailure('network_error', 'Network issue');
      const result2 = service.classifyFailure('NETWORK_ERROR', 'Network issue');
      const result3 = service.classifyFailure('Network_Error', 'Network issue');

      expect(result1.failureType).toBe(result2.failureType);
      expect(result2.failureType).toBe(result3.failureType);
      expect(result1.isRetryable).toBe(true);
    });
  });
});