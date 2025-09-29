import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Coupon } from '../../domain';
import { modelNames, ICouponDocument } from '../models/models.definition';

@Injectable()
export class CouponRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(entity: Coupon): Promise<CustomDefinition.TNullable<Coupon>> {
    if (!entity) {
      return undefined;
    }

    const doc = {
      code: entity.code,
      discountPercentage: entity.discountPercentage,
      usedBy: entity.usedBy,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      const col = this.defMongoClient.getCollection(modelNames.COUPON);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      const col = this.defMongoClient.getCollection(modelNames.COUPON);
      await col.updateOne({ _id: CustomUtils.stringToObjectId(entity.id) }, { $set: doc });
      return entity;
    }
  }

  public async findByCode(code: string): Promise<CustomDefinition.TNullable<Coupon>> {
    if (!CustomValidator.nonEmptyString(code)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.COUPON);
    const doc = (await col.findOne({ code })) as ICouponDocument;

    if (!doc) {
      return undefined;
    }

    const entity = plainToInstance(Coupon, doc);
    entity.id = doc._id.toHexString();
    return entity;
  }
}
