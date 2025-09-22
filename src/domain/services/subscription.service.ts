import { Injectable } from '@nestjs/common';
import { Subscription } from '../entities/subscription.entity';
import { Product } from '../entities/product.entity';
import { BillingCycleType } from '../value-objects/billing-cycle.value-object';

@Injectable()
export class SubscriptionService {
  /**
   * 創建訂閱
   * @param userId 使用者ID
   * @param productId 產品ID
   * @param startDate 開始日期（ISO 8601）
   * @param cycleType 週期類型
   * @returns 創建的訂閱實體
   */
  public async createSubscription(userId: string, productId: string, startDate: string, cycleType: BillingCycleType): Promise<Subscription> {
    const subscription = new Subscription();
    // subscription.id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // 生成唯一ID
    subscription.userId = userId;
    subscription.productId = productId;
    subscription.startDate = startDate;
    subscription.status = 'pending';
    subscription.createdAt = new Date().toISOString();

    // 計算下次扣款日期
    subscription.nextBillingDate = subscription.calculateNextBillingDate(cycleType);

    return subscription;
  }

  /**
   * 獲取使用者可用的產品列表（過濾已訂閱的產品）
   * @param allProducts 所有產品
   * @param userSubscriptions 使用者的訂閱列表
   * @returns 可用的產品列表
   */
  public async getAvailableProducts(allProducts: Product[], userSubscriptions: Subscription[]): Promise<Product[]> {
    // 獲取使用者已訂閱的產品ID集合
    const subscribedProductIds = new Set(userSubscriptions.map((sub) => sub.productId));

    // 過濾出未訂閱的產品
    return allProducts.filter((product) => !subscribedProductIds.has(product.id));
  }
}
