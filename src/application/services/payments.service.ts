import { Injectable } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { IBillingService, IBillingServiceToken } from '../../domain/services/billing.service.interface';
import { Inject } from '@nestjs/common';
import { RetryPaymentRequest } from '../../domain/value-objects/retry-payment.request';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly commonService: CommonService,
    private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(IBillingServiceToken) private readonly billingService: IBillingService,
  ) {}

  async retryPayment(request: RetryPaymentRequest): Promise<{ success: boolean; message: string }> {
    const { subscriptionId } = request;

    if (!subscriptionId || subscriptionId.trim() === '') {
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_ID_EMPTY);
    }

    // Find subscription
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
    }

    // Check if in grace status
    if (subscription.status !== 'grace') {
      throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_IN_GRACE);
    }

    // Process payment retry
    const billingResult = await this.billingService.processBilling(subscriptionId, true, 0);

    if (billingResult.success) {
      // Status already updated to active in billing service
      return { success: true, message: 'Payment retry successful' };
    } else {
      // Payment failed, remain in grace
      return { success: false, message: billingResult.errorMessage };
    }
  }
}
