import * as superTest from 'supertest';
import { MongoHelper } from './__helpers__/mongo.helper';
import { AppHelper, getNewMockContainer } from './__helpers__/app.helper';
import { IProductDocument, IUserDocument, IPromoCodeDocument, IPromoCodeUsageDocument } from './__helpers__/shcema-interface.helper';

describe('GET /promoCodes/userPromoCodes (e2e)', () => {
  let agent: superTest.SuperAgentTest;
  const baseEndpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/promoCodes/userPromoCodes`;
  const dbHelper = new MongoHelper('get_userPromoCodes');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const promoCodeCol = 'PromoCodes';
  const promoCodeUsageCol = 'PromoCodeUsages';

  //#region Test data
  const userId = dbHelper.newObjectId();
  const mockUser: IUserDocument = {
    _id: userId,
    userId,
    tenantId: 'tenant-001',
    encryptedData: 'encrypted-data',
    valid: true,
  };

  const mockProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'prod-001',
    name: 'Test Product',
    price: 1000,
    cycleType: 'monthly',
    valid: true,
  };

  const mockGlobalPromoCode: IPromoCodeDocument = {
    _id: dbHelper.newObjectId(),
    code: 'GLOBAL10',
    discountId: dbHelper.newObjectAsString(),
    usageLimit: null,
    isSingleUse: false,
    usedCount: 0,
    minimumAmount: 500,
    applicableProducts: [],
    valid: true,
  };

  const mockProductPromoCode: IPromoCodeDocument = {
    _id: dbHelper.newObjectId(),
    code: 'PRODUCT20',
    discountId: dbHelper.newObjectAsString(),
    usageLimit: 5,
    isSingleUse: false,
    usedCount: 2,
    minimumAmount: 200,
    applicableProducts: [mockProduct.productId],
    valid: true,
  };

  const mockAssignedPromoCode: IPromoCodeDocument = {
    _id: dbHelper.newObjectId(),
    code: 'ASSIGNED15',
    discountId: dbHelper.newObjectAsString(),
    usageLimit: 3,
    isSingleUse: true,
    usedCount: 0,
    minimumAmount: 300,
    assignedUserId: mockUser._id,
    applicableProducts: [],
    valid: true,
  };

  const mockPromoCodeUsage: IPromoCodeUsageDocument = {
    _id: dbHelper.newObjectId(),
    usageId: dbHelper.newObjectAsString(),
    promoCode: mockGlobalPromoCode.code,
    userId: mockUser._id,
    usedAt: new Date(),
    orderAmount: 600,
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
      db.getCollection(promoCodeCol).insertOne(mockGlobalPromoCode),
      db.getCollection(promoCodeCol).insertOne(mockProductPromoCode),
      db.getCollection(promoCodeCol).insertOne(mockAssignedPromoCode),
    ]);
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Validation Errors', () => {
    it('should return error when userId is missing', async () => {
      const response = await agent.get(baseEndpoint).expect(400);

      expect(response.body.code).toBe(20001); // ERR_USER_NOT_FOUND
      expect(response.body.message).toContain('ERR_USER_NOT_FOUND');
    });

    it('should return global promo codes for non-existent user', async () => {
      const response = await agent
        .get(baseEndpoint)
        .query({ userId: dbHelper.newObjectAsString() })
        .expect(200);

      // Should return global promo codes for any user
      expect(response.body.code).toBe(0);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.result[0].code).toBe(mockGlobalPromoCode.code);
    });

    it('should not return assigned promo codes for other users', async () => {
      const otherUserId = dbHelper.newObjectAsString();
      const response = await agent
        .get(baseEndpoint)
        .query({ userId: otherUserId })
        .expect(200);

      // Should return only global promo codes, not assigned ones
      expect(response.body.code).toBe(0);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.result[0].code).toBe(mockGlobalPromoCode.code);
    });
  });

  describe('Success', () => {
    beforeEach(async () => {
      // Clear usage records for clean state
      await db.getCollection(promoCodeUsageCol).deleteMany({});
      // Reset promo codes usedCount
      await db.getCollection(promoCodeCol).updateMany({}, { $set: { usedCount: 0 } });
    });
    it('should return available promo codes for user without product filter', async () => {
      const response = await agent
        .get(baseEndpoint)
        .query({ userId: mockUser.userId.toHexString() })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result).toHaveLength(2); // Global + assigned

      const codes = response.body.result.map((p: any) => p.code).sort();
      expect(codes).toEqual([mockAssignedPromoCode.code, mockGlobalPromoCode.code]);

      const assignedPromo = response.body.result.find((p: any) => p.code === mockAssignedPromoCode.code);
      expect(assignedPromo).toMatchObject({
        isSingleUse: true,
        remainingUses: 3,
        minimumAmount: 300,
        applicableProducts: [],
      });
    });

    it('should return available promo codes for user with product filter', async () => {
      const response = await agent
        .get(baseEndpoint)
        .query({ userId: mockUser.userId.toHexString(), productId: mockProduct.productId })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result).toHaveLength(3); // Global + product-specific + assigned

      const codes = response.body.result.map((p: any) => p.code).sort();
      expect(codes).toEqual([mockAssignedPromoCode.code, mockGlobalPromoCode.code, mockProductPromoCode.code]);

      const productPromo = response.body.result.find((p: any) => p.code === mockProductPromoCode.code);
      expect(productPromo).toMatchObject({
        isSingleUse: false,
        remainingUses: 5, // 5 - 0 (reset in beforeEach)
        minimumAmount: 200,
        applicableProducts: [mockProduct.productId],
      });

      const assignedPromo = response.body.result.find((p: any) => p.code === mockAssignedPromoCode.code);
      expect(assignedPromo).toMatchObject({
        isSingleUse: true,
        remainingUses: 3,
        minimumAmount: 300,
        applicableProducts: [],
      });
    });

    it('should exclude used promo codes', async () => {
      // Insert usage record
      await db.getCollection(promoCodeUsageCol).insertOne(mockPromoCodeUsage);

      const response = await agent
        .get(baseEndpoint)
        .query({ userId: mockUser.userId.toHexString() })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.result).toHaveLength(1); // Assigned code remains
      expect(response.body.result[0].code).toBe(mockAssignedPromoCode.code);
    });

    it('should exclude exhausted promo codes', async () => {
      // Update product promo code to be exhausted
      await db.getCollection(promoCodeCol).updateOne(
        { code: mockProductPromoCode.code },
        { $set: { usedCount: 5, updatedAt: new Date() } }
      );

      const response = await agent
        .get(baseEndpoint)
        .query({ userId: mockUser.userId.toHexString(), productId: mockProduct.productId })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.result).toHaveLength(2); // Global + assigned remain (exhausted codes are filtered by repository)
      const codes = response.body.result.map((p: any) => p.code).sort();
      expect(codes).toEqual([mockAssignedPromoCode.code, mockGlobalPromoCode.code]);
    });
  });
});