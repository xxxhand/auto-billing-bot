import { Injectable, Logger, Inject } from '@nestjs/common';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomMongoClient } from '@xxxhand/app-common';
import { cmmConf } from '@myapp/conf';
import { modelNames } from '../models/models.definition';

/**
 * Database Index Service
 * Responsible for creating and managing MongoDB indexes for optimal query performance
 */
@Injectable()
export class DatabaseIndexService {
  private readonly logger = new Logger(DatabaseIndexService.name);

  constructor(@Inject(DEFAULT_MONGO) private readonly mongoClient: CustomMongoClient) {}

  /**
   * Create all necessary indexes for the application
   * Called during application bootstrap
   */
  async createIndexes(): Promise<void> {
    try {
      this.logger.log('Starting database index creation...');

      const db = this.mongoClient.client.db(cmmConf.defaultMongo.dbName);

      // Create indexes for subscriptions collection
      await this.createSubscriptionsIndexes(db);

      // Create indexes for paymentAttempts collection
      await this.createPaymentAttemptsIndexes(db);

      // Create indexes for promoCodeUsages collection
      await this.createPromoCodeUsagesIndexes(db);

      // Create indexes for billingLogs collection
      await this.createBillingLogsIndexes(db);

      // Create indexes for other collections
      await this.createOtherCollectionsIndexes(db);

      this.logger.log('Database index creation completed successfully');
    } catch (error) {
      this.logger.error('Failed to create database indexes', error);
      throw error;
    }
  }

  /**
   * Create indexes for subscriptions collection
   * Critical for CRON job performance (nextBillingDate queries)
   */
  private async createSubscriptionsIndexes(db: any): Promise<void> {
    const collection = db.collection(modelNames.SUBSCRIPTIONS);

    // Index for nextBillingDate - critical for CRON job queries
    await collection.createIndex(
      { nextBillingDate: 1 },
      {
        name: 'nextBillingDate_1',
        background: true,
      },
    );

    // Index for status - frequently queried
    await collection.createIndex(
      { status: 1 },
      {
        name: 'status_1',
        background: true,
      },
    );

    // Compound index for status + nextBillingDate - optimal for CRON queries
    await collection.createIndex(
      { status: 1, nextBillingDate: 1 },
      {
        name: 'status_1_nextBillingDate_1',
        background: true,
      },
    );

    // Index for userId - for user subscription queries
    await collection.createIndex(
      { userId: 1 },
      {
        name: 'userId_1',
        background: true,
      },
    );

    // Index for productId - for product subscription queries
    await collection.createIndex(
      { productId: 1 },
      {
        name: 'productId_1',
        background: true,
      },
    );

    this.logger.log('Created indexes for subscriptions collection');
  }

  /**
   * Create indexes for paymentAttempts collection
   */
  private async createPaymentAttemptsIndexes(db: any): Promise<void> {
    const collection = db.collection(modelNames.PAYMENT_ATTEMPTS);

    // Index for status - frequently queried
    await collection.createIndex(
      { status: 1 },
      {
        name: 'status_1',
        background: true,
      },
    );

    // Index for subscriptionId - for subscription payment history
    await collection.createIndex(
      { subscriptionId: 1 },
      {
        name: 'subscriptionId_1',
        background: true,
      },
    );

    // Compound index for subscriptionId + status
    await collection.createIndex(
      { subscriptionId: 1, status: 1 },
      {
        name: 'subscriptionId_1_status_1',
        background: true,
      },
    );

    this.logger.log('Created indexes for paymentAttempts collection');
  }

  /**
   * Create indexes for promoCodeUsages collection
   * Important for promo code validation and usage tracking
   */
  private async createPromoCodeUsagesIndexes(db: any): Promise<void> {
    const collection = db.collection(modelNames.PROMO_CODE_USAGES);

    // Index for userId - for checking user promo code usage
    await collection.createIndex(
      { userId: 1 },
      {
        name: 'userId_1',
        background: true,
      },
    );

    // Index for promoCode - for promo code usage statistics
    await collection.createIndex(
      { promoCode: 1 },
      {
        name: 'promoCode_1',
        background: true,
      },
    );

    // Compound index for userId + promoCode - for duplicate usage checks
    await collection.createIndex(
      { userId: 1, promoCode: 1 },
      {
        name: 'userId_1_promoCode_1',
        background: true,
      },
    );

    // Index for usedAt - for usage history queries
    await collection.createIndex(
      { usedAt: 1 },
      {
        name: 'usedAt_1',
        background: true,
      },
    );

    this.logger.log('Created indexes for promoCodeUsages collection');
  }

