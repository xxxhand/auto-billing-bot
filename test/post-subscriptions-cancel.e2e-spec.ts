import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IProductDocument, ISubscriptionDocument, IUserDocument, IRefundDocument } from './__helpers__/shcema-interface.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions/:id/cancel`, () => {
  let agent: superTest.SuperAgentTest;
  const baseEndpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`;
  const dbHelper = new MongoHelper('post_subscriptions_cancel');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';
  const refundCol = 'Refunds';

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

  const mockActiveSubscription: ISubscriptionDocument = {
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

  const mockCancelledSubscription: ISubscriptionDocument = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'sub-002',
    userId: mockUser.userId,
    productId: mockProduct.productId,
    status: 'cancelled',
    cycleType: 'monthly',
    startDate: new Date('2024-01-01'),
    nextBillingDate: new Date('2024-02-01'),
    renewalCount: 0,
    remainingDiscountPeriods: 0,
    pendingConversion: null,
    valid: true,
  };
  //#endregion Test data

  // mock payment gateway and billing service
  const mockPaymentGateway = {
    refund: jest.fn(),
  };

  const mockBillingService = {
    processRefund: jest.fn(),
  };

  beforeAll(async () => {
    const mockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway);
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();
    // Don't insert shared data here - create per test instead
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('[20006] should return error for non-existent subscription', async () => {
      const endpoint = `${baseEndpoint}/non-existent-subscription/cancel`;

      const res = await agent.post(endpoint).send({});

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20006);
    });

    it('[20011] should return error when subscription is already cancelled', async () => {
      // Create a cancelled subscription for this test
      const cancelledSub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-cancelled-test',
        userId: dbHelper.newObjectId(),
        productId: 'prod-test',
        status: 'cancelled',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2024-02-01'),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };
      await db.getCollection(subscriptionCol).insertOne(cancelledSub);

      const endpoint = `${baseEndpoint}/${cancelledSub.subscriptionId}/cancel`;

      const res = await agent.post(endpoint).send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20011);
    });
  });

  describe('Payment Errors', () => {
    it('[20010] should return error when refund fails', async () => {
      // Create a new agent with mocked billing service for this test
      const testMockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway).set('IBillingService', mockBillingService);
      const testAgent = await AppHelper.getAgentWithMockers(testMockContainer);

      // Create test data for this test
      const testUser: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-test',
        encryptedData: 'encrypted-data',
        valid: true,
      };

      const testProduct: IProductDocument = {
        _id: dbHelper.newObjectId(),
        productId: 'prod-test-refund-fail',
        name: 'Test Plan',
        price: 100, // Normal price
        cycleType: 'monthly',
        valid: true,
      };

      const testSub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-fail-refund',
        userId: testUser.userId,
        productId: testProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2026-02-01'), // Future date to ensure refund
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };

      await Promise.all([db.getCollection(userCol).insertOne(testUser), db.getCollection(productCol).insertOne(testProduct), db.getCollection(subscriptionCol).insertOne(testSub)]);

      // Mock refund to fail by mocking BillingService.processRefund
      mockBillingService.processRefund.mockResolvedValue({
        success: false,
        errorMessage: 'Refund gateway error',
        errorCode: 'REFUND_FAILED',
      });

      const endpoint = `${baseEndpoint}/${testSub.subscriptionId}/cancel`;

      const res = await testAgent.post(endpoint).send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20010);

      // Check database - subscription should still be active
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: testSub.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub.status).toBe('active');

      // Check refund should be failed
      const dbRefunds = (await db.getCollection(refundCol).find({ subscriptionId: testSub.subscriptionId }).toArray()) as IRefundDocument[];
      expect(dbRefunds).toHaveLength(1);
      expect(dbRefunds[0].status).toBe('failed');
    });
  });

  describe('Success', () => {
    it('[0] should cancel subscription successfully with prorated refund', async () => {
      // Create test data for this test
      const testUser: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-test-success',
        encryptedData: 'encrypted-data',
        valid: true,
      };

      const testProduct: IProductDocument = {
        _id: dbHelper.newObjectId(),
        productId: 'prod-test-success',
        name: 'Test Plan',
        price: 100,
        cycleType: 'monthly',
        valid: true,
      };

      const testSub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-success-test',
        userId: testUser.userId,
        productId: testProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'), // Started on Jan 1st
        nextBillingDate: new Date('2026-01-01'), // Next billing in far future
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };

      await Promise.all([db.getCollection(userCol).insertOne(testUser), db.getCollection(productCol).insertOne(testProduct), db.getCollection(subscriptionCol).insertOne(testSub)]);

      jest.spyOn(mockPaymentGateway, 'refund').mockResolvedValue({
        success: true,
        transactionId: 'refund-txn-12345',
      });

      const endpoint = `${baseEndpoint}/${testSub.subscriptionId}/cancel`;

      const res = await agent.post(endpoint).send({});

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.subscriptionId).toBe(testSub.subscriptionId);
      expect(res.body.result.cancelledAt).toBeDefined();
      expect(new Date(res.body.result.cancelledAt)).toBeInstanceOf(Date);
      expect(res.body.result.refundAmount).toBeGreaterThan(0);

      // Check database - subscription should be cancelled
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: testSub.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub.status).toBe('cancelled');

      // Check refund should be completed
      const dbRefunds = (await db.getCollection(refundCol).find({ subscriptionId: testSub.subscriptionId }).toArray()) as IRefundDocument[];
      expect(dbRefunds).toHaveLength(1);
      expect(dbRefunds[0].status).toBe('completed');
      expect(dbRefunds[0].amount).toBeGreaterThan(0);
    });

    it('[0] should cancel subscription successfully with no refund (just started)', async () => {
      // Create test data for this test
      const testUser: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-test-no-refund',
        encryptedData: 'encrypted-data',
        valid: true,
      };

      const testProduct: IProductDocument = {
        _id: dbHelper.newObjectId(),
        productId: 'prod-test-no-refund',
        name: 'Test Plan',
        price: 100,
        cycleType: 'monthly',
        valid: true,
      };

      const testSub: ISubscriptionDocument = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-no-refund-test',
        userId: testUser.userId,
        productId: testProduct.productId,
        status: 'active',
        cycleType: 'monthly',
        startDate: new Date('2024-01-01'),
        nextBillingDate: new Date('2024-02-01'),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
        pendingConversion: null,
        valid: true,
      };

      await Promise.all([db.getCollection(userCol).insertOne(testUser), db.getCollection(productCol).insertOne(testProduct), db.getCollection(subscriptionCol).insertOne(testSub)]);

      jest.spyOn(mockPaymentGateway, 'refund').mockResolvedValue({
        success: true,
        transactionId: 'refund-txn-12346',
      });

      const endpoint = `${baseEndpoint}/${testSub.subscriptionId}/cancel`;

      const res = await agent.post(endpoint).send({});

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result.refundAmount).toBe(0); // No refund since just started

      // Check database
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: testSub.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub.status).toBe('cancelled');

      // Check refund - should still be created but with 0 amount
      const dbRefunds = (await db.getCollection(refundCol).find({ subscriptionId: testSub.subscriptionId }).toArray()) as IRefundDocument[];
      expect(dbRefunds).toHaveLength(1);
      expect(dbRefunds[0].status).toBe('completed');
      expect(dbRefunds[0].amount).toBe(0);
    });
  });
});
