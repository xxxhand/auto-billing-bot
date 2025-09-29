import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { Subscription } from '../../domain/entities/subscription.entity';
import { modelNames, ISubscriptionDocument } from '../models/models.definition';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(entity: Subscription): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!entity) {
      return undefined;
    }

    const doc = <ISubscriptionDocument>{
      id: entity.id,
      userId: entity.userId,
      productId: entity.productId,
      billingCycle: entity.billingCycle,
      status: entity.status,
      startDate: entity.startDate,
      endDate: entity.endDate,
      nextBillingDate: entity.nextBillingDate,
      lastBillingDate: entity.lastBillingDate,
      gracePeriodEndDate: entity.gracePeriodEndDate,
      couponApplied: entity.couponApplied,
      renewalCount: entity.renewalCount,
    };

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    if (!CustomValidator.nonEmptyString(entity.id)) {
      // Insert new document
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
    } else {
      // Update existing document
      await col.updateOne({ id: entity.id }, { $set: doc });
    }

    return entity;
  }

  public async findById(id: string): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const doc = await col.findOne({ id });

    if (!doc) {
      return undefined;
    }

    return plainToInstance(Subscription, {
      id: doc.id,
      userId: doc.userId,
      productId: doc.productId,
      billingCycle: doc.billingCycle,
      status: doc.status,
      startDate: doc.startDate,
      endDate: doc.endDate,
      nextBillingDate: doc.nextBillingDate,
      lastBillingDate: doc.lastBillingDate,
      gracePeriodEndDate: doc.gracePeriodEndDate,
      couponApplied: doc.couponApplied,
      renewalCount: doc.renewalCount,
    });
  }

  public async findByUserId(userId: string): Promise<Subscription[]> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const docs = await col.find({ userId }).toArray();

    return docs.map((doc) =>
      plainToInstance(Subscription, {
        id: doc.id,
        userId: doc.userId,
        productId: doc.productId,
        billingCycle: doc.billingCycle,
        status: doc.status,
        startDate: doc.startDate,
        endDate: doc.endDate,
        nextBillingDate: doc.nextBillingDate,
        lastBillingDate: doc.lastBillingDate,
        gracePeriodEndDate: doc.gracePeriodEndDate,
        couponApplied: doc.couponApplied,
        renewalCount: doc.renewalCount,
      }),
    );
  }

  public async findActiveByUserId(userId: string): Promise<Subscription[]> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const docs = await col.find({ userId, status: 'active' }).toArray();

    return docs.map((doc) =>
      plainToInstance(Subscription, {
        id: doc.id,
        userId: doc.userId,
        productId: doc.productId,
        billingCycle: doc.billingCycle,
        status: doc.status,
        startDate: doc.startDate,
        endDate: doc.endDate,
        nextBillingDate: doc.nextBillingDate,
        lastBillingDate: doc.lastBillingDate,
        gracePeriodEndDate: doc.gracePeriodEndDate,
        couponApplied: doc.couponApplied,
        renewalCount: doc.renewalCount,
      }),
    );
  }
}
