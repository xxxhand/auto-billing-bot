import { cmmConf } from '@myapp/conf';
import { Cron } from '@nestjs/schedule';
import { CommonService } from '@myapp/common';
import { Injectable, LoggerService } from '@nestjs/common';
import { AutoBillingService } from '../../infra/services/auto-billing.service';

@Injectable()
export class DailyBillingJob {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    private readonly autoBillingService: AutoBillingService,
  ) {
    this._Logger = this.commonService.getDefaultLogger(DailyBillingJob.name);
  }

  @Cron(cmmConf.dailyBillingCron)
  async execute(): Promise<void> {
    this._Logger.log('Starting daily billing job execution...');

    try {
      // 執行自動扣款處理
      const result = await this.autoBillingService.processAutoBilling();

      // 記錄處理結果
      this._Logger.log(`Daily billing job completed. Processed: ${result.totalProcessed}, Successful: ${result.successfulPayments}, Failed: ${result.failedPayments}`);

      // 如果有錯誤，記錄錯誤信息
      if (result.errors.length > 0) {
        this._Logger.warn(`Daily billing job encountered ${result.errors.length} errors:`);
        result.errors.forEach((error, index) => {
          this._Logger.warn(`Error ${index + 1}: ${error}`);
        });
      }

      // 如果有失敗的付款，可以在這裡處理重試邏輯
      if (result.failedPayments > 0) {
        this._Logger.log(`Processing failed payments for retry...`);
        // 在實際實現中，這裡可能會調用額外的重試邏輯
      }
    } catch (error) {
      this._Logger.error(`Daily billing job failed with error: ${error.message}`, error.stack);
      // 在實際實現中，這裡可能會發送告警通知
    }

    this._Logger.log('Daily billing job execution finished.');
  }
}
