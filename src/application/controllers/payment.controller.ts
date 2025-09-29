import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PaymentApplicationService } from '../services/payment-application.service';
import { CustomResult } from '@xxxhand/app-common';
import { CommonService, ErrException } from '@myapp/common';

@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentController {
  constructor(
    private readonly paymentAppService: PaymentApplicationService,
    private readonly commonService: CommonService,
  ) {}

  @Post('/manual')
  async processManualPayment(@Body() body: { subscriptionId: string }): Promise<CustomResult> {
    const result = await this.paymentAppService.processManualPayment(body.subscriptionId);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({
        status: result.paymentResult?.status,
        retryCount: result.paymentResult?.retryCount,
        isManual: result.paymentResult?.isManual,
        isAuto: result.paymentResult?.isAuto,
        failureReason: result.paymentResult?.failureReason,
      });
    } else {
      throw ErrException.newFromCodeName('ERR_PAYMENT_FAILED', [result.message || 'Failed to process payment']);
    }
  }

  @Get('/subscription/:subscriptionId/history')
  async getPaymentHistory(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    const result = await this.paymentAppService.getSubscriptionPaymentHistory(subscriptionId);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({
        paymentHistory: result.paymentHistory?.map((payment) => ({
          status: payment.status,
          retryCount: payment.retryCount,
          isManual: payment.isManual,
          isAuto: payment.isAuto,
          failureReason: payment.failureReason,
        })),
      });
    } else {
      throw ErrException.newFromCodeName('ERR_PAYMENT_HISTORY_FAILED', [result.message || 'Failed to get payment history']);
    }
  }

  @Get('/subscription/:subscriptionId/amount')
  async getNextPaymentAmount(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    const result = await this.paymentAppService.calculateNextPaymentAmount(subscriptionId);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({
        amount: result.amount,
      });
    } else {
      throw ErrException.newFromCodeName('ERR_CALCULATE_AMOUNT_FAILED', [result.message || 'Failed to calculate payment amount']);
    }
  }
}
