import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
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
      userId: entity.userId,
      productId: entity.productId,
      startDate: entity.startDate,
      nextBillingDate: entity.nextBillingDate,
      status: entity.status,
      createdAt: new Date(entity.createdAt),
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增訂閱
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      // 更新訂閱
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      const filter = { _id: new ObjectId(entity.id) };
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
    const filter = { _id: new ObjectId(id) };
    const doc = (await col.findOne(filter)) as ISubscriptionDocument;

    if (!doc) {
      return undefined;
    }

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
