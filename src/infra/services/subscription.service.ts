import { Injectable, LoggerService } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';

@Injectable()
export class SubscriptionService {
  private _logger: LoggerService;
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly productRepository: ProductRepository,
    private readonly commonService: CommonService,
  ) {
    this._logger = this.commonService.getDefaultLogger(SubscriptionService.name);
  }

  async createSubscription(subscriptionData: { userId: string; productId: string; couponCode?: string }): Promise<Subscription> {
    // 驗證產品是否存在
    const product = await this.productRepository.findById(subscriptionData.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const subscription = new Subscription();
    Object.assign(subscription, {
      ...subscriptionData,
      startDate: new Date().toISOString(),
      nextBillingDate: this.calculateNextBillingDate(new Date().toISOString(), product.cycleType),
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      renewalCount: 0,
    });
    this._logger.log(`Created subscription entity for user ${subscription.userId} with product ${subscription.productId}.`);

    return await this.subscriptionRepository.save(subscription);
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return await this.subscriptionRepository.findByUserId(userId);
  }

  async getSubscriptionById(id: string): Promise<Subscription | undefined> {
    return await this.subscriptionRepository.findById(id);
  }

  async activateSubscription(id: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      return false;
    }

    subscription.activate();
    await this.subscriptionRepository.save(subscription);
    return true;
  }

  async cancelSubscription(id: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      return false;
    }

    subscription.cancel();
    await this.subscriptionRepository.save(subscription);
    return true;
  }

  async requestRefund(id: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      return false;
    }

    subscription.requestRefund();
    await this.subscriptionRepository.save(subscription);
    return true;
  }

  async switchPlan(subscriptionId: string, newProductId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return false;
    }

    const newProduct = await this.productRepository.findById(newProductId);
    if (!newProduct) {
      return false;
    }

    subscription.switchPlan(newProductId, newProduct.cycleType);
    await this.subscriptionRepository.save(subscription);
    return true;
  }

  async renewSubscription(id: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      return false;
    }

    // 獲取產品信息來計算下次扣款日期
    const product = await this.productRepository.findById(subscription.productId);
    if (!product) {
      return false;
    }

    subscription.renewalCount += 1;
    subscription.nextBillingDate = subscription.calculateNextBillingDate(product.cycleType);
    await this.subscriptionRepository.save(subscription);
    return true;
  }

  async getDueSubscriptions(date: string): Promise<Subscription[]> {
    return await this.subscriptionRepository.findDueSubscriptions(date);
  }

  private calculateNextBillingDate(startDate: string, cycleType: 'monthly' | 'yearly'): string {
    const currentDate = new Date(startDate);

    if (cycleType === 'monthly') {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(currentDate.getMonth() + 1);
      return nextMonth.toISOString();
    } else if (cycleType === 'yearly') {
      const nextYear = new Date(currentDate);
      nextYear.setFullYear(currentDate.getFullYear() + 1);
      return nextYear.toISOString();
    }

    throw new Error('Invalid cycle type');
  }
}
