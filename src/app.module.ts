import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
import * as jobs from './application/jobs';
import * as v1Controllers from './application/controllers/v1';
import { SubscriptionApplicationService, PaymentApplicationService } from './application';
import { SubscriptionService, ProductService, PaymentService, AutoBillingService } from './infra/services';
import { SubscriptionRepository, ProductRepository, PaymentHistoryRepository, OperationLogRepository, CouponRepository } from './infra/repositories';
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
    // Infrastructure Repositories
    SubscriptionRepository,
    ProductRepository,
    PaymentHistoryRepository,
    OperationLogRepository,
    CouponRepository,
    // Domain Services
    SubscriptionService,
    ProductService,
    PaymentService,
    AutoBillingService,
    // Application Services
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
