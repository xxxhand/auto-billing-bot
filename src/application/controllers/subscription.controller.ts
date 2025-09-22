import { Body, Controller, Post, Get, Patch, Param, Query } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { SubscriptionApplicationService } from '../services/subscription-application.service';
import { PaymentApplicationService } from '../services/payment-application.service';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { PaymentHistoryRepository } from '../../infra/repositories/payment-history.repository';

@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionController {
  constructor(
    private readonly commonService: CommonService,
    private readonly subscriptionAppService: SubscriptionApplicationService,
    private readonly paymentAppService: PaymentApplicationService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly paymentHistoryRepository: PaymentHistoryRepository,
  ) {}

  /**
   * 建立訂閱
   */
  @Post()
  public async createSubscription(@Body() body: { userId: string; productId: string; startDate: string }) {
    try {
      const subscription = await this.subscriptionAppService.createSubscription(body.userId, body.productId, body.startDate);

      return this.commonService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        nextBillingDate: subscription.nextBillingDate,
      });
    } catch (error) {
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_ERROR);
    }
  }

  /**
   * 查詢產品列表（過濾已訂閱產品）
   */
  @Get('/products')
  public async getAvailableProducts(@Query('userId') userId: string) {
    try {
      const products = await this.subscriptionAppService.getAvailableProducts(userId);

      return this.commonService.newResultInstance().withResult(
        products.map((product) => ({
          id: product.id,
          name: product.name,
          cycleType: product.cycleType,
          price: product.price,
        })),
      );
    } catch (error) {
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_ERROR);
    }
  }

  /**
   * 執行扣款
   */
  @Post('/payments')
  public async processPayment(@Body() body: { subscriptionId: string; amount: number }) {
    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionRepository.findById(body.subscriptionId);
      if (!subscription) {
        throw new Error('訂閱不存在');
      }

      const result = await this.paymentAppService.processPayment(body.subscriptionId, body.amount);

      return this.commonService.newResultInstance().withResult({
        paymentId: `payment_${Date.now()}`, // 模擬支付ID
        status: result.status,
        failureReason: result.failureReason,
      });
    } catch (error) {
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_ERROR);
    }
  }

  /**
   * 查詢訂閱狀態與扣款歷史
   */
  @Get('/:subscriptionId')
  public async getSubscriptionDetails(@Param('subscriptionId') subscriptionId: string) {
    try {
      const subscription = await this.subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new Error('訂閱不存在');
      }

      const paymentHistory = await this.paymentHistoryRepository.findBySubscriptionId(subscriptionId);

      return this.commonService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        productId: subscription.productId,
        status: subscription.status,
        nextBillingDate: subscription.nextBillingDate,
        paymentHistory: paymentHistory.map((payment) => ({
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status,
          failureReason: payment.failureReason,
          createdAt: payment.createdAt,
        })),
      });
    } catch (error) {
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_ERROR);
    }
  }

  /**
   * 取消訂閱
   */
  @Patch('/:subscriptionId/cancel')
  public async cancelSubscription(@Param('subscriptionId') subscriptionId: string, @Body() body: { operatorId: string }) {
    try {
      await this.subscriptionAppService.cancelSubscription(subscriptionId, body.operatorId);

      return this.commonService.newResultInstance().withResult({
        subscriptionId,
        status: 'cancelled',
      });
    } catch (error) {
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_ERROR);
    }
  }
}
