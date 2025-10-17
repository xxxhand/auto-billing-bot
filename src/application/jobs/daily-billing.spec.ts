import { Test, TestingModule } from '@nestjs/testing';
import { DailyBillingJob } from './daily-billing';
import { CommonService } from '@myapp/common';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ITaskQueue, ITaskQueueToken } from '../../domain/services/task-queue.interface';
import { Subscription } from '../../domain/entities/subscription.entity';

describe('DailyBillingJob', () => {
  let job: DailyBillingJob;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let taskQueue: jest.Mocked<ITaskQueue>;
  let commonService: jest.Mocked<CommonService>;
  let logger: any;

  beforeEach(async () => {
    logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    commonService = {
      getDefaultLogger: jest.fn().mockReturnValue(logger),
    } as any;

    subscriptionRepository = {
      findActiveSubscriptionsDueForBilling: jest.fn(),
    } as any;

    taskQueue = {
      publishTask: jest.fn(),
      getQueueName: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBillingJob,
        {
          provide: CommonService,
          useValue: commonService,
        },
        {
          provide: SubscriptionRepository,
          useValue: subscriptionRepository,
        },
        {
          provide: ITaskQueueToken,
          useValue: taskQueue,
        },
      ],
    }).compile();

    job = module.get<DailyBillingJob>(DailyBillingJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('execute', () => {
    it('should find due subscriptions and publish tasks', async () => {
      const mockSubscriptions = [
        {
          subscriptionId: 'sub1',
          userId: 'user1',
          productId: 'prod1',
          status: 'active',
          cycleType: 'monthly',
          nextBillingDate: new Date('2023-01-01'),
        } as Subscription,
        {
          subscriptionId: 'sub2',
          userId: 'user2',
          productId: 'prod2',
          status: 'active',
          cycleType: 'yearly',
          nextBillingDate: new Date('2023-01-01'),
        } as Subscription,
      ];

      subscriptionRepository.findActiveSubscriptionsDueForBilling.mockResolvedValue(mockSubscriptions);

      await job.execute();

      expect(subscriptionRepository.findActiveSubscriptionsDueForBilling).toHaveBeenCalledWith(expect.any(Date));
      expect(taskQueue.publishTask).toHaveBeenCalledTimes(2);
      expect(taskQueue.publishTask).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub1',
          taskType: 'billing',
          retryCount: 0,
        }),
      );
      expect(taskQueue.publishTask).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub2',
          taskType: 'billing',
          retryCount: 0,
        }),
      );
      expect(logger.log).toHaveBeenCalledWith('Executing hourly billing cron job...');
      expect(logger.log).toHaveBeenCalledWith('Found 2 subscriptions due for billing');
      expect(logger.log).toHaveBeenCalledWith('Published billing task for subscription sub1');
      expect(logger.log).toHaveBeenCalledWith('Published billing task for subscription sub2');
      expect(logger.log).toHaveBeenCalledWith('Billing cron job completed successfully');
    });

    it('should handle empty subscriptions list', async () => {
      subscriptionRepository.findActiveSubscriptionsDueForBilling.mockResolvedValue([]);

      await job.execute();

      expect(subscriptionRepository.findActiveSubscriptionsDueForBilling).toHaveBeenCalledWith(expect.any(Date));
      expect(taskQueue.publishTask).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Found 0 subscriptions due for billing');
    });

    it('should handle errors gracefully', async () => {
      subscriptionRepository.findActiveSubscriptionsDueForBilling.mockRejectedValue(new Error('Database error'));

      await job.execute();

      expect(logger.error).toHaveBeenCalledWith('Error executing billing cron job', expect.any(Error));
    });
  });
});