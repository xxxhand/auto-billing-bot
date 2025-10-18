import { Inject, Injectable, OnModuleInit, LoggerService } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { IBillingService, IBillingServiceToken } from '../domain/services/billing.service.interface';
import { ITaskQueue, BillingTask, ITaskQueueToken } from '../domain/services/task-queue.interface';

/**
 * Billing consumer service
 * Consumes billing tasks from the queue and processes them using the billing service
 */
@Injectable()
export class BillingConsumer implements OnModuleInit {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly commonService: CommonService,
    @Inject(IBillingServiceToken) private readonly billingService: IBillingService,
    @Inject(ITaskQueueToken) private readonly taskQueue: ITaskQueue,
  ) {
    this._Logger = this.commonService.getDefaultLogger(BillingConsumer.name);
  }

  /**
   * Initialize the consumer when module starts
   */
  async onModuleInit(): Promise<void> {
    this._Logger.log('Starting billing task consumer');

    try {
      await this.taskQueue.consumeTasks(this.handleTask.bind(this));
      this._Logger.log('Billing task consumer started successfully');
    } catch (error) {
      this._Logger.error(`Failed to start billing task consumer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle incoming billing task
   * @param task The billing task to process
   */
  private async handleTask(task: BillingTask): Promise<void> {
    this._Logger.log(`Processing billing task: ${task.taskId} for subscription: ${task.subscriptionId}`);

    try {
      const result = await this.billingService.processBillingTask(
        task.taskId,
        task.subscriptionId,
        task.taskType,
        task.retryCount
      );

      if (result.success) {
        this._Logger.log(`Billing task ${task.taskId} completed successfully`);
      } else {
        this._Logger.warn(`Billing task ${task.taskId} failed: ${result.errorMessage}`);
      }
    } catch (error) {
      this._Logger.error(`Error processing billing task ${task.taskId}: ${error.message}`);
      throw error; // Let the queue handle retry/rejection
    }
  }
}