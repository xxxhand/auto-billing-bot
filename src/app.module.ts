import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { SubscriptionRepository } from './infra/repositories/subscription.repository';
import { PaymentAttemptRepository } from './infra/repositories/payment-attempt.repository';
import { ProductRepository } from './infra/repositories/product.repository';
import { DiscountRepository } from './infra/repositories/discount.repository';
import { PromoCodeRepository } from './infra/repositories/promoCode.repository';
import { BillingService } from './infra/services/billing.service';
import { DatabaseIndexService } from './infra/services/database-index.service';
import { DiscountPriorityService } from './domain/services/discount-priority.service';
import { ProductsService } from './application/services/products.service';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
import * as jobs from './application/jobs';
import * as v1Controllers from './application/controllers/v1';
import { IPaymentGatewayToken } from './domain/services/payment-gateway.interface';
import { MockPaymentGateway } from './infra/payment/mock-payment.gateway';
import { ITaskQueueToken } from './domain/services/task-queue.interface';
import { MockTaskQueue } from './infra/queue/mock-task.queue';

@Module({
  imports: [CommonModule, ScheduleModule.forRoot()],
  controllers: [AppController, ...Array.from(Object.keys(v1Controllers)).map((key) => v1Controllers[key])],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    ExampleRepository,
    SubscriptionRepository,
    PaymentAttemptRepository,
    ProductRepository,
    DiscountRepository,
    PromoCodeRepository,
    BillingService,
    {
      provide: IPaymentGatewayToken,
      useClass: MockPaymentGateway,
    },
    {
      provide: ITaskQueueToken,
      useClass: MockTaskQueue,
    },
    DatabaseIndexService,
    DiscountPriorityService,
    ProductsService,
    ...Array.from(Object.keys(jobs)).map((key) => jobs[key]),
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap, BeforeApplicationShutdown {
  constructor(private readonly cmmService: CommonService, private readonly databaseIndexService: DatabaseIndexService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppTracerMiddleware).forRoutes('*');
  }

  async onApplicationBootstrap() {
    // Create database indexes on application startup
    await this.databaseIndexService.createIndexes();
  }

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  async beforeApplicationShutdown(signal?: string) {
    this.cmmService.releaseResources();
  }
}
