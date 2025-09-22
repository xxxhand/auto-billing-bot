import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { modelNames, ISubscriptionDocument } from '../models/models.definition';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * 儲存訂閱實體
   */
  public async save(entity: Subscription): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!entity) {
      return undefined;
    }

    const doc = <ISubscriptionDocument>{
      id: entity.id,
      userId: entity.userId,
      productId: entity.productId,
      startDate: entity.startDate,
      nextBillingDate: entity.nextBillingDate,
      status: entity.status,
      createdAt: new Date(entity.createdAt),
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增訂閱 - 生成ID
      entity.id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const doc = <ISubscriptionDocument>{
        id: entity.id,
        userId: entity.userId,
        productId: entity.productId,
        startDate: entity.startDate,
        nextBillingDate: entity.nextBillingDate,
        status: entity.status,
        createdAt: new Date(entity.createdAt),
      };
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      await col.insertOne(doc);
      return entity;
    } else {
      // 更新訂閱
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      const filter = { id: entity.id };
      await col.updateOne(filter, { $set: doc });
      return entity;
    }
  }

  /**
   * 根據ID查詢訂閱
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const filter = { id: id };
    const doc = (await col.findOne(filter)) as ISubscriptionDocument;

    if (!doc) {
      return undefined;
    }

    try {
      const entity = plainToInstance(Subscription, {
        id: doc.id,
        userId: doc.userId,
        productId: doc.productId,
        startDate: doc.startDate,
        nextBillingDate: doc.nextBillingDate,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
      });
      return entity;
    } catch (error) {
      console.error('Error converting document to Subscription entity:', error.stack);
      return undefined;
    }
  }

  /**
   * 根據使用者ID查詢所有訂閱
   */
  public async findByUserId(userId: string): Promise<Subscription[]> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const filter = { userId };
    const docs = await col.find(filter).toArray();

    return docs.map((doc) => {
      const entity = plainToInstance(Subscription, {
        id: doc._id.toHexString(),
        userId: doc.userId,
        productId: doc.productId,
        startDate: doc.startDate,
        nextBillingDate: doc.nextBillingDate,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
      });
      return entity;
    });
  }
}
