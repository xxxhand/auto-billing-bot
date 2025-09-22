import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PaymentHistory } from '../../domain/entities/payment-history.entity';
import { modelNames, IPaymentHistoryDocument } from '../models/models.definition';

@Injectable()
export class PaymentHistoryRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * 儲存支付歷史實體
   */
  public async save(entity: PaymentHistory): Promise<CustomDefinition.TNullable<PaymentHistory>> {
    if (!entity) {
      return undefined;
    }

    const doc = <IPaymentHistoryDocument>{
      subscriptionId: entity.subscriptionId,
      amount: entity.amount,
      status: entity.status,
      failureReason: entity.failureReason,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增支付歷史
      const col = this.defMongoClient.getCollection(modelNames.PAYMENT_HISTORY);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    return entity;
  }

  /**
   * 根據訂閱ID查詢支付歷史
   */
  public async findBySubscriptionId(subscriptionId: string): Promise<PaymentHistory[]> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.PAYMENT_HISTORY);
    const filter = { subscriptionId };
    const docs = await col.find(filter).sort({ createdAt: -1 }).toArray();

    return docs.map((doc) => {
      const entity = plainToInstance(PaymentHistory, {
        id: doc._id.toHexString(),
        subscriptionId: doc.subscriptionId,
        amount: doc.amount,
        status: doc.status,
        failureReason: doc.failureReason,
        createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
      });
      return entity;
    });
  }
}
