import * as _ from 'lodash';
import * as superTest from 'supertest';
import { CustomUtils } from '@xxxhand/app-common';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IProductDocument, ISubscriptionDocument, IDiscountDocument } from './__helpers__/shcema-interface.helper';

describe(`GET ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`;
  const dbHelper = new MongoHelper('get_products');
  const db = dbHelper.mongo;
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';
  const discountCol = 'Discounts';
  const rulesCol = 'Rules';
  //#region Test data
  // Dynamic dates for test data
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  // 3 products. monthly, quarterly, yearly
  const mockProducts: IProductDocument[] = [];
  for (let i = 1; i <= 3; i++) {
    mockProducts.push({
      _id: dbHelper.newObjectId(),
      name: `Product ${i}`,
      productId: `ProductId-${i}`,
      price: i * 10,
      cycleType: i === 1 ? 'monthly' : i === 2 ? 'quarterly' : 'yearly',
      valid: true,
    });
  }

  // Fixed price discount only applicable to quarterly product (ProductId-2)
  const mockFixedPriceDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'quarterly-fixed-price-15',
    type: 'fixed_price',
    value: 15,
    priority: 1,
    startDate: yesterday, // Started yesterday
    endDate: nextYear, // Valid for next year
    applicableProducts: ['ProductId-2'], // Only applies to quarterly product
    valid: true,
  };

  // Regular discount for yearly products
  const mockYearlyDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'yearly-discount-20',
    type: 'percentage',
    value: 20,
    priority: 1,
    startDate: yesterday, // Started yesterday
    endDate: nextYear, // Valid for next year
    applicableProducts: ['ProductId-3'], // Only applies to yearly product
    valid: true,
  };

  // First-time subscription discount rule for yearly products
  const mockFirstTimeDiscountRule: any = {
    _id: dbHelper.newObjectId(),
    ruleId: 'first_time_yearly_discount',
    type: 'discount',
    conditions: {
      'subscription.isFirstTimeSubscription': true,
      'product.cycleType': 'yearly',
      'currentDate': { operator: 'lte', value: '2026-12-31' },
    },
    actions: {
      discount: {
        type: 'fixed',
        value: 1000,
      },
    },
    valid: true,
  };
  //#endregion Test data

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
    await Promise.all([
      db.getCollection(productCol).insertMany(mockProducts),
      db.getCollection(discountCol).insertOne(mockFixedPriceDiscount),
      db.getCollection(discountCol).insertOne(mockYearlyDiscount),
      db.getCollection(rulesCol).insertOne(mockFirstTimeDiscountRule)
    ]);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('GET /products', () => {
    it('should return products list with discounted prices for new user', async () => {
      const res = await agent.get(endpoint).query({ userId: dbHelper.newObjectAsString() });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(mockProducts.length);
    });

    it('should return products list if userId is missing', async () => {
      const res = await agent.get(endpoint).query({ userId: '' });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(mockProducts.length);
    });

    it('should filter out already subscribed products', async () => {
      // User with one active subscription to ProductId-1
      const mockUserId = dbHelper.newObjectId();
      const activeSubscription: Partial<ISubscriptionDocument> = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'Sub-001',
        userId: mockUserId,
        productId: 'ProductId-1',
        status: 'active',
      };
      await db.getCollection(subscriptionCol).insertOne(activeSubscription);
      const res = await agent.get(endpoint).query({ userId: mockUserId.toHexString() });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      // Should return 2 products since one is already subscribed
      expect(res.body.result).toHaveLength(mockProducts.length - 1);
      const returnedProductIds = res.body.result.map((p: any) => p.productId);
      expect(returnedProductIds).not.toContain('ProductId-1');
    });

    it('should return 3 products where only yearly product has discount', async () => {
      // Use a user with existing subscription to avoid first-time discount
      const mockUserId = dbHelper.newObjectId();
      const activeSubscription: Partial<ISubscriptionDocument> = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'Sub-regular-discount',
        userId: mockUserId,
        productId: 'ProductId-2', // Quarterly product
        status: 'active',
      };
      await db.getCollection(subscriptionCol).insertOne(activeSubscription);

      const res = await agent.get(endpoint).query({ userId: mockUserId.toHexString() });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(2); // ProductId-2 filtered out

      // Find remaining products
      const monthlyProduct = res.body.result.find((p: any) => p.cycleType === 'monthly');
      const yearlyProduct = res.body.result.find((p: any) => p.cycleType === 'yearly');

      // Verify all products exist
      expect(monthlyProduct).toBeDefined();
      expect(yearlyProduct).toBeDefined();

      // Verify prices
      expect(monthlyProduct.originalPrice).toBe(10);
      expect(yearlyProduct.originalPrice).toBe(30);

      // Only yearly product should have regular discount (20% off = 30 * 0.8 = 24)
      expect(monthlyProduct.discountedPrice).toBe(10); // No discount
      expect(yearlyProduct.discountedPrice).toBe(24); // 20% discount applied

      // Verify applied discounts
      expect(monthlyProduct.appliedDiscount).toBeUndefined(); // No discount applied
      expect(yearlyProduct.appliedDiscount).toBeDefined();
      expect(yearlyProduct.appliedDiscount.type).toBe('percentage');
      expect(yearlyProduct.appliedDiscount.value).toBe(20);

      // Verify applicable discounts
      expect(monthlyProduct.applicableDiscounts).toHaveLength(0);
      expect(yearlyProduct.applicableDiscounts).toHaveLength(1);
      expect(yearlyProduct.applicableDiscounts[0].discountId).toBe('yearly-discount-20');
    });

    it('should apply first-time subscription discount to yearly product for new users', async () => {
      const res = await agent.get(endpoint).query({ userId: dbHelper.newObjectAsString() });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(3);

      // Find products by cycle type
      const monthlyProduct = res.body.result.find((p: any) => p.cycleType === 'monthly');
      const quarterlyProduct = res.body.result.find((p: any) => p.cycleType === 'quarterly');
      const yearlyProduct = res.body.result.find((p: any) => p.cycleType === 'yearly');

      // Verify all products exist
      expect(monthlyProduct).toBeDefined();
      expect(quarterlyProduct).toBeDefined();
      expect(yearlyProduct).toBeDefined();

      // Verify prices
      expect(monthlyProduct.originalPrice).toBe(10);
      expect(quarterlyProduct.originalPrice).toBe(20);
      expect(yearlyProduct.originalPrice).toBe(30);

      // First-time discount has higher priority than regular discount
      // Yearly product should get $1000 fixed discount (30 - 1000 = 0, but minimum 0)
      expect(monthlyProduct.discountedPrice).toBe(10); // No discount
      expect(quarterlyProduct.discountedPrice).toBe(15); // Fixed price discount applied
      expect(yearlyProduct.discountedPrice).toBe(0); // First-time discount applied (30 - 1000 = 0)

      // Verify applied discounts
      expect(monthlyProduct.appliedDiscount).toBeUndefined(); // No discount applied
      expect(quarterlyProduct.appliedDiscount).toBeDefined();
      expect(quarterlyProduct.appliedDiscount.type).toBe('fixed_price');
      expect(quarterlyProduct.appliedDiscount.value).toBe(15);
      expect(yearlyProduct.appliedDiscount).toBeDefined();
      expect(yearlyProduct.appliedDiscount.type).toBe('fixed');
      expect(yearlyProduct.appliedDiscount.value).toBe(1000);

      // Verify applicable discounts (regular discount still shown)
      expect(monthlyProduct.applicableDiscounts).toHaveLength(0);
      expect(quarterlyProduct.applicableDiscounts).toHaveLength(1);
      expect(quarterlyProduct.applicableDiscounts[0].discountId).toBe('quarterly-fixed-price-15');
      expect(yearlyProduct.applicableDiscounts).toHaveLength(1);
      expect(yearlyProduct.applicableDiscounts[0].discountId).toBe('yearly-discount-20');
    });

    it('should apply fixed price discount correctly', async () => {
      // Use a user with existing subscription to avoid first-time discount
      const mockUserId = dbHelper.newObjectId();
      const activeSubscription: Partial<ISubscriptionDocument> = {
        _id: dbHelper.newObjectId(),
        subscriptionId: 'Sub-fixed-price-test',
        userId: mockUserId,
        productId: 'ProductId-1', // Monthly product (will be filtered out)
        status: 'active',
      };
      await db.getCollection(subscriptionCol).insertOne(activeSubscription);

      const res = await agent.get(endpoint).query({ userId: mockUserId.toHexString() });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(2); // ProductId-1 filtered out

      // Find remaining products
      const quarterlyProduct = res.body.result.find((p: any) => p.cycleType === 'quarterly');
      const yearlyProduct = res.body.result.find((p: any) => p.cycleType === 'yearly');

      // Verify all products exist
      expect(quarterlyProduct).toBeDefined();
      expect(yearlyProduct).toBeDefined();

      // Verify prices
      expect(quarterlyProduct.originalPrice).toBe(20);
      expect(yearlyProduct.originalPrice).toBe(30);

      // Quarterly product should have fixed price discount (always $15 regardless of original price)
      expect(quarterlyProduct.discountedPrice).toBe(15); // Fixed price discount applied
      expect(yearlyProduct.discountedPrice).toBe(24); // 20% discount applied

      // Verify applied discounts
      expect(quarterlyProduct.appliedDiscount).toBeDefined();
      expect(quarterlyProduct.appliedDiscount.type).toBe('fixed_price');
      expect(quarterlyProduct.appliedDiscount.value).toBe(15);
      expect(yearlyProduct.appliedDiscount).toBeDefined();
      expect(yearlyProduct.appliedDiscount.type).toBe('percentage');
      expect(yearlyProduct.appliedDiscount.value).toBe(20);

      // Verify applicable discounts
      expect(quarterlyProduct.applicableDiscounts).toHaveLength(1);
      expect(quarterlyProduct.applicableDiscounts[0].discountId).toBe('quarterly-fixed-price-15');
      expect(yearlyProduct.applicableDiscounts).toHaveLength(1);
      expect(yearlyProduct.applicableDiscounts[0].discountId).toBe('yearly-discount-20');
    });
  });
});
