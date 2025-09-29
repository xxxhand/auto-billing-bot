import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { CustomMongoClient } from '@xxxhand/app-common';
import { modelNames } from '../models/models.definition';

@Injectable()
export class OperationLogRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(subscriptionId: string, action: string): Promise<void> {
    const doc = {
      subscriptionId,
      action,
      createdAt: new Date().toISOString(),
    };

    const col = this.defMongoClient.getCollection(modelNames.OPERATION_LOG);
    await col.insertOne(doc);
  }
}
