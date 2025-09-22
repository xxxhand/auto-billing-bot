import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';

describe(`Subscription API (e2e)`, () => {
  const subscriptionEndpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`;
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('subscription');
  let testProductId: string;

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await dbHelper.mongo.tryConnect();

    // 創建測試產品數據
    const productCol = dbHelper.mongo.getCollection('products');
    const insertResult = await productCol.insertOne({
      name: '月費產品',
      cycleType: 'monthly',
      price: 299,
    });
    testProductId = insertResult.insertedId.toHexString();
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    dbHelper.mongo.close();
  });

  describe(`POST ${subscriptionEndpoint}`, () => {
    it('應該成功創建訂閱', () => {
      return agent
        .post(subscriptionEndpoint)
        .send({
          userId: 'user-123',
          productId: testProductId,
          startDate: '2025-01-15T10:00:00.000Z',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.result).toHaveProperty('subscriptionId');
          expect(res.body.result).toHaveProperty('nextBillingDate');
        });
    });

    it('產品不存在時應該返回錯誤', () => {
      return agent
        .post(subscriptionEndpoint)
        .send({
          userId: 'user-123',
          productId: 'nonexistent-product-id',
          startDate: '2025-01-15T10:00:00.000Z',
        })
        .expect(500);
    });
  });

  describe(`GET ${subscriptionEndpoint}/products`, () => {
    it('應該返回使用者可用的產品列表', () => {
      return agent
        .get(`${subscriptionEndpoint}/products`)
        .query({ userId: 'user-123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(Array.isArray(res.body.result)).toBe(true);
        });
    });
  });

  describe(`POST ${subscriptionEndpoint}/payments`, () => {
    let subscriptionId: string;

    beforeAll(async () => {
      // 先創建一個訂閱用於測試
      const createResponse = await agent.post(subscriptionEndpoint).send({
        userId: 'user-pay-test',
        productId: testProductId,
        startDate: '2025-01-15T10:00:00.000Z',
      });
      subscriptionId = createResponse.body.result.subscriptionId;
    });

    it('應該成功處理支付', () => {
      return agent
        .post(`${subscriptionEndpoint}/payments`)
        .send({ subscriptionId, amount: 299 })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.result).toHaveProperty('paymentId');
          expect(res.body.result).toHaveProperty('status');
        });
    });

    it('訂閱不存在時應該返回錯誤', () => {
      return agent.post(`${subscriptionEndpoint}/payments`).send({ subscriptionId: 'nonexistent-sub', amount: 299 }).expect(500);
    });
  });

  describe(`GET ${subscriptionEndpoint}/:subscriptionId`, () => {
    let subscriptionId: string;

    beforeAll(async () => {
      // 先創建一個訂閱用於測試
      const createResponse = await agent.post(subscriptionEndpoint).send({
        userId: 'user-status-test',
        productId: testProductId,
        startDate: '2025-01-15T10:00:00.000Z',
      });
      subscriptionId = createResponse.body.result.subscriptionId;
    });

    it('應該返回訂閱狀態', () => {
      return agent
        .get(`${subscriptionEndpoint}/${subscriptionId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.result).toHaveProperty('subscriptionId', subscriptionId);
          expect(res.body.result).toHaveProperty('status');
          expect(res.body.result).toHaveProperty('nextBillingDate');
        });
    });

    it('訂閱不存在時應該返回錯誤', () => {
      return agent.get(`${subscriptionEndpoint}/nonexistent-sub`).expect(500);
    });
  });

  describe(`PATCH ${subscriptionEndpoint}/:subscriptionId/cancel`, () => {
    let subscriptionId: string;

    beforeAll(async () => {
      // 先創建一個訂閱用於測試
      const createResponse = await agent.post(subscriptionEndpoint).send({
        userId: 'user-cancel-test',
        productId: testProductId,
        startDate: '2025-01-15T10:00:00.000Z',
      });
      subscriptionId = createResponse.body.result.subscriptionId;
    });

    it('應該成功取消訂閱', () => {
      return agent
        .patch(`${subscriptionEndpoint}/${subscriptionId}/cancel`)
        .send({ operatorId: 'operator-123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.result).toHaveProperty('subscriptionId', subscriptionId);
          expect(res.body.result).toHaveProperty('status', 'cancelled');
        });
    });

    it('訂閱不存在時應該返回錯誤', () => {
      return agent.patch(`${subscriptionEndpoint}/nonexistent-sub/cancel`).send({ operatorId: 'operator-123' }).expect(500);
    });
  });
});
