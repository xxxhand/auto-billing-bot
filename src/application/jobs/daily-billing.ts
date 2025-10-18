import { cmmConf } from '@myapp/conf';
import { Cron } from '@nestjs/schedule';
import { CommonService } from '@myapp/common';
import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ITaskQueue, ITaskQueueToken, BillingTask } from '../../domain/services/task-queue.interface';

@Injectable()
export class DailyBillingJob {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(ITaskQueueToken) private readonly taskQueue: ITaskQueue,
  ) {
    this._Logger = this.commonService.getDefaultLogger(DailyBillingJob.name);
  }

  @Cron(cmmConf.dailyBillingCron)
  async execute(): Promise<void> {
    this._Logger.log('Executing hourly billing cron job...');

    try {
      const now = new Date();
      const dueSubscriptions = await this.subscriptionRepository.findActiveSubscriptionsDueForBilling(now);

      this._Logger.log(`Found ${dueSubscriptions.length} subscriptions due for billing`);

      for (const subscription of dueSubscriptions) {
        const task: BillingTask = {
          taskId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          subscriptionId: subscription.subscriptionId,
          taskType: 'billing',
          retryCount: 0,
          createdAt: new Date(),
        };

        await this.taskQueue.publishTask(task);
        this._Logger.log(`Published billing task for subscription ${subscription.subscriptionId}`);
      }

      this._Logger.log('Billing cron job completed successfully');
    } catch (error) {
      this._Logger.error('Error executing billing cron job', error);
    }
  }
}
