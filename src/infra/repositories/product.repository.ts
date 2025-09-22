import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
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
      id: entity.id,
      name: entity.name,
      cycleType: entity.cycleType,
      price: entity.price,
    };

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // 新增產品 - 生成ID
      entity.id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const doc = <IProductDocument>{
        id: entity.id,
        name: entity.name,
        cycleType: entity.cycleType,
        price: entity.price,
      };
      const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
      await col.insertOne(doc);
      return entity;
    } else {
      // 更新產品
      const col = this.defMongoClient.getCollection(modelNames.PRODUCTS);
      const filter = { id: entity.id };
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
        id: doc.id,
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
    const filter = { id: id };
    const doc = (await col.findOne(filter)) as IProductDocument;

    if (!doc) {
      return undefined;
    }

    const entity = plainToInstance(Product, {
      id: doc.id,
      name: doc.name,
      cycleType: doc.cycleType,
      price: doc.price,
    });

    return entity;
  }
}
