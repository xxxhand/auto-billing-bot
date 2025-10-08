import { Injectable } from '@nestjs/common';

/**
 * Payment failure types that can occur during payment processing
 */
export enum PaymentFailureType {
  NETWORK_ERROR = 'network_error',
  GATEWAY_TIMEOUT = 'gateway_timeout',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  CARD_EXPIRED = 'card_expired',
  INVALID_CARD = 'invalid_card',
  CARD_DECLINED = 'card_declined',
  FRAUD_DETECTED = 'fraud_detected',
  CURRENCY_NOT_SUPPORTED = 'currency_not_supported',
  AMOUNT_TOO_HIGH = 'amount_too_high',
  AMOUNT_TOO_LOW = 'amount_too_low',
  DUPLICATE_TRANSACTION = 'duplicate_transaction',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Classification result for payment failures
 */
export interface PaymentFailureClassification {
  /** The classified failure type */
  failureType: PaymentFailureType;
  /** Whether this failure is retryable */
  isRetryable: boolean;
  /** Maximum number of retry attempts recommended */
  maxRetryAttempts: number;
  /** Recommended delay between retries in milliseconds */
  retryDelayMs: number;
  /** Whether this failure should trigger grace period */
  shouldEnterGracePeriod: boolean;
  /** Human-readable description of the failure */
  description: string;
  /** Suggested user action */
  userAction: string;
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Whether to use exponential backoff */
  useExponentialBackoff: boolean;
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number;
}

/**
 * Domain service for classifying payment failures and determining retry strategies
 * This service encapsulates the business logic for handling different types of payment failures
 */
@Injectable()
export class PaymentFailureClassifierService {
  /**
   * Default retry strategy configuration
   */
  private readonly defaultRetryStrategy: RetryStrategy = {
    maxAttempts: 3,
    baseDelayMs: 3600000, // 1 hour
    useExponentialBackoff: true,
    maxDelayMs: 86400000, // 24 hours
  };

  /**
   * Classify a payment failure based on error code and message
   * @param errorCode The error code from the payment gateway
   * @param errorMessage The error message from the payment gateway
   * @returns PaymentFailureClassification with retry strategy
   */
  public classifyFailure(errorCode: string, errorMessage: string): PaymentFailureClassification {
    const failureType = this.mapErrorToFailureType(errorCode, errorMessage);

    switch (failureType) {
      case 'network_error':
        return {
          failureType,
          isRetryable: true,
          maxRetryAttempts: 3,
          retryDelayMs: 300000, // 5 minutes
          shouldEnterGracePeriod: false,
          description: 'Network connectivity issue',
          userAction: 'Please try again in a few minutes',
        };

      case 'gateway_timeout':
        return {
          failureType,
          isRetryable: true,
          maxRetryAttempts: 2,
          retryDelayMs: 600000, // 10 minutes
          shouldEnterGracePeriod: false,
          description: 'Payment gateway timeout',
          userAction: 'Please try again later',
        };

      case 'system_error':
        return {
          failureType,
          isRetryable: true,
          maxRetryAttempts: 1,
          retryDelayMs: 1800000, // 30 minutes
          shouldEnterGracePeriod: false,
          description: 'Temporary system error',
          userAction: 'Please try again in 30 minutes',
        };

      case 'insufficient_funds':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Insufficient funds in account',
          userAction: 'Please add funds to your account and try again',
        };

      case 'card_expired':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Credit card has expired',
          userAction: 'Please update your card details',
        };

      case 'invalid_card':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Invalid card details',
          userAction: 'Please check your card details and try again',
        };

