import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { Discount } from '../../domain/entities/discount.entity';
import { modelNames, IDiscountDocument } from '../models/models.definition';

@Injectable()
export class DiscountRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async findAll(): Promise<Discount[]> {
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    const docs = (await col.find({}).toArray()) as IDiscountDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Discount, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async findByDiscountId(discountId: string): Promise<CustomDefinition.TNullable<Discount>> {
    if (!CustomValidator.nonEmptyString(discountId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    const q = { discountId };
    const doc = (await col.findOne(q)) as IDiscountDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Discount, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  public async findApplicableDiscounts(productId?: string): Promise<Discount[]> {
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    const now = new Date();

    // Query for discounts that are currently valid
    const baseQuery = {
      valid: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    };

    let query;
    if (productId) {
      // Find discounts that either apply to all products (empty applicableProducts) or include the specific product
      query = {
        ...baseQuery,
        $or: [
          { applicableProducts: { $size: 0 } }, // Empty array means global applicable
          { applicableProducts: productId }
        ]
      };
    } else {
      // If no productId specified, only return global discounts
      query = {
        ...baseQuery,
        applicableProducts: { $size: 0 }
      };
    }

    const docs = (await col.find(query).sort({ priority: -1 }).toArray()) as IDiscountDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Discount, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }
}