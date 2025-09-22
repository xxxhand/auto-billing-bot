import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { OperationLog } from '../../domain/entities/operation-log.entity';
import { modelNames, IOperationLogDocument } from '../models/models.definition';

@Injectable()
export class OperationLogRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * 儲存操作日誌實體
   */
  public async save(entity: OperationLog): Promise<CustomDefinition.TNullable<OperationLog>> {
    if (!entity) {
      return undefined;
    }

    const doc = <IOperationLogDocument>{
      subscriptionId: entity.subscriptionId,
      action: entity.action,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增操作日誌
      const col = this.defMongoClient.getCollection(modelNames.OPERATION_LOGS);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    return entity;
  }
}
