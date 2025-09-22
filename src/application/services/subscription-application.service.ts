import { Injectable } from '@nestjs/common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';
import { SubscriptionService } from '../../domain/services/subscription.service';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { OperationLogRepository } from '../../infra/repositories/operation-log.repository';
import { OperationLog } from '../../domain/entities/operation-log.entity';

@Injectable()
export class SubscriptionApplicationService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly productRepository: ProductRepository,
    private readonly operationLogRepository: OperationLogRepository,
  ) {}

  /**
   * 創建訂閱
   */
  public async createSubscription(userId: string, productId: string, startDate: string): Promise<Subscription> {
    // 驗證產品存在
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error('產品不存在');
    }

    // 創建訂閱實體
    const subscription = await this.subscriptionService.createSubscription(userId, productId, startDate, product.cycleType);

    // 儲存到資料庫
    const savedSubscription = await this.subscriptionRepository.save(subscription);
    if (!savedSubscription) {
      throw new Error('儲存訂閱失敗');
    }

    return savedSubscription;
  }

  /**
   * 獲取使用者可用的產品列表
   */
  public async getAvailableProducts(userId: string): Promise<Product[]> {
    // 獲取所有產品
    const allProducts = await this.productRepository.findAll();

    // 獲取使用者所有訂閱
    const userSubscriptions = await this.subscriptionRepository.findByUserId(userId);

    // 過濾出可用產品
    return await this.subscriptionService.getAvailableProducts(allProducts, userSubscriptions);
  }

  /**
   * 取消訂閱
   */
  public async cancelSubscription(subscriptionId: string, operatorId: string): Promise<void> {
    // 查詢訂閱
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error('訂閱不存在');
    }

    // 取消訂閱
    subscription.cancel();

    // 儲存更新
    await this.subscriptionRepository.save(subscription);

    // 記錄操作日誌
    const operationLog = new OperationLog();
    // operationLog.id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // 生成唯一ID
    operationLog.subscriptionId = subscriptionId;
    operationLog.action = `訂閱被取消，操作者: ${operatorId}`;
    operationLog.createdAt = new Date().toISOString();

    await this.operationLogRepository.save(operationLog);
  }
}
