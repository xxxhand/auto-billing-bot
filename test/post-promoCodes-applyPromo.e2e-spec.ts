import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import {
  IProductDocument,
  IUserDocument,
  IPromoCodeDocument,
  IDiscountDocument,
  IPromoCodeUsageDocument,
  ISubscriptionDocument,
} from './__helpers__/shcema-interface.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/promoCodes/applyPromo`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/promoCodes/applyPromo`;
  const dbHelper = new MongoHelper('apply_promo');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const promoCodeCol = 'PromoCodes';
  const discountCol = 'Discounts';
  const promoCodeUsagesCol = 'PromoCodeUsages';
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
    name: 'Test Product',
    price: 100,
    cycleType: 'monthly',
    valid: true,
  };

  const mockDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'disc-001',
    type: 'fixed',
    value: 20,
    priority: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    applicableProducts: [],
    valid: true,
  };

  const mockPromoCode: IPromoCodeDocument = {
    _id: dbHelper.newObjectId(),
    code: 'SAVE20',
    discountId: 'disc-001',
    usageLimit: 100,
    isSingleUse: false,
    usedCount: 0,
    minimumAmount: 50,
    assignedUserId: null,
    applicableProducts: [],
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
    appliedDiscountId: null,
    valid: true,
  };

  const mockSubscriptionWithDiscount: ISubscriptionDocument = {
    _id: dbHelper.newObjectId(),
    subscriptionId: 'sub-002',
    userId: mockUser.userId,
    productId: mockProduct.productId,
    status: 'active',
    cycleType: 'monthly',
    startDate: new Date('2024-01-01'),
    nextBillingDate: new Date('2024-02-01'),
    renewalCount: 0,
    remainingDiscountPeriods: 2,
    appliedDiscountId: 'existing-discount',
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
      db.getCollection(discountCol).insertOne(mockDiscount),
      db.getCollection(promoCodeCol).insertOne(mockPromoCode),
      db.getCollection(subscriptionCol).insertOne(mockSubscription),
      db.getCollection(subscriptionCol).insertOne(mockSubscriptionWithDiscount),
    ]);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('[20001] should return error for non-existent user', async () => {
      const requestBody = {
        userId: dbHelper.newObjectId().toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20001);
    });

    it('[20018] should return error for non-existent promo code', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: 'INVALID_CODE',
        orderAmount: 100,
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20018);
    });

    it('[20019] should return error for invalid order amount', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 0,
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20019);
    });

    it('[20020] should return error for empty product IDs', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20020);
    });

    it('[20005] should return error when promo code validation fails (minimum amount)', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 30, // Below minimum 50
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20005);
    });

    it('[20014] should return error when applyToSubscription is true but subscriptionId is missing', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
        applyToSubscription: true,
        // subscriptionId is missing
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20014);
    });

    it('[20006] should return error when subscription does not exist', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
        applyToSubscription: true,
        subscriptionId: 'non-existent-sub',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(20006);
    });

    it('[20001] should return error when user does not own the subscription', async () => {
      const otherUserId = dbHelper.newObjectId();
      const requestBody = {
        userId: otherUserId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
        applyToSubscription: true,
        subscriptionId: mockSubscription.subscriptionId,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20001);
    });

    it('[20005] should return error when subscription already has an active discount', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
        applyToSubscription: true,
        subscriptionId: mockSubscriptionWithDiscount.subscriptionId,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20005);
    });
  });

  describe('Success', () => {
    it('[0] should successfully apply promo code with fixed discount', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.code).toBe(mockPromoCode.code);
      expect(res.body.result.discountId).toBe(mockDiscount.discountId);
      expect(res.body.result.discountType).toBe('fixed');
      expect(res.body.result.discountValue).toBe(20);
      expect(res.body.result.originalAmount).toBe(100);
      expect(res.body.result.discountedAmount).toBe(80); // 100 - 20
      expect(res.body.result.savings).toBe(20);

      // Check database state
      const dbPromo = (await db.getCollection(promoCodeCol).findOne({ code: mockPromoCode.code })) as IPromoCodeDocument;
      expect(dbPromo.usedCount).toBe(1);

      const dbUsages = (await db.getCollection(promoCodeUsagesCol).find({ promoCode: mockPromoCode.code }).toArray()) as IPromoCodeUsageDocument[];
      expect(dbUsages).toHaveLength(1);
      expect(dbUsages[0].userId.toHexString()).toBe(mockUser.userId.toHexString());
      expect(dbUsages[0].orderAmount).toBe(100);
    });

    it('[0] should successfully apply promo code with percentage discount', async () => {
      // Create percentage discount
      const percentDiscount: IDiscountDocument = {
        _id: dbHelper.newObjectId(),
        discountId: 'disc-percent',
        type: 'percentage',
        value: 10,
        priority: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        applicableProducts: [],
        valid: true,
      };

      const percentPromoCode: IPromoCodeDocument = {
        _id: dbHelper.newObjectId(),
        code: 'SAVE10PERCENT',
        discountId: 'disc-percent',
        usageLimit: 100,
        isSingleUse: false,
        usedCount: 0,
        minimumAmount: 50,
        assignedUserId: null,
        applicableProducts: [],
        valid: true,
      };

      await db.getCollection(discountCol).insertOne(percentDiscount);
      await db.getCollection(promoCodeCol).insertOne(percentPromoCode);

      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: percentPromoCode.code,
        orderAmount: 200,
        productIds: [mockProduct.productId],
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result.discountType).toBe('percentage');
      expect(res.body.result.discountValue).toBe(10);
      expect(res.body.result.originalAmount).toBe(200);
      expect(res.body.result.discountedAmount).toBe(180); // 200 - (200 * 0.1)
      expect(res.body.result.savings).toBe(20);
    });

    it('[0] should successfully apply promo code to subscription', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        promoCode: mockPromoCode.code,
        orderAmount: 100,
        productIds: [mockProduct.productId],
        applyToSubscription: true,
        subscriptionId: mockSubscription.subscriptionId,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.code).toBe(mockPromoCode.code);
      expect(res.body.result.discountId).toBe(mockDiscount.discountId);
      expect(res.body.result.appliedToSubscription).toBe(true);
      expect(res.body.result.subscriptionId).toBe(mockSubscription.subscriptionId);
      expect(res.body.result.remainingDiscountPeriods).toBe(3);
      expect(res.body.result.message).toContain('優惠已應用至訂閱');

      // Check database state - subscription should be updated
      const dbSubscription = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: mockSubscription.subscriptionId })) as ISubscriptionDocument;
      expect(dbSubscription.appliedDiscountId).toBe(mockDiscount.discountId);
      expect(dbSubscription.remainingDiscountPeriods).toBe(3);

      // Check database state - promo code usage should be recorded
      const dbPromo = (await db.getCollection(promoCodeCol).findOne({ code: mockPromoCode.code })) as IPromoCodeDocument;
      expect(dbPromo.usedCount).toBe(2); // Already used once in previous test

      const dbUsages = (await db.getCollection(promoCodeUsagesCol).find({ promoCode: mockPromoCode.code }).toArray()) as IPromoCodeUsageDocument[];
      expect(dbUsages).toHaveLength(2); // Should have 2 usages now
    });
  });
});