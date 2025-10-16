import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IProductDocument, ISubscriptionDocument, IUserDocument } from './__helpers__/shcema-interface.helper';

describe(`GET ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions/:id`, () => {
  let agent: superTest.SuperAgentTest;
  const baseEndpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`;
  const dbHelper = new MongoHelper('get_subscriptions_id');
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

  const mockSubscription: Partial<ISubscriptionDocument> = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'sub-001',
    userId: mockUser.userId,
    productId: mockProduct.productId,
    status: 'active',
    cycleType: 'monthly',
    startDate: new Date('2024-01-01'),
    nextBillingDate: new Date('2024-02-01'),
    renewalCount: 2,
    remainingDiscountPeriods: 0,
    pendingConversion: null,
    valid: true,
  };
  //#endregion Test data

  beforeAll(async () => {
    const mockContainer = getNewMockContainer();
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();
    await Promise.all([
      db.getCollection(userCol).insertOne(mockUser),
      db.getCollection(productCol).insertOne(mockProduct),
      db.getCollection(subscriptionCol).insertOne(mockSubscription),
    ]);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('[20006] should return error for non-existent subscription', async () => {
      const nonExistentId = 'non-existent-subscription-id';
      const endpoint = `${baseEndpoint}/${nonExistentId}`;

      const res = await agent.get(endpoint);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20006);
    });
  });

  describe('Success', () => {
    it('[0] should return subscription details successfully', async () => {
      const endpoint = `${baseEndpoint}/${mockSubscription.subscriptionId}`;

      const res = await agent.get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeTruthy();

      // Verify response structure
      const result = res.body.result;
      expect(result.subscriptionId).toBe(mockSubscription.subscriptionId);
      expect(result.userId).toBe(mockUser.userId.toHexString());
      expect(result.productId).toBe(mockProduct.productId);
      expect(result.status).toBe(mockSubscription.status);
      expect(result.cycleType).toBe(mockSubscription.cycleType);
      expect(result.startDate).toBe(mockSubscription.startDate.toISOString());
      expect(result.nextBillingDate).toBe(mockSubscription.nextBillingDate.toISOString());
      expect(result.renewalCount).toBe(mockSubscription.renewalCount);
      expect(result.remainingDiscountPeriods).toBe(mockSubscription.remainingDiscountPeriods);
      expect(result.pendingConversion).toBeNull();
    });

    it('[0] should return subscription with pending conversion', async () => {
      // Create subscription with pending conversion
      const subWithConversion: Partial<ISubscriptionDocument> = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-002',
        userId: mockUser.userId,
        productId: mockProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2024-02-01'),
        renewalCount: 1,
        remainingDiscountPeriods: 0,
        pendingConversion: {
          newCycleType: 'yearly',
          requestedAt: new Date('2024-01-15'),
        },
        valid: true,
      };
      await db.getCollection(subscriptionCol).insertOne(subWithConversion);

      const endpoint = `${baseEndpoint}/${subWithConversion.subscriptionId}`;

      const res = await agent.get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeTruthy();

      const result = res.body.result;
      expect(result.subscriptionId).toBe(subWithConversion.subscriptionId);
      expect(result.pendingConversion).toBeTruthy();
      expect(result.pendingConversion.newCycleType).toBe('yearly');
      expect(result.pendingConversion.requestedAt).toBe(subWithConversion.pendingConversion.requestedAt.toISOString());
    });
  });
});
