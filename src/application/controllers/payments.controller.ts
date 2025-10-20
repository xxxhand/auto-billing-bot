import { Body, Controller, Post } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { PaymentsService } from '../services/payments.service';
import { RetryPaymentRequest } from '../../domain/value-objects/retry-payment.request';

@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentsController {
  constructor(
    private readonly commonService: CommonService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('retry')
  async retryPayment(@Body() request: RetryPaymentRequest): Promise<any> {
    const result = await this.paymentsService.retryPayment(request);
    return this.commonService.newResultInstance().withResult(result);
  }
}
