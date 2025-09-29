import { Module, Global, OnModuleInit } from '@nestjs/common';
import { CustomDefinition, TEasyTranslator, CustomHttpClient, CustomMongoClient } from '@xxxhand/app-common';
import { ConfModule, ConfService } from '@myapp/conf';
import { errCodes } from './err.code';
import { ErrException } from './err.exception';
import { CommonService } from './common.service';
import { DEFAULT_MONGO, DEFAULT_TRANSLATE, DEFAULT_HTTP_CLIENT, DEFAULT_REDIS } from './common.const';
import { EasyTranslateService } from './components/easy-translate.service';
import { AsyncLocalStorageProvider } from './clients/async-local-storage.provider';
import * as Redis from 'ioredis';

@Global()
@Module({
  imports: [ConfModule],
  providers: [
    CommonService,
    ConfService,
    {
      provide: DEFAULT_MONGO,
      useFactory: async (confService: ConfService): Promise<CustomMongoClient> => {
        const uri = confService.getConf().defaultMongo.uri;
        const opt: CustomDefinition.IMongoOptions = {
          minPoolSize: confService.getConf().defaultMongo.minPoolSize,
          maxPoolSize: confService.getConf().defaultMongo.maxPoolSize,
          connectTimeoutMS: confService.getConf().defaultMongo.connectTimeout,
          db: confService.getConf().defaultMongo.dbName,
          user: confService.getConf().defaultMongo.user,
          pass: confService.getConf().defaultMongo.password,
        };
        const client = new CustomMongoClient(uri, opt);
        client.tryConnect().catch((ex) => console.error(ex));
        return client;
      },
      inject: [ConfService],
    },
    {
      provide: DEFAULT_TRANSLATE,
      useFactory: async (confService: ConfService): Promise<TEasyTranslator> => {
        const tr = new EasyTranslateService(confService.getConf().localesPath, confService.getConf().fallbackLocale);
        await tr.initial();
        return tr;
      },
      inject: [ConfService],
    },
    {
      provide: DEFAULT_HTTP_CLIENT,
      useClass: CustomHttpClient,
    },
    {
      provide: DEFAULT_REDIS,
      useFactory: async (confService: ConfService): Promise<Redis.Redis> => {
        const redisUrl = confService.getConf().redisUrl;
        const client = new (Redis as any)(redisUrl);
        return client;
      },
      inject: [ConfService],
    },
    AsyncLocalStorageProvider,
  ],
  exports: [CommonService, DEFAULT_MONGO, DEFAULT_HTTP_CLIENT, DEFAULT_REDIS],
})
export class CommonModule implements OnModuleInit {
  onModuleInit() {
    // Initial all error codes
    ErrException.addCodes(errCodes);
  }
}
