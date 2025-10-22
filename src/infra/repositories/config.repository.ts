import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Config, ConfigType } from '../../domain/entities/config.entity';
import { modelNames, IConfigDocument } from '../models/models.definition';

@Injectable()
export class ConfigRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Save a config entity to the database
   * @param entity The config entity to save
   * @returns The saved config entity with ID, or undefined if invalid
   */
  public async save(entity: Config): Promise<CustomDefinition.TNullable<Config>> {
    if (!entity) {
      return undefined;
    }

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // Create new document
      const doc = <IConfigDocument>{
        configId: entity.configId,
        type: entity.type,
        productId: entity.productId,
        gracePeriodDays: entity.gracePeriodDays,
        refundPolicy: entity.refundPolicy,
      };
      const col = this.defMongoClient.getCollection(modelNames.CONFIG);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    // Update existing document
    const filter = { _id: CustomUtils.stringToObjectId(entity.id) };
    const updateDoc = {
      $set: {
        configId: entity.configId,
        type: entity.type,
        productId: entity.productId,
        gracePeriodDays: entity.gracePeriodDays,
        refundPolicy: entity.refundPolicy,
        updatedAt: new Date(),
      },
    };
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    await col.updateOne(filter, updateDoc);
    return entity;
  }

  /**
   * Find a config by its configId
   * @param configId The config identifier
   * @returns The config entity if found, undefined otherwise
   */
  public async findByConfigId(configId: string): Promise<CustomDefinition.TNullable<Config>> {
    if (!CustomValidator.nonEmptyString(configId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { configId };
    const doc = (await col.findOne(q)) as IConfigDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Config, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  /**
   * Find all configs by type
   * @param type The config type ('global' or 'product')
   * @returns Array of config entities
   */
  public async findByType(type: ConfigType): Promise<Config[]> {
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { type };
    const docs = (await col.find(q).toArray()) as IConfigDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Config, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  /**
   * Find a product-specific config by productId
   * @param productId The product identifier
   * @returns The config entity if found, undefined otherwise
   */
  public async findByProductId(productId: string): Promise<CustomDefinition.TNullable<Config>> {
    if (!CustomValidator.nonEmptyString(productId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { type: 'product', productId };
    const doc = (await col.findOne(q)) as IConfigDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Config, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  /**
   * Find the global config
   * @returns The global config entity if found, undefined otherwise
   */
  public async findGlobalConfig(): Promise<CustomDefinition.TNullable<Config>> {
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { type: 'global' };
    const doc = (await col.findOne(q)) as IConfigDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Config, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  /**
   * Find all configs (both global and product-specific)
   * @returns Array of all config entities
   */
  public async findAll(): Promise<Config[]> {
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const docs = (await col.find({}).toArray()) as IConfigDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Config, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  /**
   * Delete a config by its configId
   * @param configId The config identifier
   * @returns True if deleted, false otherwise
   */
  public async deleteByConfigId(configId: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(configId)) {
      return false;
    }
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { configId };
    const result = await col.deleteOne(q);
    return result.deletedCount > 0;
  }

  /**
   * Delete a config by its entity ID
   * @param id The entity ID
   * @returns True if deleted, false otherwise
   */
  public async deleteById(id: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(id)) {
      return false;
    }
    const col = this.defMongoClient.getCollection(modelNames.CONFIG);
    const q = { _id: CustomUtils.stringToObjectId(id) };
    const result = await col.deleteOne(q);
    return result.deletedCount > 0;
  }
}