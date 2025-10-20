import { cmmConf } from '@myapp/conf';
import { Cron } from '@nestjs/schedule';
import { CommonService } from '@myapp/common';
import { Injectable, LoggerService } from '@nestjs/common';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';

@Injectable()
export class GracePeriodCheckerJob {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {
    this._Logger = this.commonService.getDefaultLogger(GracePeriodCheckerJob.name);
  }

  @Cron('0 * * * *') // Run every hour at minute 0
  async execute(): Promise<void> {
    this._Logger.log('Executing grace period checker cron job...');

    try {
      const now = new Date();
      const gracePeriodSubscriptions = await this.subscriptionRepository.findSubscriptionsInGracePeriod();

      this._Logger.log(`Found ${gracePeriodSubscriptions.length} subscriptions in grace period`);

      let expiredCount = 0;
      for (const subscription of gracePeriodSubscriptions) {
        if (subscription.isGracePeriodExpired(now)) {
          // Expire the grace period and cancel the subscription
          const result = subscription.expireGracePeriod();

          // Save the updated subscription
          await this.subscriptionRepository.save(subscription);

          this._Logger.log(`Expired grace period for subscription ${subscription.subscriptionId}, cancelled at ${result.cancelledAt}`);
          expiredCount++;
        }
      }

      this._Logger.log(`Grace period checker completed: ${expiredCount} subscriptions cancelled due to expired grace period`);
    } catch (error) {
      this._Logger.error('Error executing grace period checker cron job', error);
    }
  }
}