import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import {
  IProductDocument,
  ISubscriptionDocument,
  IUserDocument,
} from './__helpers__/shcema-interface.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions/convert`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions/convert`;
  const dbHelper = new MongoHelper('post_subscriptions_convert');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';

  //#region Test data
  const mockUser: IUserDocument = {
    _id: dbHelper.newObjectId(),
    userId: dbHelper.newObjectId(),
    tenantId: 'tenant-001',
    encryptedData: 'encrypted-data',
    valid: true,
  };

  const mockProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'prod-001',
    name: 'Monthly Plan',
    price: 100,
    cycleType: 'monthly',
    valid: true,
  };

  const mockSubscription: ISubscriptionDocument = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'sub-001',
    userId: mockUser.userId,
    productId: mockProduct.productId,
    status: 'active',
    cycleType: 'monthly',
    startDate: new Date('2024-01-01'),
    nextBillingDate: new Date('2024-02-01'),
    renewalCount: 0,
    remainingDiscountPeriods: 0,
    pendingConversion: null,
    valid: true,
  };
  //#endregion Test data

  // mock payment gateway
  const mockPaymentGateway = {
    charge: jest.fn(),
  };

  beforeAll(async () => {
    const mockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway);
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();
    await Promise.all([
      db.getCollection(userCol).insertOne(mockUser),
      db.getCollection(productCol).insertOne(mockProduct),
      db.getCollection(subscriptionCol).insertOne(mockSubscription),
    ]);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('[20006] should return error for non-existent subscription', async () => {
      const requestBody = {
        subscriptionId: 'non-existent-subscription',
        newCycleType: 'yearly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20006);
    });

    it('[20007] should return error for invalid cycle type', async () => {
      const requestBody = {
        subscriptionId: mockSubscription.subscriptionId,
        newCycleType: 'invalid-cycle',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20007);
    });

    it('[20008] should return error when subscription already has pending conversion', async () => {
      // Create subscription with pending conversion
      const subWithPending: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-002',
        userId: mockUser.userId,
        productId: mockProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2024-02-01'),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: {
          newCycleType: 'quarterly',
          requestedAt: new Date(),
        },
        valid: true,
      };
      await db.getCollection(subscriptionCol).insertOne(subWithPending);

      const requestBody = {
        subscriptionId: subWithPending.subscriptionId,
        newCycleType: 'yearly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20008);
    });

    it('[20009] should return error when trying to convert to same cycle type', async () => {
      const requestBody = {
        subscriptionId: mockSubscription.subscriptionId,
        newCycleType: 'monthly', // Same as current
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20009);
    });
  });

  describe('Payment Errors', () => {
    it('[20010] should return error when payment fails for upgrade', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: false,
        errorMessage: 'Payment gateway error',
      });

      const requestBody = {
        subscriptionId: mockSubscription.subscriptionId,
        newCycleType: 'yearly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20010);
    });
  });

  describe('Success', () => {
    it('[0] should convert subscription successfully (monthly to yearly)', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        transactionId: 'txn-12345',
      });
      const requestBody = {
        subscriptionId: mockSubscription.subscriptionId,
        newCycleType: 'yearly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.subscriptionId).toBe(mockSubscription.subscriptionId);
      expect(res.body.result.newCycleType).toBe('yearly');
      expect(new Date(res.body.result.requestedAt)).toBeInstanceOf(Date);
      expect(res.body.result.feeAdjustment).toBe(1100); // (12 - 1) * 100 = 1100

      // Check database - subscription should have pending conversion
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: mockSubscription.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub).toBeTruthy();
      expect(dbSub.pendingConversion).toBeTruthy();
      expect(dbSub.pendingConversion.newCycleType).toBe('yearly');
      expect(dbSub.pendingConversion.requestedAt).toBeInstanceOf(Date);
    });

    it('[0] should convert subscription successfully (monthly to quarterly)', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        transactionId: 'txn-123456',
      });
      // Create new subscription for this test
      const newSub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-003',
        userId: mockUser.userId,
        productId: mockProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2024-02-01'),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };
      await db.getCollection(subscriptionCol).insertOne(newSub);

      const requestBody = {
        subscriptionId: newSub.subscriptionId,
        newCycleType: 'quarterly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result.feeAdjustment).toBe(200); // (3 - 1) * 100 = 200

      // Check database
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: newSub.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub.pendingConversion.newCycleType).toBe('quarterly');
    });

    it('[0] should convert subscription successfully (yearly to monthly)', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        transactionId: 'txn-123457',
      });
      // Create yearly subscription
      const yearlySub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-004',
        userId: mockUser.userId,
        productId: mockProduct.productId,
        status: 'active',
        cycleType: 'yearly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2025-01-01'),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };
      await db.getCollection(subscriptionCol).insertOne(yearlySub);

      const requestBody = {
        subscriptionId: yearlySub.subscriptionId,
        newCycleType: 'monthly',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result.feeAdjustment).toBe(-1100); // (1 - 12) * 100 = -1100 (refund)

      // Check database
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: yearlySub.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub.pendingConversion.newCycleType).toBe('monthly');
    });
  });
});