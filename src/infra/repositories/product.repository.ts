import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Product } from '../../domain';
import { modelNames, IProductDocument } from '../models/models.definition';

@Injectable()
export class ProductRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(entity: Product): Promise<CustomDefinition.TNullable<Product>> {
    if (!entity) {
      return undefined;
    }

    const doc = {
      name: entity.name,
      cycleType: entity.cycleType,
      price: entity.price,
      discountPercentage: entity.discountPercentage,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      const col = this.defMongoClient.getCollection(modelNames.PRODUCT);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      const col = this.defMongoClient.getCollection(modelNames.PRODUCT);
      await col.updateOne({ _id: CustomUtils.stringToObjectId(entity.id) }, { $set: doc });
      return entity;
    }
  }

  public async findAll(): Promise<Product[]> {
    const col = this.defMongoClient.getCollection(modelNames.PRODUCT);
    const docs = (await col.find({}).toArray()) as IProductDocument[];

    return docs.map((doc) => {
      const entity = plainToInstance(Product, doc);
      entity.id = doc._id.toHexString();
      return entity;
    });
  }

  public async findById(id: string): Promise<CustomDefinition.TNullable<Product>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.PRODUCT);
    const doc = (await col.findOne({ _id: CustomUtils.stringToObjectId(id) })) as IProductDocument;

    if (!doc) {
      return undefined;
    }

    const entity = plainToInstance(Product, doc);
    entity.id = doc._id.toHexString();
    return entity;
  }
}
