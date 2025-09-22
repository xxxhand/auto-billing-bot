import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
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
      id: entity.id,
      subscriptionId: entity.subscriptionId,
      action: entity.action,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增操作日誌 - 生成ID
      entity.id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const doc = <IOperationLogDocument>{
        id: entity.id,
        subscriptionId: entity.subscriptionId,
        action: entity.action,
      };
      const col = this.defMongoClient.getCollection(modelNames.OPERATION_LOGS);
      await col.insertOne(doc);
      return entity;
    }

    return entity;
  }
}
