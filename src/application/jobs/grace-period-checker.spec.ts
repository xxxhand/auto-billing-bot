import { Test, TestingModule } from '@nestjs/testing';
import { GracePeriodCheckerJob } from './grace-period-checker';
import { CommonService } from '@myapp/common';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { Subscription } from '../../domain/entities/subscription.entity';

describe('GracePeriodCheckerJob', () => {
  let job: GracePeriodCheckerJob;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
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
      findSubscriptionsInGracePeriod: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracePeriodCheckerJob,
        {
          provide: CommonService,
          useValue: commonService,
        },
        {
          provide: SubscriptionRepository,
          useValue: subscriptionRepository,
        },
      ],
    }).compile();

    job = module.get<GracePeriodCheckerJob>(GracePeriodCheckerJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('execute', () => {
    it('should find grace period subscriptions and expire those that are expired', async () => {
      // Arrange
      const expiredSubscription = {
        subscriptionId: 'sub1',
        userId: 'user1',
        productId: 'prod1',
        status: 'grace',
        cycleType: 'monthly',
        gracePeriodEndDate: new Date('2024-01-10'), // Past date - expired
        isGracePeriodExpired: jest.fn().mockReturnValue(true),
        expireGracePeriod: jest.fn().mockReturnValue({
          cancelledAt: new Date('2024-01-15'),
          reason: 'Grace period expired without successful payment',
        }),
      } as any as Subscription;

      const activeGraceSubscription = {
        subscriptionId: 'sub2',
        userId: 'user2',
        productId: 'prod2',
        status: 'grace',
        cycleType: 'yearly',
        gracePeriodEndDate: new Date('2024-01-25'), // Future date - not expired
        isGracePeriodExpired: jest.fn().mockReturnValue(false),
        expireGracePeriod: jest.fn(),
      } as any as Subscription;

      subscriptionRepository.findSubscriptionsInGracePeriod.mockResolvedValue([
        expiredSubscription,
        activeGraceSubscription,
      ]);

      // Act
      await job.execute();

      // Assert
      expect(subscriptionRepository.findSubscriptionsInGracePeriod).toHaveBeenCalled();
      expect(expiredSubscription.isGracePeriodExpired).toHaveBeenCalledWith(expect.any(Date));
      expect(activeGraceSubscription.isGracePeriodExpired).toHaveBeenCalledWith(expect.any(Date));
      expect(expiredSubscription.expireGracePeriod).toHaveBeenCalled();
      expect(activeGraceSubscription.expireGracePeriod).not.toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalledWith(expiredSubscription);
      expect(subscriptionRepository.save).not.toHaveBeenCalledWith(activeGraceSubscription);
      expect(logger.log).toHaveBeenCalledWith('Executing grace period checker cron job...');
      expect(logger.log).toHaveBeenCalledWith('Found 2 subscriptions in grace period');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Expired grace period for subscription sub1, cancelled at'),
      );
      expect(logger.log).toHaveBeenCalledWith('Grace period checker completed: 1 subscriptions cancelled due to expired grace period');
    });

    it('should handle empty grace period subscriptions list', async () => {
      // Arrange
      subscriptionRepository.findSubscriptionsInGracePeriod.mockResolvedValue([]);

      // Act
      await job.execute();

      // Assert
      expect(subscriptionRepository.findSubscriptionsInGracePeriod).toHaveBeenCalled();
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Found 0 subscriptions in grace period');
      expect(logger.log).toHaveBeenCalledWith('Grace period checker completed: 0 subscriptions cancelled due to expired grace period');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      subscriptionRepository.findSubscriptionsInGracePeriod.mockRejectedValue(new Error('Database error'));

      // Act
      await job.execute();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error executing grace period checker cron job', expect.any(Error));
    });

    it('should not expire subscriptions that are not expired', async () => {
      // Arrange
      const activeGraceSubscription = {
        subscriptionId: 'sub1',
        userId: 'user1',
        productId: 'prod1',
        status: 'grace',
        cycleType: 'monthly',
        gracePeriodEndDate: new Date('2024-01-25'), // Future date
        isGracePeriodExpired: jest.fn().mockReturnValue(false),
        expireGracePeriod: jest.fn(),
      } as any as Subscription;

      subscriptionRepository.findSubscriptionsInGracePeriod.mockResolvedValue([activeGraceSubscription]);

      // Act
      await job.execute();

      // Assert
      expect(activeGraceSubscription.isGracePeriodExpired).toHaveBeenCalledWith(expect.any(Date));
      expect(activeGraceSubscription.expireGracePeriod).not.toHaveBeenCalled();
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Grace period checker completed: 0 subscriptions cancelled due to expired grace period');
    });
  });
});