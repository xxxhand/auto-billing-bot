import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Discount } from '../../domain/entities/discount.entity';
import { modelNames, IDiscountDocument } from '../models/models.definition';

@Injectable()
export class DiscountRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Save a discount entity to the database
   * @param entity The discount entity to save
   * @returns The saved discount entity with ID, or undefined if invalid
   */
  public async save(entity: Discount): Promise<CustomDefinition.TNullable<Discount>> {
    if (!entity) {
      return undefined;
    }
    const now = new Date();

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // Create new document
      const doc = <IDiscountDocument>{
        discountId: entity.discountId,
        type: entity.type,
        value: entity.value,
        priority: entity.priority,
        startDate: entity.startDate,
        endDate: entity.endDate,
        applicableProducts: entity.applicableProducts,
        discountPeriods: entity.discountPeriods,
        extraPeriods: entity.extraPeriods,
        createdAt: now,
        updatedAt: now,
        valid: true,
      };
      const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    // Update existing document
    const filter = { _id: CustomUtils.stringToObjectId(entity.id) };
    const updateDoc = {
      $set: {
        discountId: entity.discountId,
        type: entity.type,
        value: entity.value,
        priority: entity.priority,
        startDate: entity.startDate,
        endDate: entity.endDate,
        applicableProducts: entity.applicableProducts,
        discountPeriods: entity.discountPeriods,
        extraPeriods: entity.extraPeriods,
        updatedAt: now,
        valid: entity.valid
      },
    };
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    await col.updateOne(filter, updateDoc);
    return entity;
  }

  public async findAll(): Promise<Discount[]> {
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    const docs = (await col.find({}).toArray()) as IDiscountDocument[];
    return docs.map((doc) => {
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
      endDate: { $gte: now },
    };

    let query: any;
    if (CustomValidator.nonEmptyString(productId)) {
      // Find discounts that either apply to all products (empty applicableProducts) or include the specific product
      query = {
        ...baseQuery,
        $or: [
          { applicableProducts: { $size: 0 } }, // Empty array means global applicable
          { applicableProducts: productId },
        ],
      };
    } else {
      // If no productId specified, only return global discounts
      query = {
        ...baseQuery,
        applicableProducts: { $size: 0 },
      };
    }

    const docs = (await col.find(query).sort({ priority: -1 }).toArray()) as IDiscountDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(Discount, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async findRenewalDiscounts(productId?: string): Promise<Discount[]> {
    const col = this.defMongoClient.getCollection(modelNames.DISCOUNTS);
    const now = new Date();

    // Query for discounts that are currently valid and can be used for renewals
    // For renewals, we look for discounts that apply to the specific product
    const baseQuery = {
      valid: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    let query: any;
    if (CustomValidator.nonEmptyString(productId)) {
      // Find discounts that apply to the specific product (renewal discounts are product-specific)
      query = {
        ...baseQuery,
        applicableProducts: productId,
      };
    } else {
      // If no productId specified, only return global discounts
      query = {
        ...baseQuery,
        applicableProducts: { $size: 0 },
      };
    }

    const docs = (await col.find(query).sort({ priority: -1 }).toArray()) as IDiscountDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(Discount, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }
}
