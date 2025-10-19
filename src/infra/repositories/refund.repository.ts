import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Refund } from '../../domain/entities/refund.entity';
import { modelNames, IRefundDocument } from '../models/models.definition';

@Injectable()
export class RefundRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Create a new refund record
   */
  async create(refund: Refund): Promise<Refund> {
    const refundModel: Partial<IRefundDocument> = {
      refundId: refund.refundId,
      subscriptionId: refund.subscriptionId,
      amount: refund.amount,
      status: refund.status,
      createdAt: refund.createdAt,
      updatedAt: new Date(),
      valid: true,
    };

    const col = this.defMongoClient.getCollection(modelNames.REFUNDS);
    const docRes = await col.insertOne(refundModel as IRefundDocument);
    refund.id = docRes.insertedId.toHexString();
    return refund;
  }

  /**
   * Find refund by ID
   */
  async findById(refundId: string): Promise<CustomDefinition.TNullable<Refund>> {
    if (!CustomValidator.nonEmptyString(refundId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.REFUNDS);
    const q = { refundId };
    const doc = (await col.findOne(q)) as IRefundDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Refund, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  /**
   * Find refunds by subscription ID
   */
  async findBySubscriptionId(subscriptionId: string): Promise<Refund[]> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return [];
    }
    const col = this.defMongoClient.getCollection(modelNames.REFUNDS);
    const q = { subscriptionId };
    const docs = (await col.find(q).toArray()) as IRefundDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(Refund, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  /**
   * Update refund status
   */
  async update(refund: Refund): Promise<Refund> {
    const now = new Date();
    const doc: Partial<IRefundDocument> = {
      status: refund.status,
      updatedAt: now,
    };

    const col = this.defMongoClient.getCollection(modelNames.REFUNDS);
    const q = { _id: CustomUtils.stringToObjectId(refund.id) };
    await col.updateOne(q, { $set: doc });
    return refund;
  }
}