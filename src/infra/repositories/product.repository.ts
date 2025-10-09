import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { ProductEntity } from '../../domain/entities/product.entity';
import { modelNames, IProductDocument } from '../models/models.definition';

@Injectable()
export class ProductRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async findAll(): Promise<ProductEntity[]> {
    const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
    const docs = (await col.find({}).toArray()) as IProductDocument[];
    return docs.map((doc) => {
      const ent = plainToInstance(ProductEntity, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  public async findByProductId(productId: string): Promise<CustomDefinition.TNullable<ProductEntity>> {
    if (!CustomValidator.nonEmptyString(productId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
    const q = { productId };
    const doc = (await col.findOne(q)) as IProductDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(ProductEntity, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }
}
