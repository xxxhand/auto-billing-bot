import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';
import { IDiscountDocument } from './__helpers__/shcema-interface.helper';

describe(`GET ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/discounts`, () => {
  let agent: superTest.SuperAgentTest;
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/discounts`;
  const dbHelper = new MongoHelper('get_discounts');
  const db = dbHelper.mongo;
  const discountCol = 'Discounts';

  //#region Test data
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const mockDiscounts: IDiscountDocument[] = [
    {
      _id: dbHelper.newObjectId(),
      discountId: 'global-discount-10',
      type: 'percentage',
      value: 10,
      priority: 1,
      startDate: yesterday, // Started yesterday
      endDate: nextMonth, // Valid for next month
      applicableProducts: [], // Global discount
      valid: true,
    },
    {
      _id: dbHelper.newObjectId(),
      discountId: 'product-specific-discount-20',
      type: 'fixed',
      value: 5,
      priority: 2,
      startDate: yesterday, // Started yesterday
      endDate: nextMonth, // Valid for next month
      applicableProducts: ['ProductId-1', 'ProductId-2'], // Specific products
      valid: true,
    },
    {
      _id: dbHelper.newObjectId(),
      discountId: 'expired-discount',
      type: 'percentage',
      value: 15,
      priority: 1,
      startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // Started 60 days ago
      endDate: yesterday, // Expired yesterday
      applicableProducts: [],
      valid: true,
    },
    {
      _id: dbHelper.newObjectId(),
      discountId: 'future-discount',
      type: 'percentage',
      value: 25,
      priority: 1,
      startDate: nextYear, // Starts next year
      endDate: new Date(nextYear.getTime() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days after start
      applicableProducts: [],
      valid: true,
    },
  ];
  //#endregion Test data

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
    await db.getCollection(discountCol).insertMany(mockDiscounts);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('GET /discounts', () => {
    it('should return applicable discounts only', async () => {
      const res = await agent.get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      // Should return only 2 discounts (expired and future should be filtered out)
      expect(res.body.result).toHaveLength(2);

      const discountIds = res.body.result.map((d: any) => d.discountId);
      expect(discountIds).toContain('global-discount-10');
      expect(discountIds).toContain('product-specific-discount-20');
      expect(discountIds).not.toContain('expired-discount');
      expect(discountIds).not.toContain('future-discount');
    });

    it('should return discounts with correct structure', async () => {
      const res = await agent.get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body.result).toBeInstanceOf(Array);

      const globalDiscount = res.body.result.find((d: any) => d.discountId === 'global-discount-10');
      expect(globalDiscount).toBeDefined();
      expect(globalDiscount.type).toBe('percentage');
      expect(globalDiscount.value).toBe(10);
      expect(globalDiscount.priority).toBe(1);
      expect(globalDiscount.applicableProducts).toEqual([]);

      const specificDiscount = res.body.result.find((d: any) => d.discountId === 'product-specific-discount-20');
      expect(specificDiscount).toBeDefined();
      expect(specificDiscount.type).toBe('fixed');
      expect(specificDiscount.value).toBe(5);
      expect(specificDiscount.priority).toBe(2);
      expect(specificDiscount.applicableProducts).toEqual(['ProductId-1', 'ProductId-2']);
    });

    it('should return empty array when no applicable discounts', async () => {
      // Clear all discounts
      await db.getCollection(discountCol).deleteMany({});

      // Insert only expired discount
      await db.getCollection(discountCol).insertOne(mockDiscounts[2]); // expired-discount

      const res = await agent.get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result).toHaveLength(0);
    });
  });
});