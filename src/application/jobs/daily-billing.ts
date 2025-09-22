import { cmmConf } from '@myapp/conf';
import { Cron } from '@nestjs/schedule';
import { CommonService } from '@myapp/common';
import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class DailyBillingJob {
  private readonly _Logger: LoggerService;

  constructor(private readonly commonService: CommonService) {
    this._Logger = this.commonService.getDefaultLogger(DailyBillingJob.name);
  }

  @Cron(cmmConf.dailyBillingCron)
  async execute(): Promise<void> {
    this._Logger.log('Executing daily billing job...');
    // Add your billing logic here
  }
}
