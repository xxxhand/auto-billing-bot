import * as superTest from 'supertest';
import { AppHelper } from '../../../test/__helpers__/app.helper';
import { BillingCycleType } from '../../domain/entities/subscription.entity';
import { DEFAULT_REDIS } from '../../../libs/common/src/common.const';

describe('Subscription API (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    // Mock Redis instance for testing
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    const mockers = new Map();
    mockers.set(DEFAULT_REDIS, mockRedis);
    agent = await AppHelper.getAgentWithMockers(mockers);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  describe('/subscriptions (POST)', () => {
    it('should create a subscription', () => {
      return agent
        .post('/subscriptions')
        .send({
          userId: 'user-001',
          productId: 'product-001',
          billingCycle: BillingCycleType.MONTHLY,
          startDate: '2024-01-01T00:00:00.000Z',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe('user-001');
          expect(res.body.productId).toBe('product-001');
          expect(res.body.billingCycle).toBe(BillingCycleType.MONTHLY);
          expect(res.body.status).toBe('pending');
          expect(res.body).toHaveProperty('startDate');
        });
    });

    it('should create subscription with default start date', () => {
      return agent
        .post('/subscriptions')
        .send({
          userId: 'user-002',
          productId: 'product-001',
          billingCycle: BillingCycleType.YEARLY,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.billingCycle).toBe(BillingCycleType.YEARLY);
          expect(res.body.status).toBe('pending');
          expect(res.body).toHaveProperty('startDate');
        });
    });

    it('should return 400 for invalid data', () => {
      return agent
        .post('/subscriptions')
        .send({
          userId: 'user-003',
          // missing productId and billingCycle
        })
        .expect(400);
    });
  });

  describe('/subscriptions/:id (GET)', () => {
    it('should return subscription by id', async () => {
      // First create a subscription
      const createResponse = await agent
        .post('/subscriptions')
        .send({
          userId: 'user-003',
          productId: 'product-001',
          billingCycle: BillingCycleType.MONTHLY,
        })
        .expect(201);

      const subscriptionId = createResponse.body.id;

      // Then get it
      return agent
        .get(`/subscriptions/${subscriptionId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(subscriptionId);
          expect(res.body.userId).toBe('user-003');
        });
    });

    it('should return 404 for non-existent subscription', () => {
      return agent.get('/subscriptions/non-existent').expect(404);
    });
  });

  describe('/subscriptions (GET)', () => {
    it('should return user subscriptions', async () => {
      // Create a subscription for the user
      await agent
        .post('/subscriptions')
        .send({
          userId: 'user-004',
          productId: 'product-001',
          billingCycle: BillingCycleType.MONTHLY,
        })
        .expect(201);

      // Get user subscriptions
      return agent
        .get('/subscriptions?userId=user-004')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].userId).toBe('user-004');
        });
    });
  });

  describe('/subscriptions/:id/plan (PATCH)', () => {
    it('should change subscription plan', async () => {
      // Create a monthly subscription
      const createResponse = await agent
        .post('/subscriptions')
        .send({
          userId: 'user-005',
          productId: 'product-001',
          billingCycle: BillingCycleType.MONTHLY,
        })
        .expect(201);

      const subscriptionId = createResponse.body.id;

      // Change plan to yearly
      return agent
        .patch(`/subscriptions/${subscriptionId}/plan`)
        .send({
          billingCycle: BillingCycleType.YEARLY,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(subscriptionId);
          expect(res.body.billingCycle).toBe(BillingCycleType.MONTHLY); // Should remain monthly (pending change)
          expect(res.body.pendingPlanChange).toBe(BillingCycleType.YEARLY); // Should have pending change
        });
    });

    it('should return 400 for invalid plan change', async () => {
      // Create a yearly subscription
      const createResponse = await agent
        .post('/subscriptions')
        .send({
          userId: 'user-006',
          productId: 'product-001',
          billingCycle: BillingCycleType.YEARLY,
        })
        .expect(201);

      const subscriptionId = createResponse.body.id;

      // Try to change to monthly (invalid downgrade)
      return agent
        .patch(`/subscriptions/${subscriptionId}/plan`)
        .send({
          billingCycle: BillingCycleType.MONTHLY,
        })
        .expect(400);
    });

    it('should return 404 for non-existent subscription', () => {
      return agent
        .patch('/subscriptions/non-existent/plan')
        .send({
          billingCycle: BillingCycleType.YEARLY,
        })
        .expect(404);
    });
  });
});