  /**
   * Create indexes for billingLogs collection
   */
  private async createBillingLogsIndexes(db: any): Promise<void> {
    const collection = db.collection(modelNames.BILLING_LOGS);

    // Index for subscriptionId - for subscription history queries
    await collection.createIndex(
      { subscriptionId: 1 },
      {
        name: 'subscriptionId_1',
        background: true,
      },
    );

    // Index for eventType - for filtering logs by type
    await collection.createIndex(
      { eventType: 1 },
      {
        name: 'eventType_1',
        background: true,
      },
    );

    // Compound index for subscriptionId + eventType
    await collection.createIndex(
      { subscriptionId: 1, eventType: 1 },
      {
        name: 'subscriptionId_1_eventType_1',
        background: true,
      },
    );

    this.logger.log('Created indexes for billingLogs collection');
  }

  /**
   * Create indexes for other collections
   */
  private async createOtherCollectionsIndexes(db: any): Promise<void> {
    // Products collection
    const productsCollection = db.collection(modelNames.PRODUCTS);
    await productsCollection.createIndex(
      { productId: 1 },
      {
        name: 'productId_1',
        unique: true,
        background: true,
      },
    );

    // Users collection
    const usersCollection = db.collection(modelNames.USERS);
    await usersCollection.createIndex(
      { userId: 1 },
      {
        name: 'userId_1',
        unique: true,
        background: true,
      },
    );

    // Discounts collection
    const discountsCollection = db.collection(modelNames.DISCOUNTS);
    await discountsCollection.createIndex(
      { discountId: 1 },
      {
        name: 'discountId_1',
        unique: true,
        background: true,
      },
    );
    // Index for applicableProducts - for product-specific discount queries
    await discountsCollection.createIndex(
      { applicableProducts: 1 },
      {
        name: 'applicableProducts_1',
        background: true,
      },
    );

    // PromoCodes collection
    const promoCodesCollection = db.collection(modelNames.PROMO_CODES);
    await promoCodesCollection.createIndex(
      { code: 1 },
      {
        name: 'code_1',
        unique: true,
        background: true,
      },
    );
    // Index for discountId - for discount-related promo code queries
    await promoCodesCollection.createIndex(
      { discountId: 1 },
      {
        name: 'discountId_1',
        background: true,
      },
    );
    // Index for assignedUserId - for exclusive promo code queries
    await promoCodesCollection.createIndex(
      { assignedUserId: 1 },
      {
        name: 'assignedUserId_1',
        background: true,
      },
    );
    // Index for applicableProducts - for product-specific promo code queries
    await promoCodesCollection.createIndex(
      { applicableProducts: 1 },
      {
        name: 'applicableProducts_1',
        background: true,
      },
    );

    // Refunds collection
    const refundsCollection = db.collection(modelNames.REFUNDS);
    await refundsCollection.createIndex(
      { refundId: 1 },
      {
        name: 'refundId_1',
        unique: true,
        background: true,
      },
    );
    await refundsCollection.createIndex(
      { subscriptionId: 1 },
      {
        name: 'subscriptionId_1',
        background: true,
      },
    );

    // Config collection
    const configCollection = db.collection(modelNames.CONFIG);
    await configCollection.createIndex(
      { configId: 1 },
      {
        name: 'configId_1',
        unique: true,
        background: true,
      },
    );

    // Rules collection
    const rulesCollection = db.collection(modelNames.RULES);
    await rulesCollection.createIndex(
      { ruleId: 1 },
      {
        name: 'ruleId_1',
        unique: true,
        background: true,
      },
    );

    this.logger.log('Created indexes for other collections');
  }
}