      case 'card_declined':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Card declined by issuer',
          userAction: 'Please contact your card issuer or try a different card',
        };

      case 'fraud_detected':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Transaction flagged as potential fraud',
          userAction: 'Please contact customer support',
        };

      case 'currency_not_supported':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Currency not supported',
          userAction: 'Please contact customer support',
        };

      case 'amount_too_high':
      case 'amount_too_low':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Transaction amount outside acceptable range',
          userAction: 'Please contact customer support',
        };

      case 'duplicate_transaction':
        return {
          failureType,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: false, // Duplicate means payment already processed
          description: 'Duplicate transaction detected',
          userAction: 'Please check your account for the completed transaction',
        };

      case 'unknown_error':
      default:
        return {
          failureType: PaymentFailureType.UNKNOWN_ERROR,
          isRetryable: false,
          maxRetryAttempts: 0,
          retryDelayMs: 0,
          shouldEnterGracePeriod: true,
          description: 'Unknown payment error',
          userAction: 'Please contact customer support',
        };
    }
  }

  /**
   * Get retry strategy for a specific failure type
   * @param failureType The payment failure type
   * @returns RetryStrategy configuration
   */
  public getRetryStrategy(failureType: PaymentFailureType): RetryStrategy {
    const classification = this.classifyFailure(failureType, '');

    if (!classification.isRetryable) {
      return {
        maxAttempts: 0,
        baseDelayMs: 0,
        useExponentialBackoff: false,
      };
    }

    return {
      maxAttempts: classification.maxRetryAttempts,
      baseDelayMs: classification.retryDelayMs,
      useExponentialBackoff: true,
      maxDelayMs: 86400000, // 24 hours max
    };
  }

  /**
   * Calculate the next retry delay based on attempt number and strategy
   * @param attemptNumber The current attempt number (0-based)
   * @param strategy The retry strategy to use
   * @returns Delay in milliseconds, or null if no more retries
   */
  public calculateRetryDelay(attemptNumber: number, strategy: RetryStrategy = this.defaultRetryStrategy): number | null {
    if (attemptNumber >= strategy.maxAttempts) {
      return null; // No more retries
    }

    let delay = strategy.baseDelayMs;

    if (strategy.useExponentialBackoff) {
      // Exponential backoff: baseDelay * 2^attemptNumber
      delay = strategy.baseDelayMs * Math.pow(2, attemptNumber);
    }

    // Apply maximum delay cap if specified
    if (strategy.maxDelayMs && delay > strategy.maxDelayMs) {
      delay = strategy.maxDelayMs;
    }

    return delay;
  }

  /**
   * Check if a failure should trigger grace period based on classification
   * @param errorCode The error code from payment gateway
   * @param errorMessage The error message from payment gateway
   * @returns Whether to enter grace period
   */
  public shouldEnterGracePeriod(errorCode: string, errorMessage: string): boolean {
    const classification = this.classifyFailure(errorCode, errorMessage);
    return classification.shouldEnterGracePeriod;
  }

  /**
   * Map payment gateway error codes/messages to standardized failure types
   * @param errorCode The error code from payment gateway
   * @param errorMessage The error message from payment gateway
   * @returns Standardized PaymentFailureType
   */
  private mapErrorToFailureType(errorCode: string, errorMessage: string): PaymentFailureType {
    const code = errorCode.toLowerCase();
    const message = errorMessage.toLowerCase();

    // Gateway timeout (check before general timeout)
    if (code === 'gateway_timeout' || message.includes('gateway timeout') ||
        (code.includes('timeout') && (code.includes('gateway') || message.includes('gateway')))) {
      return PaymentFailureType.GATEWAY_TIMEOUT;
    }

    // Network and connectivity errors
    if (code.includes('network') || code.includes('connection') ||
        message.includes('network') || message.includes('connection') ||
        code.includes('timeout') || message.includes('timeout')) {
      return PaymentFailureType.NETWORK_ERROR;
    }

    // Insufficient funds
    if (code.includes('insufficient') || message.includes('insufficient') ||
        code.includes('funds') || message.includes('funds')) {
      return PaymentFailureType.INSUFFICIENT_FUNDS;
    }

    // Card expired
    if (code.includes('expired') || message.includes('expired') ||
        code.includes('expiry') || message.includes('expiry')) {
      return PaymentFailureType.CARD_EXPIRED;
    }

    // Invalid card
    if (code.includes('invalid') && (code.includes('card') || message.includes('card')) ||
        message.includes('invalid card') || code.includes('card_invalid')) {
      return PaymentFailureType.INVALID_CARD;
    }

    // Card declined
    if (code.includes('declined') || message.includes('declined') ||
        code.includes('rejected') || message.includes('rejected')) {
      return PaymentFailureType.CARD_DECLINED;
    }

    // Fraud detection
    if (code.includes('fraud') || message.includes('fraud') ||
        code.includes('suspicious') || message.includes('suspicious')) {
      return PaymentFailureType.FRAUD_DETECTED;
    }

    // Currency issues
    if (code.includes('currency') || message.includes('currency')) {
      return PaymentFailureType.CURRENCY_NOT_SUPPORTED;
    }

    // Amount issues
    if (code.includes('amount') || message.includes('amount')) {
      if (message.includes('too high') || message.includes('exceeds') || code.includes('high')) {
        return PaymentFailureType.AMOUNT_TOO_HIGH;
      }
      if (message.includes('too low') || message.includes('below') || code.includes('low')) {
        return PaymentFailureType.AMOUNT_TOO_LOW;
      }
    }

    // Duplicate transaction
    if (code.includes('duplicate') || message.includes('duplicate') ||
        code.includes('already') || message.includes('already')) {
      return PaymentFailureType.DUPLICATE_TRANSACTION;
    }

    // System errors
    if (code.includes('system') || message.includes('system') ||
        code.includes('internal') || message.includes('internal')) {
      return PaymentFailureType.SYSTEM_ERROR;
    }

    // Default to unknown
    return PaymentFailureType.UNKNOWN_ERROR;
  }
}