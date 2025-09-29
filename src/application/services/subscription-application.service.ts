import { CommonService } from '@myapp/common';
import { Injectable, LoggerService } from '@nestjs/common';
import { SubscriptionService } from '../../infra/services/subscription.service';
import { ProductService } from '../../infra/services/product.service';
import { PaymentService } from '../../infra/services/payment.service';
import { Subscription } from '../../domain/entities/subscription.entity';
import { PaymentResult } from '../../domain/value-objects/payment-result.value-object';

export interface CreateSubscriptionResult {
  success: boolean;
  subscription?: Subscription;
  paymentResult?: PaymentResult;
  message?: string;
}

export interface CancelSubscriptionResult {
  success: boolean;
  message?: string;
}

export interface UpgradeSubscriptionResult {
  success: boolean;
  message?: string;
}

@Injectable()
export class SubscriptionApplicationService {
  private _logger: LoggerService;
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
    private readonly commonService: CommonService,
  ) {
    this._logger = this.commonService.getDefaultLogger(SubscriptionApplicationService.name);
  }

  async createAndActivateSubscription(subscriptionData: { userId: string; productId: string; couponCode?: string }): Promise<CreateSubscriptionResult> {
    try {
      // 創建訂閱
      this._logger.log(`Creating subscription for user ${subscriptionData.userId} with product ${subscriptionData.productId}.`);
      const subscription = await this.subscriptionService.createSubscription(subscriptionData);

      // 處理初始付款
      this._logger.log(`Processing initial payment for subscription ${subscription.id}.`);
      const paymentResult = await this.paymentService.processPayment(subscription.id, true);

      if (paymentResult.status === 'success') {
        // 付款成功，激活訂閱
        this._logger.log(`Activating subscription ${subscription.id} after successful payment.`);
        await this.subscriptionService.activateSubscription(subscription.id);

        return {
          success: true,
          subscription,
          paymentResult,
        };
      } else {
        // 付款失敗
        return {
          success: false,
          subscription,
          paymentResult,
          message: 'Initial payment failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async cancelUserSubscription(userId: string, subscriptionId: string, requestRefund: boolean = false): Promise<CancelSubscriptionResult> {
    try {
      // 驗證訂閱是否屬於用戶
      const userSubscriptions = await this.subscriptionService.getUserSubscriptions(userId);
      const subscription = userSubscriptions.find((sub) => sub.id === subscriptionId);

      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found or does not belong to user',
        };
      }

      // 取消訂閱
      await this.subscriptionService.cancelSubscription(subscriptionId);

      // 如果請求退款
      if (requestRefund) {
        await this.subscriptionService.requestRefund(subscriptionId);
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async upgradeSubscription(userId: string, subscriptionId: string, newProductId: string): Promise<UpgradeSubscriptionResult> {
    try {
      // 驗證訂閱是否屬於用戶
      const userSubscriptions = await this.subscriptionService.getUserSubscriptions(userId);
      const subscription = userSubscriptions.find((sub) => sub.id === subscriptionId);

      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found or does not belong to user',
        };
      }

      // 驗證新產品是否存在
      const newProduct = await this.productService.getProductById(newProductId);
      if (!newProduct) {
        return {
          success: false,
          message: 'New product not found',
        };
      }

      // 切換方案
      await this.subscriptionService.switchPlan(subscriptionId, newProductId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUserSubscriptionDetails(userId: string): Promise<{
    subscriptions: Subscription[];
    activeCount: number;
    totalCount: number;
  }> {
    const subscriptions = await this.subscriptionService.getUserSubscriptions(userId);
    const activeCount = subscriptions.filter((sub) => sub.status === 'active').length;

    return {
      subscriptions,
      activeCount,
      totalCount: subscriptions.length,
    };
  }
}
