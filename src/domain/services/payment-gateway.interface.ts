/**
 * Payment gateway domain interfaces and types
 * Defines the contracts for payment processing in the domain layer
 */

export const IPaymentGatewayToken = 'IPaymentGateway';

/**
 * Payment request data structure
 */
export interface PaymentRequest {
  /** Unique payment attempt ID */
  attemptId: string;
  /** User ID making the payment */
  userId: string;
  /** Amount to charge (in cents or smallest currency unit) */
  amount: number;
  /** Currency code (e.g., 'TWD', 'USD') */
  currency: string;
  /** Payment description */
  description: string;
  /** Additional metadata for payment processing */
  metadata?: Record<string, any>;
}

/**
 * Payment response data structure
 */
export interface PaymentResponse {
  /** Whether the payment was successful */
  success: boolean;
  /** Transaction ID from payment provider */
  transactionId?: string;
  /** Error message if payment failed */
  errorMessage?: string;
  /** Error code for categorization */
  errorCode?: string;
  /** Additional response data from payment provider */
  providerResponse?: any;
}

/**
 * Payment gateway interface - domain service contract
 * Defines the contract that all payment gateway implementations must follow
 */
export interface IPaymentGateway {
  /**
   * Process a payment charge
   * @param request Payment request details
   * @returns Promise resolving to payment response
   */
  charge(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Refund a payment
   * @param transactionId Original transaction ID to refund
   * @param amount Amount to refund (partial refund supported)
   * @param reason Reason for refund
   * @returns Promise resolving to refund response
   */
  refund(transactionId: string, amount: number, reason?: string): Promise<PaymentResponse>;

  /**
   * Get payment gateway name/identifier
   * @returns Gateway name (e.g., 'ecpay', 'stripe', 'mock')
   */
  getGatewayName(): string;
}
