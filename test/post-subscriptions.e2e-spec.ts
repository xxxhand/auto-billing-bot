import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import {
  IProductDocument,
  ISubscriptionDocument,
  IUserDocument,
  IPromoCodeDocument,
  IPaymentAttemptDocument,
  IPromoCodeUsageDocument,
} from './__helpers__/shcema-interface.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`;
  const dbHelper = new MongoHelper('post_subscriptions');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';
  const promoCodeCol = 'PromoCodes';
  const paymentAttemptCol = 'PaymentAttempts';
  const promoCodeUsagesCol = 'PromoCodeUsages';

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
      db.getCollection(promoCodeCol).insertOne(mockPromoCode),
    ]);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('[20002] should return error for non-existent product', async () => {
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        productId: 'non-existent-product',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20002);
    });

    it('[20003] should return error when user already has active subscription for the product', async () => {
      // create new user who has a subscription
      const anotherUser: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-003',
        encryptedData: 'encrypted-data-3',
        valid: true,
      };
      await db.getCollection(userCol).insertOne(anotherUser);
      // First create a subscription
      const anotherUserSub: Partial<ISubscriptionDocument> = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'sub-002',
        userId: anotherUser.userId,
        productId: mockProduct.productId,
        status: 'active',
        cycleType: mockProduct.cycleType,
      };
      await db.getCollection(subscriptionCol).insertOne(anotherUserSub);

      // Try to create another subscription for the same product
      const secondRequest = {
        userId: anotherUser.userId.toHexString(),
        productId: mockProduct.productId,
      };
      const res = await agent.post(endpoint).send(secondRequest);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20003);
    });

    it('[20004] should return error for invalid promo code (not found)', async () => {
      // create another user
      const anotherUser2: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-004',
        encryptedData: 'encrypted-data-4',
        valid: true,
      };
      await db.getCollection(userCol).insertOne(anotherUser2);
      const requestBody = {
        userId: anotherUser2.userId.toHexString(),
        productId: mockProduct.productId,
        promoCode: 'INVALID_CODE',
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20004);
    });

    it('[20005] should return error when promo code minimum amount not met', async () => {
      // create another user
      const anotherUser2: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-004',
        encryptedData: 'encrypted-data-4',
        valid: true,
      };
      await db.getCollection(userCol).insertOne(anotherUser2);

      // Create a promo code with high minimum amount
      const highMinPromoCode: IPromoCodeDocument = {
        _id: dbHelper.newObjectId(),
        code: 'HIGH_MIN',
        discountId: 'disc-002',
        usageLimit: 100,
        isSingleUse: false,
        usedCount: 0,
        minimumAmount: 500, // Higher than product price
        assignedUserId: null,
        applicableProducts: [],
        valid: true,
      };
      await db.getCollection(promoCodeCol).insertOne(highMinPromoCode);

      const requestBody = {
        userId: anotherUser2.userId.toHexString(),
        productId: mockProduct.productId,
        promoCode: highMinPromoCode.code,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(20005);
    });
    
    it.skip('should return error for non-existent user', async () => {
      const requestBody = {
        userId: dbHelper.newObjectId().toHexString(),
        productId: mockProduct.productId,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(400);
      expect(res.body.code).not.toBe(0);
    });
  });
  describe('Success', () => {
    it('[0] should create subscription successfully', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        transactionId: 'txn-12345',
      });
      const requestBody = {
        userId: mockUser.userId.toHexString(),
        productId: mockProduct.productId,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeTruthy();
      expect(res.body.result.subscriptionId).toBeTruthy();
      expect(res.body.result.status).toBe('active');
      expect(res.body.result.productId).toBe(mockProduct.productId);
      expect(res.body.result.userId).toBe(mockUser.userId.toHexString());
      // check db
      // subscription
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: res.body.result.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub).toBeTruthy();
      expect(dbSub.userId.toHexString()).toBe(mockUser.userId.toHexString());
      expect(dbSub.productId).toBe(mockProduct.productId);
      expect(dbSub.status).toBe('active');
      expect(dbSub.cycleType).toBe(mockProduct.cycleType);
      expect(dbSub.startDate).toBeInstanceOf(Date);
      expect(dbSub.nextBillingDate).toBeInstanceOf(Date);
      expect(dbSub.renewalCount).toBe(0);
      expect(dbSub.remainingDiscountPeriods).toBe(0);
      expect(dbSub.pendingConversion).toBeNull();
      // payment attempt
      const dbAttempts = (await db.getCollection(paymentAttemptCol).findOne({ subscriptionId: dbSub.subscriptionId })) as IPaymentAttemptDocument;
      expect(dbAttempts).toBeTruthy();
      expect(dbAttempts.status).toBe('success');
      expect(dbAttempts.failureReason).toBe('');
      expect(dbAttempts.retryCount).toBe(0);
    });

    it.skip('[0] should create subscription with promo code (non-single use)', async () => {
      jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
        success: true,
        transactionId: 'txn-123456',
      });
      // new user
      const newUser: IUserDocument = {
        _id: dbHelper.newObjectId(),
        userId: dbHelper.newObjectId(),
        tenantId: 'tenant-002',
        encryptedData: 'encrypted-data-2',
        valid: true,
      };
      await db.getCollection(userCol).insertOne(newUser);
      const requestBody = {
        userId: newUser.userId,
        productId: mockProduct.productId,
        promoCode: mockPromoCode.code,
      };

      const res = await agent.post(endpoint).send(requestBody);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.subscriptionId).toBeTruthy();
      // check db
      // subscription
      const dbSub = (await db.getCollection(subscriptionCol).findOne({ subscriptionId: res.body.result.subscriptionId })) as ISubscriptionDocument;
      expect(dbSub).toBeTruthy();
      expect(dbSub.userId.toHexString()).toBe(newUser.userId.toHexString());
      expect(dbSub.productId).toBe(mockProduct.productId);
      expect(dbSub.status).toBe('active');
      // payment attempt
      const dbAttempts = (await db.getCollection(paymentAttemptCol).findOne({ subscriptionId: dbSub.subscriptionId })) as IPaymentAttemptDocument;
      expect(dbAttempts).toBeTruthy();
      expect(dbAttempts.status).toBe('success');
      expect(dbAttempts.failureReason).toBe('');
      expect(dbAttempts.retryCount).toBe(0);
      // promo code usedCount should increase for non-single use
      const dbPromo = (await db.getCollection(promoCodeCol).findOne({ code: mockPromoCode.code })) as IPromoCodeDocument;
      expect(dbPromo).toBeTruthy();
      expect(dbPromo.usedCount).toBe(1);
      // check PromoCodeUsages
      const dbPromoUsages = (await db.getCollection(promoCodeUsagesCol).find({ promoCode: mockPromoCode.code }).toArray()) as IPromoCodeUsageDocument[];
      expect(dbPromoUsages).toHaveLength(1);
      expect(dbPromoUsages[0].userId).toBe(newUser._id.toHexString());
      expect(dbPromoUsages[0].orderAmount).toBe(50); // after product.price - promoCode.minimumAmount
    });
  });
});
