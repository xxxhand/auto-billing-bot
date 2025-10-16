import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { modelNames } from '../models/models.definition';

@Injectable()
export class UserRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async existsByUserId(userId: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(userId)) {
      return false;
    }
    const col = this.defMongoClient.getCollection(modelNames.USERS);
    let queryUserId: string | ObjectId = userId;

    // Try to convert to ObjectId if it's a valid ObjectId string
    if (ObjectId.isValid(userId)) {
      try {
        queryUserId = new ObjectId(userId);
      } catch (error) {
        // If conversion fails, use the string as-is
      }
    }

    const q = { userId: queryUserId };
    const count = await col.countDocuments(q);
    return count > 0;
  }
}
