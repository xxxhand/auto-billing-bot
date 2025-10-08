import { ObjectId } from 'mongodb';
import { cmmConf } from '@myapp/conf';
import { CustomMongoClient, CustomUtils } from '@xxxhand/app-common';

export class MongoHelper {
  private _mongo: CustomMongoClient;
  constructor(postFix: string) {
    cmmConf.defaultMongo.dbName = `${process.env.DEFAULT_MONGO_DB_NAME}_${postFix}`;
    cmmConf.defaultMongo.uri = `${process.env.DEFAULT_MONGO_URI}_${postFix}`;

    this._mongo = new CustomMongoClient(cmmConf.defaultMongo.uri, {
      minPoolSize: Number.parseInt(process.env.DEFAULT_MONGO_MIN_POOL),
      maxPoolSize: Number.parseInt(process.env.DEFAULT_MONGO_MAX_POOL),
      user: process.env.DEFAULT_MONGO_USER,
      pass: process.env.DEFAULT_MONGO_PASS,
      db: cmmConf.defaultMongo.dbName,
      connectTimeoutMS: Number.parseInt(process.env.DEFAULT_MONGO_CONN_TIMEOUT),
    });
  }

  public get mongo(): CustomMongoClient {
    return this._mongo;
  }

  public async clear(): Promise<void> {
    this._mongo.client.db(cmmConf.defaultMongo.dbName).dropDatabase();
  }

  public newObjectId(addedSeconds: number = 0): ObjectId {
    if (addedSeconds <= 0) {
      addedSeconds = Number.parseInt(CustomUtils.makeRandomNumbers(7));
    }
    const time = new Date().getTime() / 1000 + addedSeconds;
    return ObjectId.createFromTime(time);
  }

  public newObjectAsString(addedSeconds: number = 0): string {
    return this.newObjectId(addedSeconds).toHexString();
  }
}
