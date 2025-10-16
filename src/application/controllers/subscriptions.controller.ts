import { Body, Controller, Post, Get, Param, LoggerService } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionRequest } from '../../domain/value-objects/create-subscription.request';
import { GetSubscriptionResponse } from '../../domain/value-objects/get-subscription.response';
import { ConvertSubscriptionRequest } from '../../domain/value-objects/convert-subscription.request';

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

  @Get(':id')
  async getSubscription(@Param('id') subscriptionId: string): Promise<any> {
    const result = await this.subscriptionsService.getSubscription(subscriptionId);
    return this.commonService.newResultInstance().withResult(result);
  }

  @Post('convert')
  async convertSubscription(@Body() request: ConvertSubscriptionRequest): Promise<any> {
    const result = await this.subscriptionsService.convertSubscription(request);
    return this.commonService.newResultInstance().withResult(result);
  }
}
