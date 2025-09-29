import { SubscriptionRepository } from './subscription.repository';
import { Subscription } from '../../domain';
import { CommonService } from '@myapp/common';

describe('SubscriptionRepository', () => {
  let repository: SubscriptionRepository;
  let mockMongoClient: any;
  let mockCommonService: jest.Mocked<CommonService>;

  beforeEach(() => {
    // Mock the mongo client
    mockMongoClient = {
      getCollection: jest.fn().mockReturnValue({
        insertOne: jest.fn().mockResolvedValue({ insertedId: { toHexString: () => 'mock-id' } }),
        updateOne: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    // Mock the common service
    mockCommonService = {
      getDefaultLogger: jest.fn().mockReturnValue({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      }),
    } as any;

    repository = new SubscriptionRepository(mockMongoClient, mockCommonService);
  });

  describe('save', () => {
    it('should save a new subscription', async () => {
      const subscription = new Subscription();
      subscription.id = '';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-01-15T00:00:00.000Z';
      subscription.status = 'pending';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 0;

      // Mock implementation would save to database
      const result = await repository.save(subscription);

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
    });

    it('should update existing subscription', async () => {
      const subscription = new Subscription();
      subscription.id = '507f1f77bcf86cd799439011';
      subscription.userId = 'user-1';
      subscription.productId = 'product-1';
      subscription.startDate = '2025-01-15T00:00:00.000Z';
      subscription.nextBillingDate = '2025-02-15T00:00:00.000Z';
      subscription.status = 'active';
      subscription.createdAt = '2025-01-15T00:00:00.000Z';
      subscription.renewalCount = 1;

      const result = await repository.save(subscription);

      expect(result).toBe(subscription);
    });
  });

  describe('findById', () => {
    it('should return subscription when found', async () => {
      const subscriptionId = '507f1f77bcf86cd799439011';
      const mockDoc = {
        _id: { toHexString: () => '507f1f77bcf86cd799439011' },
        userId: 'user-1',
        productId: 'product-1',
        startDate: '2025-01-15T00:00:00.000Z',
        nextBillingDate: '2025-02-15T00:00:00.000Z',
        status: 'active',
        createdAt: '2025-01-15T00:00:00.000Z',
        renewalCount: 1,
      };

      mockMongoClient.getCollection().findOne.mockResolvedValueOnce(mockDoc);

      const result = await repository.findById(subscriptionId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('507f1f77bcf86cd799439011');
      expect(result?.userId).toBe('user-1');
    });

    it('should return undefined when not found', async () => {
      const subscriptionId = '507f1f77bcf86cd799439012';

      const result = await repository.findById(subscriptionId);

      expect(result).toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    it('should return user subscriptions', async () => {
      const userId = 'user-1';

      const result = await repository.findByUserId(userId);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findDueSubscriptions', () => {
    it('should return subscriptions due for billing', async () => {
      const date = '2025-01-15T00:00:00.000Z';

      const result = await repository.findDueSubscriptions(date);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
