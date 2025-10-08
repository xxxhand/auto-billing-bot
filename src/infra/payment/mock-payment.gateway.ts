import { Injectable } from '@nestjs/common';
import {
  IPaymentGateway,
  PaymentRequest,
  PaymentResponse
} from '../../domain/services/payment-gateway.interface';

/**
 * Mock payment gateway implementation for testing and development
 * Simulates various payment scenarios including success and failure cases
 */
@Injectable()
export class MockPaymentGateway implements IPaymentGateway {
  private transactionCounter = 0;

  /**
   * Get the gateway name
   */
  getGatewayName(): string {
    return 'mock';
  }

  /**
   * Process a payment charge with simulated scenarios
   * @param request Payment request
   * @returns Promise resolving to payment response
   */
  async charge(request: PaymentRequest): Promise<PaymentResponse> {
    // Simulate network delay
    await this.delay(100 + Math.random() * 200);

    // Determine payment outcome based on request data
    const outcome = this.determinePaymentOutcome(request);

    switch (outcome) {
      case 'success':
        return this.createSuccessResponse(request);

      case 'insufficient_funds':
        return this.createFailureResponse('INSUFFICIENT_FUNDS', 'Insufficient funds');

      case 'network_error':
        return this.createFailureResponse('NETWORK_ERROR', 'Network connection failed');

      case 'card_expired':
        return this.createFailureResponse('CARD_EXPIRED', 'Card has expired');

      case 'invalid_card':
        return this.createFailureResponse('INVALID_CARD', 'Invalid card details');

      case 'declined':
        return this.createFailureResponse('DECLINED', 'Payment declined by issuer');

      default:
        return this.createFailureResponse('UNKNOWN_ERROR', 'Unknown payment error');
    }
  }

  /**
   * Process a refund with simulated scenarios
   * @param transactionId Original transaction ID
   * @param amount Refund amount
   * @param reason Refund reason
   * @returns Promise resolving to refund response
   */
  async refund(transactionId: string, amount: number, reason?: string): Promise<PaymentResponse> {
    // Simulate network delay
    await this.delay(150 + Math.random() * 100);

    // Mock refunds are always successful for simplicity
    return {
      success: true,
      transactionId: `refund_${transactionId}_${Date.now()}`,
      providerResponse: {
        originalTransactionId: transactionId,
        refundAmount: amount,
        refundReason: reason || 'Customer request',
        refundedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Determine payment outcome based on request data
   * Uses deterministic logic based on attemptId, userId, and amount for testing
   * @param request Payment request
   * @returns Payment outcome type
   */
  private determinePaymentOutcome(request: PaymentRequest): string {
    const { attemptId, userId, amount } = request;

    // Check for test-specific attemptIds to force specific outcomes
    if (attemptId.includes('insuff_funds')) {
      return 'insufficient_funds';
    } else if (attemptId.includes('network_error')) {
      return 'network_error';
    } else if (attemptId.includes('card_expired')) {
      return 'card_expired';
    } else if (attemptId.includes('invalid_card')) {
      return 'invalid_card';
    } else if (attemptId.includes('declined')) {
      return 'declined';
    } else if (attemptId.includes('success')) {
      return 'success';
    }

    // For non-test requests, use hash-based logic
    const hash = this.simpleHash(`${attemptId}-${userId}-${amount}`);
    const modValue = hash % 100;

    if (modValue < 15) {
      return 'insufficient_funds';
    } else if (modValue < 30) {
      return 'network_error';
    } else if (modValue < 45) {
      return 'card_expired';
    } else if (modValue < 60) {
      return 'invalid_card';
    } else if (modValue < 75) {
      return 'declined';
    } else {
      return 'success';
    }
  }

  /**
   * Create a successful payment response
   * @param request Original payment request
   * @returns Success response
   */
  private createSuccessResponse(request: PaymentRequest): PaymentResponse {
    this.transactionCounter++;
    const transactionId = `mock_txn_${Date.now()}_${this.transactionCounter}`;

    return {
      success: true,
      transactionId,
      providerResponse: {
        transactionId,
        amount: request.amount,
        currency: request.currency,
        status: 'completed',
        processedAt: new Date().toISOString(),
        cardLastFour: '4242', // Mock card number ending
        authCode: `AUTH${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      }
    };
  }

  /**
   * Create a failure payment response
   * @param errorCode Error code
   * @param errorMessage Error message
   * @returns Failure response
   */
  private createFailureResponse(errorCode: string, errorMessage: string): PaymentResponse {
    return {
      success: false,
      errorCode,
      errorMessage,
      providerResponse: {
        error: errorCode.toLowerCase(),
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Simple hash function for deterministic behavior
   * @param str Input string
   * @returns Hash value
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate network delay
   * @param ms Delay in milliseconds
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}