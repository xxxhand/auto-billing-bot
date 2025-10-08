import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_MONGO } from '@myapp/common';
import { cmmConf } from '@myapp/conf';
import { CustomMongoClient } from '@xxxhand/app-common';
import { DatabaseIndexService } from '../../../src/infra/services/database-index.service';

// Mock CustomMongoClient
const mockCustomMongoClient = {
  client: {
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        createIndex: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
};

describe('DatabaseIndexService', () => {
  let service: DatabaseIndexService;
  let mongoClient: CustomMongoClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseIndexService,
        {
          provide: DEFAULT_MONGO,
          useValue: mockCustomMongoClient,
        },
      ],
    }).compile();

    service = module.get<DatabaseIndexService>(DatabaseIndexService);
    mongoClient = module.get<CustomMongoClient>(DEFAULT_MONGO);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIndexes', () => {
    it('should create all necessary indexes successfully', async () => {
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn().mockResolvedValue(undefined),
        }),
      };

      mockCustomMongoClient.client.db.mockReturnValue(mockDb);

      await expect(service.createIndexes()).resolves.not.toThrow();

      // Verify that db.collection was called for all expected collections
      expect(mockDb.collection).toHaveBeenCalledWith('subscriptions');
      expect(mockDb.collection).toHaveBeenCalledWith('paymentAttempts');
      expect(mockDb.collection).toHaveBeenCalledWith('promoCodeUsages');
      expect(mockDb.collection).toHaveBeenCalledWith('billingLogs');
      expect(mockDb.collection).toHaveBeenCalledWith('products');
      expect(mockDb.collection).toHaveBeenCalledWith('users');
      expect(mockDb.collection).toHaveBeenCalledWith('discounts');
      expect(mockDb.collection).toHaveBeenCalledWith('promoCodes');
      expect(mockDb.collection).toHaveBeenCalledWith('refunds');
      expect(mockDb.collection).toHaveBeenCalledWith('config');
      expect(mockDb.collection).toHaveBeenCalledWith('rules');
    });

    it('should handle errors during index creation', async () => {
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn().mockRejectedValue(new Error('Index creation failed')),
        }),
      };

      mockCustomMongoClient.client.db.mockReturnValue(mockDb);

      await expect(service.createIndexes()).rejects.toThrow('Index creation failed');
    });

    it('should create subscriptions indexes with correct options', async () => {
      const mockCollection = {
        createIndex: jest.fn().mockResolvedValue(undefined),
      };
      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection),
      };

      mockCustomMongoClient.client.db.mockReturnValue(mockDb);

      await service.createIndexes();

      // Verify nextBillingDate index
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { nextBillingDate: 1 },
        {
          name: 'nextBillingDate_1',
          background: true,
        }
      );

      // Verify status index
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { status: 1 },
        {
          name: 'status_1',
          background: true,
        }
      );

      // Verify compound index
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { status: 1, nextBillingDate: 1 },
        {
          name: 'status_1_nextBillingDate_1',
          background: true,
        }
      );
    });
  });
});