import * as _ from 'lodash';
import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IPaymentAttemptDocument } from './__helpers__/shcema-interface.helper';

interface IBody {
  subscriptionId: string;
}

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/payments/retry spec`, () => {
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/payments/retry`;
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('subscription');
  const db = dbHelper.mongo;
  const subscriptionsCol = 'Subscriptions';
  const paymentAttemptsCol = 'PaymentAttempts';
  const defaultBody: IBody = {
    subscriptionId: '507f1f77bcf86cd799439011', // example ObjectId
  };

  // mock payment gateway and billing service
  const mockPaymentGateway = {
    charge: jest.fn(),
  };

  beforeAll(async () => {
    const mockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway);
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Required fields', () => {
    test('[20014] Parameter "subscriptionId" is empty', async () => {
      const b = _.cloneDeep(defaultBody);
      b.subscriptionId = '';
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20014);
      expect(res.body.message).toBe('Subscription ID is empty');
    });
  });

  describe('Validation rules', () => {
    test('[20006] Subscription not found', async () => {
      const res = await agent.post(endpoint).send(defaultBody);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20006);
      expect(res.body.message).toBe('Subscription not found');
    });

    test('[20013] Subscription not in grace status', async () => {
      await db.getCollection(subscriptionsCol).insertOne({
        subscriptionId: '507f1f77bcf86cd799439012',
        status: 'active',
        userId: dbHelper.newObjectId(),
        productId: 'prod123',
        cycleType: 'monthly',
        startDate: new Date(),
        nextBillingDate: new Date(),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
      });

      const found = await db.getCollection(subscriptionsCol).findOne({ subscriptionId: '507f1f77bcf86cd799439012' });
      console.log('found in test:', found);

      const b = _.cloneDeep(defaultBody);
      b.subscriptionId = '507f1f77bcf86cd799439012';
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20013);
      expect(res.body.message).toBe('Subscription is not in grace period');
    });
  });

  describe('Success', () => {
    test('Payment retry successful', async () => {
      // mock payment gateway to always succeed
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        trueTransactionId: 'txn-retry-success-001',
      });
      // Insert product first
      await db.getCollection('Products').insertOne({
        productId: 'prod123',
        name: 'Test Product',
        price: 100,
        currency: 'TWD',
        cycleType: 'monthly',
        status: 'active',
      });

      // Insert subscription in grace status
      await db.getCollection(subscriptionsCol).insertOne({
        subscriptionId: '507f1f77bcf86cd799439013',
        status: 'grace',
        userId: dbHelper.newObjectId(),
        productId: 'prod123',
        cycleType: 'monthly',
        startDate: new Date(),
        nextBillingDate: new Date(),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
      });

      const b = { subscriptionId: '507f1f77bcf86cd799439013' };
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result.success).toBe(true);
      expect(res.body.result.message).toBe('Payment retry successful');

      // Check DB: status should be updated to active
      const updatedSub = await db.getCollection(subscriptionsCol).findOne({ subscriptionId: '507f1f77bcf86cd799439013' });
      expect(updatedSub.status).toBe('active');
      // payment attempt should be recorded
      const paymentAttempt = (await db.getCollection(paymentAttemptsCol).findOne({ subscriptionId: '507f1f77bcf86cd799439013' })) as IPaymentAttemptDocument;
      expect(paymentAttempt).toBeTruthy();
      expect(paymentAttempt.status).toBe('success');
    });
  });

  // TODO: A lot of edge cases can be tested here, e.g., payment gateway failures, etc.
  describe('Failure', () => {
    test('Payment retry failed (INSUFFICIENT_FUNDS)', async () => {
      // mock payment gateway to always fail
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: false,
        errorCode: 'INSUFFICIENT_FUNDS',
      });
      // Insert product first
      await db.getCollection('Products').insertOne({
        productId: 'prod1234',
        name: 'Test Product',
        price: 100,
        currency: 'TWD',
        cycleType: 'monthly',
        status: 'active',
      });
      // Insert subscription in grace status, but mock payment failure
      await db.getCollection(subscriptionsCol).insertOne({
        subscriptionId: '507f1f77bcf86cd799439014',
        status: 'grace',
        userId: dbHelper.newObjectId(),
        productId: 'prod1234',
        cycleType: 'monthly',
        startDate: new Date(),
        nextBillingDate: new Date(),
        renewalCount: 0,
        remainingDiscountPeriods: 0,
      });

      const b = { subscriptionId: '507f1f77bcf86cd799439014' };
      const res = await agent.post(endpoint).send(b);

      // Assuming mock gateway fails sometimes, but for now, expect success or adjust based on mock
      // This might need adjustment based on actual mock implementation
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result.success).toBe(false);
      expect(res.body.result.message).toBe('INSUFFICIENT_FUNDS');

      // check DB: status should remain in grace
      const updatedSub = await db.getCollection(subscriptionsCol).findOne({ subscriptionId: '507f1f77bcf86cd799439014' });
      expect(updatedSub.status).toBe('grace');

      // payment attempt should be recorded
      const paymentAttempt = (await db.getCollection(paymentAttemptsCol).findOne({ subscriptionId: '507f1f77bcf86cd799439014' })) as IPaymentAttemptDocument;
      expect(paymentAttempt).toBeTruthy();
      expect(paymentAttempt.status).toBe('failed');
      expect(paymentAttempt.failureReason).toBe('INSUFFICIENT_FUNDS');
    });
  });
});
