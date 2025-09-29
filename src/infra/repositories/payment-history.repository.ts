import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PaymentResult } from '../../domain';
import { modelNames, IPaymentHistoryDocument } from '../models/models.definition';

@Injectable()
export class PaymentHistoryRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(payment: PaymentResult, subscriptionId: string, amount: number): Promise<void> {
    const doc = {
      subscriptionId,
      amount,
      status: payment.status,
      failureReason: payment.failureReason,
      retryCount: payment.retryCount,
      isManual: payment.isManual,
      isAuto: payment.isAuto,
      createdAt: new Date().toISOString(),
    };

    const col = this.defMongoClient.getCollection(modelNames.PAYMENT_HISTORY);
    await col.insertOne(doc);
  }

  public async findBySubscriptionId(subscriptionId: string): Promise<PaymentResult[]> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.PAYMENT_HISTORY);
    const docs = (await col.find({ subscriptionId }).sort({ createdAt: -1 }).toArray()) as IPaymentHistoryDocument[];

    return docs.map((doc) => {
      return new PaymentResult(doc.status, doc.retryCount, doc.isManual, doc.isAuto, doc.failureReason);
    });
  }
}
