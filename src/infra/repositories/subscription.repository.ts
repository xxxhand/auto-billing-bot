import { DEFAULT_MONGO, CommonService } from '@myapp/common';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient, CustomUtils } from '@xxxhand/app-common';
import { Subscription } from '../../domain';
import { modelNames, ISubscriptionDocument } from '../models/models.definition';

@Injectable()
export class SubscriptionRepository {
  private _logger: LoggerService;
  constructor(
    @Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient,
    private readonly commonService: CommonService,
  ) {
    this._logger = this.commonService.getDefaultLogger(SubscriptionRepository.name);
  }

  public async save(entity: Subscription): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!entity) {
      return undefined;
    }

    const doc = {
      userId: entity.userId,
      productId: entity.productId,
      startDate: entity.startDate,
      nextBillingDate: entity.nextBillingDate,
      status: entity.status,
      createdAt: entity.createdAt,
      renewalCount: entity.renewalCount,
      couponCode: entity.couponCode,
    };

    this._logger.log(`Saving subscription entity for user ${entity.userId} with product ${entity.productId}.`);
    if (!CustomValidator.nonEmptyString(entity.id)) {
      // Insert new document
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    } else {
      // Update existing document
      const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
      await col.updateOne({ _id: CustomUtils.stringToObjectId(entity.id) }, { $set: doc });
      return entity;
    }
  }

  public async findById(id: string): Promise<CustomDefinition.TNullable<Subscription>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const doc = (await col.findOne({ _id: CustomUtils.stringToObjectId(id) })) as ISubscriptionDocument;

    if (!doc) {
      return undefined;
    }

    const entity = plainToInstance(Subscription, doc);
    entity.id = doc._id.toHexString();
    return entity;
  }

  public async findByUserId(userId: string): Promise<Subscription[]> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return [];
    }

    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const docs = (await col.find({ userId }).toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => {
      const entity = plainToInstance(Subscription, doc);
      entity.id = doc._id.toHexString();
      return entity;
    });
  }

  public async findDueSubscriptions(date: string): Promise<Subscription[]> {
    const col = this.defMongoClient.getCollection(modelNames.SUBSCRIPTION);
    const docs = (await col
      .find({
        status: 'active',
        nextBillingDate: { $lte: date },
      })
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => {
      const entity = plainToInstance(Subscription, doc);
      entity.id = doc._id.toHexString();
      return entity;
    });
  }
}
