import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { SubscriptionRepository } from './infra/repositories/subscription.repository';
import { ProductRepository } from './infra/repositories/product.repository';
import { PaymentHistoryRepository } from './infra/repositories/payment-history.repository';
import { OperationLogRepository } from './infra/repositories/operation-log.repository';
import { SubscriptionService } from './domain/services/subscription.service';
import { PaymentService } from './domain/services/payment.service';
import { SubscriptionApplicationService } from './application/services/subscription-application.service';
import { PaymentApplicationService } from './application/services/payment-application.service';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
import * as jobs from './application/jobs';
import { ExampleController } from './application/controllers/exemple.controller';
import { SubscriptionController } from './application/controllers/subscription.controller';
@Module({
  imports: [CommonModule, ScheduleModule.forRoot()],
  controllers: [AppController, ExampleController, SubscriptionController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    ExampleRepository,
    SubscriptionRepository,
    ProductRepository,
    PaymentHistoryRepository,
    OperationLogRepository,
    SubscriptionService,
    PaymentService,
    SubscriptionApplicationService,
    PaymentApplicationService,
    ...Array.from(Object.keys(jobs)).map((key) => jobs[key]),
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap, BeforeApplicationShutdown {
  constructor(private readonly cmmService: CommonService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppTracerMiddleware).forRoutes('*');
  }

  async onApplicationBootstrap() {}

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  async beforeApplicationShutdown(signal?: string) {
    this.cmmService.releaseResources();
  }
}
