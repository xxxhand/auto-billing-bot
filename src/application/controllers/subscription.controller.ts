import { Controller, Post, Get, Put, Body, Param, LoggerService } from '@nestjs/common';
import { SubscriptionApplicationService } from '../services/subscription-application.service';
import { CustomResult } from '@xxxhand/app-common';
import { CommonService, ErrException } from '@myapp/common';

@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionController {
  private _logger: LoggerService;
  constructor(
    private readonly subscriptionAppService: SubscriptionApplicationService,
    private readonly commonService: CommonService,
  ) {
    this._logger = this.commonService.getDefaultLogger(SubscriptionController.name);
  }

  @Post()
  async createSubscription(@Body() body: { userId: string; productId: string; couponCode?: string }): Promise<CustomResult> {
    const result = await this.subscriptionAppService.createAndActivateSubscription(body);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({
        subscriptionId: result.subscription?.id,
        paymentStatus: result.paymentResult?.status,
      });
    } else {
      this._logger.error(`Failed to create subscription for user ${body.userId} with product ${body.productId}: ${result.message}`);
      throw ErrException.newFromCodeName('ERR_SUBSCRIPTION_CREATE_FAILED', [result.message || 'Failed to create subscription']);
    }
  }

  @Get('/user/:userId')
  async getUserSubscriptions(@Param('userId') userId: string): Promise<CustomResult> {
    const result = await this.subscriptionAppService.getUserSubscriptionDetails(userId);

    return this.commonService.newResultInstance().withResult({
      subscriptions: result.subscriptions,
      activeCount: result.activeCount,
      totalCount: result.totalCount,
    });
  }

  @Get('/:id')
  async getSubscription(@Param('id') id: string): Promise<CustomResult> {
    const result = await this.subscriptionAppService.getUserSubscriptionDetails(''); // This needs to be fixed - we need user context

    const subscription = result.subscriptions.find((sub) => sub.id === id);
    if (!subscription) {
      throw ErrException.newFromCodeName('ERR_SUBSCRIPTION_NOT_FOUND');
    }

    return this.commonService.newResultInstance().withResult(subscription);
  }

  @Put('/:id/cancel')
  async cancelSubscription(@Param('id') subscriptionId: string, @Body() body: { userId: string; requestRefund?: boolean }): Promise<CustomResult> {
    const result = await this.subscriptionAppService.cancelUserSubscription(body.userId, subscriptionId, body.requestRefund);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({ success: true });
    } else {
      this._logger.error(`Failed to cancel subscription ${subscriptionId} for user ${body.userId}: ${result.message}`);
      throw ErrException.newFromCodeName('ERR_SUBSCRIPTION_CANCEL_FAILED', [result.message || 'Failed to cancel subscription']);
    }
  }

  @Put('/:id/upgrade')
  async upgradeSubscription(@Param('id') subscriptionId: string, @Body() body: { userId: string; newProductId: string }): Promise<CustomResult> {
    const result = await this.subscriptionAppService.upgradeSubscription(body.userId, subscriptionId, body.newProductId);

    if (result.success) {
      return this.commonService.newResultInstance().withResult({ success: true });
    } else {
      throw ErrException.newFromCodeName('ERR_SUBSCRIPTION_UPGRADE_FAILED', [result.message || 'Failed to upgrade subscription']);
    }
  }
}
