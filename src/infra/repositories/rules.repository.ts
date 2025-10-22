import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Rules } from '../../domain/entities/rules.entity';
import { modelNames, IRulesDocument } from '../models/models.definition';

@Injectable()
export class RulesRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  /**
   * Save a rules entity to the database
   * @param entity The rules entity to save
   * @returns The saved rules entity with ID, or undefined if invalid
   */
  public async save(entity: Rules): Promise<CustomDefinition.TNullable<Rules>> {
    if (!entity) {
      return undefined;
    }

    if (!CustomValidator.nonEmptyString(entity.id)) {
      // Create new document
      const doc = <IRulesDocument>{
        ruleId: entity.ruleId,
        type: entity.type,
        conditions: entity.conditions,
        actions: entity.actions,
      };
      const col = this.defMongoClient.getCollection(modelNames.RULES);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    // Update existing document
    const filter = { _id: CustomUtils.stringToObjectId(entity.id) };
    const updateDoc = {
      $set: {
        ruleId: entity.ruleId,
        type: entity.type,
        conditions: entity.conditions,
        actions: entity.actions,
        updatedAt: new Date(),
      },
    };
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    await col.updateOne(filter, updateDoc);
    return entity;
  }

  /**
   * Find a rule by its ruleId
   * @param ruleId The rule identifier
   * @returns The rules entity if found, undefined otherwise
   */
  public async findByRuleId(ruleId: string): Promise<CustomDefinition.TNullable<Rules>> {
    if (!CustomValidator.nonEmptyString(ruleId)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    const q = { ruleId };
    const doc = (await col.findOne(q)) as IRulesDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(Rules, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }

  /**
   * Find all rules by type
   * @param type The rule type (e.g., 'discount', 'billing')
   * @returns Array of rules entities
   */
  public async findByType(type: string): Promise<Rules[]> {
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    const q = { type };
    const docs = (await col.find(q).toArray()) as IRulesDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Rules, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  /**
   * Find all rules
   * @returns Array of all rules entities
   */
  public async findAll(): Promise<Rules[]> {
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    const docs = (await col.find({}).toArray()) as IRulesDocument[];
    return docs.map(doc => {
      const ent = plainToInstance(Rules, doc);
      ent.id = doc._id.toHexString();
      return ent;
    });
  }

  /**
   * Delete a rule by its ruleId
   * @param ruleId The rule identifier
   * @returns True if deleted, false otherwise
   */
  public async deleteByRuleId(ruleId: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(ruleId)) {
      return false;
    }
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    const q = { ruleId };
    const result = await col.deleteOne(q);
    return result.deletedCount > 0;
  }

  /**
   * Delete a rule by its entity ID
   * @param id The entity ID
   * @returns True if deleted, false otherwise
   */
  public async deleteById(id: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(id)) {
      return false;
    }
    const col = this.defMongoClient.getCollection(modelNames.RULES);
    const q = { _id: CustomUtils.stringToObjectId(id) };
    const result = await col.deleteOne(q);
    return result.deletedCount > 0;
  }
}