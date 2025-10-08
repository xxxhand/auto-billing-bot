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
  //#region Test data
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

  // Discount only applicable to yearly product (ProductId-3)
  const mockDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'yearly-discount-20',
    type: 'percentage',
    value: 20,
    priority: 1,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    applicableProducts: ['ProductId-3'], // Only applies to yearly product
    valid: true,
  };
  //#endregion Test data

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
    await Promise.all([
      db.getCollection(productCol).insertMany(mockProducts),
      db.getCollection(discountCol).insertOne(mockDiscount)
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

      // Only yearly product should have discount (20% off = 30 * 0.8 = 24)
      expect(monthlyProduct.discountedPrice).toBe(10); // No discount
      expect(quarterlyProduct.discountedPrice).toBe(20); // No discount
      expect(yearlyProduct.discountedPrice).toBe(24); // 20% discount applied

      // Verify applicable discounts
      expect(monthlyProduct.applicableDiscounts).toHaveLength(0);
      expect(quarterlyProduct.applicableDiscounts).toHaveLength(0);
      expect(yearlyProduct.applicableDiscounts).toHaveLength(1);
      expect(yearlyProduct.applicableDiscounts[0].discountId).toBe('yearly-discount-20');
    });
  });
});
