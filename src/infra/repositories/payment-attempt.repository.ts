import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PaymentAttempt } from '../../domain/entities/payment-attempt.entity';
import { modelNames, IPaymentAttemptDocument } from '../models/models.definition';

@Injectable()
export class PaymentAttemptRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Find payment attempt by ID
   */
  public async findById(attemptId: string): Promise<CustomDefinition.TNullable<PaymentAttempt>> {
    if (!CustomValidator.nonEmptyString(attemptId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.PAYMENT_ATTEMPTS);
    const q = { attemptId };
    const doc = (await col.findOne(q)) as IPaymentAttemptDocument;
    if (!doc) {
      return undefined;
    }
    return plainToInstance(PaymentAttempt, doc);
  }

  /**
   * Find payment attempts by subscription ID
   */
  public async findBySubscriptionId(subscriptionId: string): Promise<PaymentAttempt[]> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return [];
    }
    const col = this.defMongoClient.getCollection(modelNames.PAYMENT_ATTEMPTS);
    const q = { subscriptionId };
    const docs = (await col.find(q).sort({ createdAt: -1 }).toArray()) as IPaymentAttemptDocument[];
    return docs.map((doc) => plainToInstance(PaymentAttempt, doc));
  }

  /**
   * Save payment attempt entity
   */
  public async save(entity: PaymentAttempt): Promise<CustomDefinition.TNullable<PaymentAttempt>> {
    if (!entity) {
      return undefined;
    }

    const doc: Partial<IPaymentAttemptDocument> = {
      attemptId: entity.attemptId,
      subscriptionId: entity.subscriptionId,
      status: entity.status,
      failureReason: entity.failureReason,
      retryCount: entity.retryCount,
      updatedAt: new Date(),
    };

    // Check if entity exists by attemptId
    const existing = await this.findById(entity.attemptId);
    if (!existing) {
      // New entity
      doc.createdAt = new Date();
      const col = this.defMongoClient.getCollection(modelNames.PAYMENT_ATTEMPTS);
      await col.insertOne(doc as IPaymentAttemptDocument);
      return entity;
    } else {
      // Update existing
      const col = this.defMongoClient.getCollection(modelNames.PAYMENT_ATTEMPTS);
      const q = { attemptId: entity.attemptId };
      await col.updateOne(q, { $set: doc });
      return entity;
    }
  }
}
