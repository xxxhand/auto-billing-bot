import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IDiscountDocument, ISubscriptionDocument, IProductDocument } from './__helpers__/shcema-interface.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/discounts/:id/apply`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/discounts`;
  const dbHelper = new MongoHelper('apply_discount');
  const db = dbHelper.mongo;
  const discountCol = 'Discounts';
  const subscriptionCol = 'Subscriptions';
  const productCol = 'Products';

  //#region Test data
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const mockProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'Product-001',
    name: 'Test Product',
    price: 100,
    cycleType: 'monthly',
    valid: true,
  };

  const mockDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'test-discount-20',
    type: 'percentage',
    value: 20,
    priority: 1,
    startDate: yesterday,
    endDate: nextMonth,
    applicableProducts: ['Product-001'],
    valid: true,
  };

  const mockSubscription: ISubscriptionDocument = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'Sub-001',
    userId: dbHelper.newObjectId(),
    productId: 'Product-001',
    status: 'active',
    cycleType: 'monthly',
    startDate: yesterday,
    nextBillingDate: nextMonth,
    renewalCount: 0,
    remainingDiscountPeriods: 0,
    valid: true,
  };

  const mockSubscription2: ISubscriptionDocument = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'Sub-002',
    userId: dbHelper.newObjectId(),
    productId: 'Product-001',
    status: 'active',
    cycleType: 'monthly',
    startDate: yesterday,
    nextBillingDate: nextMonth,
    renewalCount: 0,
    remainingDiscountPeriods: 0,
    valid: true,
  };
  //#endregion Test data

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
    await Promise.all([
      db.getCollection(productCol).insertOne(mockProduct),
      db.getCollection(discountCol).insertOne(mockDiscount),
      db.getCollection(subscriptionCol).insertOne(mockSubscription),
      db.getCollection(subscriptionCol).insertOne(mockSubscription2),
    ]);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('POST /discounts/:id/apply', () => {
    it('should successfully apply discount to subscription', async () => {
      const requestBody = {
        subscriptionId: 'Sub-001',
        discountPeriods: 3,
      };

      const res = await agent
        .post(`${endpoint}/${mockDiscount.discountId}/apply`)
        .send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeDefined();

      const result = res.body.result;
      expect(result.subscriptionId).toBe('Sub-001');
      expect(result.discountId).toBe('test-discount-20');
      expect(result.originalPrice).toBe(100);
      expect(result.discountedPrice).toBe(80); // 20% discount
      expect(result.discountPeriods).toBe(3);
      expect(result.appliedAt).toBeDefined();

      // Database state verification - check subscription was updated
      const updatedSubscription = await db.getCollection(subscriptionCol).findOne({ subscriptionId: 'Sub-001' });
      expect(updatedSubscription).toBeTruthy();
      expect(updatedSubscription.remainingDiscountPeriods).toBe(3);
      expect(updatedSubscription.appliedDiscountId).toBe('test-discount-20');
      expect(updatedSubscription.status).toBe('active'); // Should remain active
    });

    it('should apply discount without discountPeriods parameter', async () => {
      const requestBody = {
        subscriptionId: 'Sub-002',
      };

      const res = await agent
        .post(`${endpoint}/${mockDiscount.discountId}/apply`)
        .send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result.discountPeriods).toBeUndefined();

      // Database state verification - check subscription was NOT updated with discount periods
      const updatedSubscription = await db.getCollection(subscriptionCol).findOne({ subscriptionId: 'Sub-002' });
      expect(updatedSubscription).toBeTruthy();
      expect(updatedSubscription.remainingDiscountPeriods).toBe(0); // Should remain unchanged
      expect(updatedSubscription.status).toBe('active'); // Should remain active
    });

    it('should return error for non-existent discount', async () => {
      const requestBody = {
        subscriptionId: 'Sub-001',
      };

      const res = await agent
        .post(`${endpoint}/non-existent-discount/apply`)
        .send(requestBody);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20015);
    });

    it('should return error for non-existent subscription', async () => {
      const requestBody = {
        subscriptionId: 'non-existent-sub',
      };

      const res = await agent
        .post(`${endpoint}/${mockDiscount.discountId}/apply`)
        .send(requestBody);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20006);
    });

    it('should return error for discount not applicable to product', async () => {
      // Create a discount that doesn't apply to our product
      const invalidDiscount: IDiscountDocument = {
        _id: dbHelper.newObjectId(),
        discountId: 'invalid-discount',
        type: 'percentage',
        value: 10,
        priority: 1,
        startDate: yesterday,
        endDate: nextMonth,
        applicableProducts: ['Other-Product'], // Doesn't include Product-001
        valid: true,
      };
      await db.getCollection(discountCol).insertOne(invalidDiscount);

      const requestBody = {
        subscriptionId: 'Sub-001',
      };

      const res = await agent
        .post(`${endpoint}/invalid-discount/apply`)
        .send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20016);
    });

    it('should return error for expired discount', async () => {
      // Create an expired discount
      const expiredDiscount: IDiscountDocument = {
        _id: dbHelper.newObjectId(),
        discountId: 'expired-discount',
        type: 'percentage',
        value: 15,
        priority: 1,
        startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        endDate: yesterday, // Expired yesterday
        applicableProducts: ['Product-001'],
        valid: true,
      };
      await db.getCollection(discountCol).insertOne(expiredDiscount);

      const requestBody = {
        subscriptionId: 'Sub-001',
      };

      const res = await agent
        .post(`${endpoint}/expired-discount/apply`)
        .send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20017);
    });
  });
});