import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { Product } from '../../domain/entities/product.entity';
import { modelNames, IProductDocument } from '../models/models.definition';

@Injectable()
export class ProductRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * 儲存產品實體
   */
  public async save(entity: Product): Promise<CustomDefinition.TNullable<Product>> {
    if (!entity) {
      return undefined;
    }

    const doc = <IProductDocument>{
      name: entity.name,
      cycleType: entity.cycleType,
      price: entity.price,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增產品
      const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      // 更新產品
      const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
      const filter = { _id: new ObjectId(entity.id) };
      await col.updateOne(filter, { $set: doc });
      return entity;
    }
  }

  /**
   * 查詢所有產品
   */
  public async findAll(): Promise<Product[]> {
    const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
    const docs = await col.find({}).toArray();

    return docs.map((doc) => {
      const entity = plainToInstance(Product, {
        id: doc._id.toHexString(),
        name: doc.name,
        cycleType: doc.cycleType,
        price: doc.price,
      });
      return entity;
    });
  }

  /**
   * 根據ID查詢產品
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<Product>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
    const filter = { _id: new ObjectId(id) };
    const doc = (await col.findOne(filter)) as IProductDocument;

    if (!doc) {
      return undefined;
    }

    const entity = plainToInstance(Product, {
      id: doc._id.toHexString(),
      name: doc.name,
      cycleType: doc.cycleType,
      price: doc.price,
    });

    return entity;
  }
}
