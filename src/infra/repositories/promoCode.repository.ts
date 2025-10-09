import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PromoCode } from '../../domain/entities/promoCode.entity';
import { modelNames, IPromoCodeDocument } from '../models/models.definition';

@Injectable()
export class PromoCodeRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async findAll(): Promise<PromoCode[]> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);
    const docs = (await col.find({}).toArray()) as IPromoCodeDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(PromoCode, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async findByCode(code: string): Promise<CustomDefinition.TNullable<PromoCode>> {
    if (!CustomValidator.nonEmptyString(code)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);
    const q = { code };
    const doc = (await col.findOne(q)) as IPromoCodeDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(PromoCode, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  public async findByDiscountId(discountId: string): Promise<PromoCode[]> {
    if (!CustomValidator.nonEmptyString(discountId)) {
      return [];
    }
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);
    const q = { discountId };
    const docs = (await col.find(q).toArray()) as IPromoCodeDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(PromoCode, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async findApplicablePromoCodes(userId: string, productId?: string): Promise<PromoCode[]> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);

    // Base query: promo codes that can still be used
    const baseQuery: any = {
      $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    };

    // Add user assignment filter
    if (userId) {
      baseQuery.$or = baseQuery.$or || [];
      baseQuery.$or.push({ assignedUserId: userId }, { assignedUserId: { $exists: false } }, { assignedUserId: null });
    }

    let query;
    if (productId) {
      // Find promo codes that either apply to all products (empty applicableProducts) or include the specific product
      query = {
        ...baseQuery,
        $or: [
          ...(baseQuery.$or || []),
          { applicableProducts: { $size: 0 } }, // Empty array means global applicable
          { applicableProducts: productId },
        ],
      };
    } else {
      // If no productId specified, only return global promo codes
      query = {
        ...baseQuery,
        applicableProducts: { $size: 0 },
      };
    }

    const docs = (await col.find(query).toArray()) as IPromoCodeDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(PromoCode, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async create(promoCode: PromoCode): Promise<PromoCode> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);
    const doc = {
      code: promoCode.code,
      discountId: promoCode.discountId,
      usageLimit: promoCode.usageLimit,
      isSingleUse: promoCode.isSingleUse,
      usedCount: promoCode.usedCount,
      minimumAmount: promoCode.minimumAmount,
      assignedUserId: promoCode.assignedUserId,
      applicableProducts: promoCode.applicableProducts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await col.insertOne(doc);
    promoCode.id = result.insertedId.toHexString();
    return promoCode;
  }

  public async update(promoCode: PromoCode): Promise<void> {
    const col = this.defMongoClient.getCollection(modelNames.PROMO_CODES);
    const q = { code: promoCode.code };
    const updateDoc = {
      $set: {
        usedCount: promoCode.usedCount,
        updatedAt: new Date(),
      },
    };
    await col.updateOne(q, updateDoc);
  }
}
