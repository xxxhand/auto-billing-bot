import { Body, Controller, Post, LoggerService } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionRequest } from '../../domain/value-objects/create-subscription.request';
import { CreateSubscriptionResponse } from '../../domain/value-objects/create-subscription.response';

@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionsController {
  private readonly logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    this.logger = this.commonService.getDefaultLogger(SubscriptionsController.name);
  }

  @Post()
  async createSubscription(@Body() request: CreateSubscriptionRequest): Promise<any> {
    const result = await this.subscriptionsService.createSubscription(request);
    return this.commonService.newResultInstance().withResult(result);
  }
}
