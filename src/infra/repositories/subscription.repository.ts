import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { modelNames, ISubscriptionDocument } from '../models/models.definition';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Find subscription by ID
   */
  public async findById(subscriptionId: string): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const q = { subscriptionId };
    const doc = (await col.findOne(q)) as ISubscriptionDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Subscription, doc);
    ent.id = doc._id.toHexString();
    ent.userId = doc.userId.toHexString();
    return ent;
  }

  /**
   * Find active subscriptions that are due for billing
   */
  public async findActiveSubscriptionsDueForBilling(now: Date): Promise<Subscription[]> {
    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const q = {
      status: 'active',
      nextBillingDate: { $lte: now },
    };
    const docs = (await col.find(q).toArray()) as ISubscriptionDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(Subscription, doc);
      ent.id = doc._id.toHexString();
      ent.userId = doc.userId.toHexString();
      return ent;
    });
  }

  /**
   * Find subscriptions by user ID
   */
  public async findByUserId(userId: string): Promise<Subscription[]> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return [];
    }
    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const q = { userId: CustomUtils.stringToObjectId(userId) };
    const docs = (await col.find(q).toArray()) as ISubscriptionDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(Subscription, doc);
      ent.id = doc._id.toHexString();
      ent.userId = doc.userId.toHexString();
      return ent;
    });
  }

  /**
   * Save subscription entity
   */
  public async save(entity: Subscription): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!entity) {
      return undefined;
    }

    const now = new Date();
    const doc: Partial<ISubscriptionDocument> = {
      productId: entity.productId,
      status: entity.status,
      cycleType: entity.cycleType,
      startDate: entity.startDate,
      nextBillingDate: entity.nextBillingDate,
      renewalCount: entity.renewalCount,
      remainingDiscountPeriods: entity.remainingDiscountPeriods,
      pendingConversion: entity.pendingConversion,
      updatedAt: now,
    };

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    if (!CustomValidator.nonEmptyString(entity.id)) {
      // New entity
      doc.subscriptionId = entity.subscriptionId;
      doc.userId = CustomUtils.stringToObjectId(entity.userId);
      doc.createdAt = now;
      const docRes = await col.insertOne(doc as ISubscriptionDocument);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }
    // Update existing
    const q = { _id: CustomUtils.stringToObjectId(entity.id) };
    await col.updateOne(q, { $set: doc });
    return entity;
  }
}
