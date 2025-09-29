import { Controller, Get, Post, Patch, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionApplicationService, CreateSubscriptionData } from '../services/subscription-application.service';
import { BillingCycleType } from '../../domain/entities/subscription.entity';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionApplicationService: SubscriptionApplicationService) {}

  @Post()
  async createSubscription(@Body() data: CreateSubscriptionData) {
    try {
      const subscription = await this.subscriptionApplicationService.createSubscription(data);
      return subscription;
    } catch (error) {
      throw new HttpException(error.message || 'Failed to create subscription', HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async getSubscription(@Param('id') subscriptionId: string) {
    try {
      const subscription = await this.subscriptionApplicationService.getSubscription(subscriptionId);
      return subscription;
    } catch (error) {
      if (error.message === 'Subscription not found') {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(error.message || 'Failed to get subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getUserSubscriptions(@Query('userId') userId: string) {
    try {
      if (!userId) {
        throw new HttpException('userId query parameter is required', HttpStatus.BAD_REQUEST);
      }
      const subscriptions = await this.subscriptionApplicationService.getUserSubscriptions(userId);
      return subscriptions;
    } catch (error) {
      throw new HttpException(error.message || 'Failed to get user subscriptions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/plan')
  async changeSubscriptionPlan(@Param('id') subscriptionId: string, @Body() data: { billingCycle: BillingCycleType }) {
    try {
      if (!data.billingCycle) {
        throw new HttpException('billingCycle is required', HttpStatus.BAD_REQUEST);
      }
      const subscription = await this.subscriptionApplicationService.changeSubscriptionPlan(subscriptionId, data.billingCycle);
      return subscription;
    } catch (error) {
      if (error.message.includes('Invalid plan change')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      if (error.message.includes('not found')) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(error.message || 'Failed to change subscription plan', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
