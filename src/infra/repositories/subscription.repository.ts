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

    const doc: Partial<ISubscriptionDocument> = {
      subscriptionId: entity.subscriptionId,
      userId: new ObjectId(entity.userId),
      productId: entity.productId,
      status: entity.status,
      cycleType: entity.cycleType,
      startDate: entity.startDate,
      nextBillingDate: entity.nextBillingDate,
      renewalCount: entity.renewalCount,
      remainingDiscountPeriods: entity.remainingDiscountPeriods,
      pendingConversion: entity.pendingConversion,
      updatedAt: new Date(),
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // New entity
      doc.createdAt = new Date();
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      const docRes = await col.insertOne(doc as ISubscriptionDocument);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      // Update existing
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTIONS);
      const q = { _id: new ObjectId(entity.id) };
      await col.updateOne(q, { $set: doc });
      return entity;
    }
  }
}