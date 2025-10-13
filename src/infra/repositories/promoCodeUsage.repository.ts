import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { PromoCodeUsage } from '../../domain/value-objects/promoCodeUsage.value-object';
import { modelNames, IPromoCodeUsageDocument } from '../models/models.definition';

@Injectable()
export class PromoCodeUsageRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async create(promoCodeUsage: PromoCodeUsage): Promise<string> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODE_USAGES);
    const doc = <IPromoCodeUsageDocument>{
      usageId: promoCodeUsage.usageId,
      promoCode: promoCodeUsage.promoCode,
      userId: CustomUtils.stringToObjectId(promoCodeUsage.userId),
      usedAt: promoCodeUsage.usedAt,
      orderAmount: promoCodeUsage.orderAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return promoCodeUsage.usageId;
  }

  public async findByUserId(userId: string): Promise<PromoCodeUsage[]> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODE_USAGES);
    const q = { userId: CustomUtils.stringToObjectId(userId) };
    const docs = (await col.find(q).toArray()) as IPromoCodeUsageDocument[];
    return docs.map((doc) => {
      const val = plainToInstance(PromoCodeUsage, doc);
      val.userId = doc.userId.toHexString();
      return val;
    });
  }

  public async findByPromoCode(promoCode: string): Promise<PromoCodeUsage[]> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODE_USAGES);
    const q = { promoCode };
    const docs = (await col.find(q).toArray()) as IPromoCodeUsageDocument[];
    return docs.map((doc) => {
      const val = plainToInstance(PromoCodeUsage, doc);
      val.userId = doc.userId.toHexString();
      return val;
    });
  }
}
