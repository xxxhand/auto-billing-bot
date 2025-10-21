import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from '../__helpers__/app.helper';
import { MongoHelper } from '../__helpers__/mongo.helper';
import {
  IProductDocument,
  IUserDocument,
} from '../__helpers__/shcema-interface.helper';

describe('BDD: 新用戶訂閱月付產品（無優惠碼）', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('bdd_new_user_monthly_subscription');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';

  // Background: 系統前提設定
  const mockUser: IUserDocument = {
    _id: dbHelper.newObjectId(),
    userId: dbHelper.newObjectId(),
    tenantId: 'tenant-001',
    encryptedData: 'encrypted-data',
    valid: true,
  };

  const mockMonthlyProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'monthly-product-001',
    name: '月付產品',
    price: 240, // 每月 $240
    cycleType: 'monthly',
    valid: true,
  };

  const mockYearlyProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'yearly-product-001',
    name: '年付產品',
    price: 2490, // 每年 $2490
    cycleType: 'yearly',
    valid: true,
  };

  // mock payment gateway
  const mockPaymentGateway = {
    charge: jest.fn(),
  };

  beforeAll(async () => {
    const mockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway);
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();

    // Setup test data according to Background
    await Promise.all([
      db.getCollection(userCol).insertOne(mockUser),
      db.getCollection(productCol).insertOne(mockMonthlyProduct),
      db.getCollection(productCol).insertOne(mockYearlyProduct),
    ]);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('Feature: 用戶訂閱產品', () => {
    describe('As a 新用戶', () => {
      describe('I want to 訂閱月付產品', () => {
        describe('So that 我可以開始使用服務', () => {

          describe('Scenario: 成功訂閱月付產品（無優惠碼）', () => {
            let subscriptionResponse: any;
            let productsResponse: any;

            // Given 我是一個新用戶，尚未有任何訂閱
            // And 系統中有可訂閱的月付產品（價格：每月 $240）
            // And 我沒有優惠碼
            it('Given: 系統設定正確且用戶無訂閱記錄', async () => {
              // 驗證用戶存在
              const dbUser = await db.getCollection(userCol).findOne({ userId: mockUser.userId });
              expect(dbUser).toBeTruthy();
              expect(dbUser.userId.toHexString()).toBe(mockUser.userId.toHexString());

              // 驗證月付產品存在且價格正確
              const dbMonthlyProduct = await db.getCollection(productCol).findOne({ productId: mockMonthlyProduct.productId });
              expect(dbMonthlyProduct).toBeTruthy();
              expect(dbMonthlyProduct.price).toBe(240);
              expect(dbMonthlyProduct.cycleType).toBe('monthly');

              // 驗證年付產品存在且價格正確
              const dbYearlyProduct = await db.getCollection(productCol).findOne({ productId: mockYearlyProduct.productId });
              expect(dbYearlyProduct).toBeTruthy();
              expect(dbYearlyProduct.price).toBe(2490);
              expect(dbYearlyProduct.cycleType).toBe('yearly');
            });

            // When 我查詢可訂閱產品列表
            it('When: 查詢可訂閱產品列表', async () => {
              const response = await agent
                .get(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`)
                .query({ userId: mockUser.userId.toHexString() });

              expect(response.status).toBe(200);
              expect(response.body.code).toBe(0);
              expect(Array.isArray(response.body.result)).toBe(true);

              productsResponse = response.body.result;

              // 驗證返回的產品資訊
              const monthlyProduct = productsResponse.find((p: any) => p.productId === mockMonthlyProduct.productId);
              expect(monthlyProduct).toBeTruthy();
              expect(monthlyProduct.name).toBe('月付產品');
              expect(monthlyProduct.originalPrice).toBe(240);
              expect(monthlyProduct.cycleType).toBe('monthly');
            });

            // Then 我應該看到月付產品的完整資訊（產品名稱、價格 $240、月付週期）
            // And 顯示價格應該是原價 $240（無優惠折扣）
            it('Then: 看到月付產品完整資訊且無優惠折扣', () => {
              const monthlyProduct = productsResponse.find((p: any) => p.productId === mockMonthlyProduct.productId);
              expect(monthlyProduct.name).toBe('月付產品');
              expect(monthlyProduct.originalPrice).toBe(240);
              expect(monthlyProduct.cycleType).toBe('monthly');
              // 無優惠折扣，顯示原價
              expect(monthlyProduct.discountedPrice).toBe(240);
            });

            // When 我選擇月付產品並確認訂閱
            it('When: 選擇月付產品並確認訂閱', async () => {
              // Mock payment gateway to succeed
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-12345',
              });

              const subscriptionRequest = {
                userId: mockUser.userId.toHexString(),
                productId: mockMonthlyProduct.productId,
              };

              const response = await agent
                .post(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`)
                .send(subscriptionRequest);

              expect(response.status).toBe(201);
              expect(response.body.code).toBe(0);

              subscriptionResponse = response.body.result;
            });

            // Then 系統應該為我創建新的訂閱記錄
            // And 訂閱狀態應該是 "active"
            // And 下次扣款日期應該是從今天開始的 1 個月後
            // And 續訂次數應該是 0
            // And 我應該收到訂閱成功的確認訊息
            it('Then: 創建新的訂閱記錄並驗證訂閱狀態', async () => {
              expect(subscriptionResponse).toBeTruthy();
              expect(subscriptionResponse.subscriptionId).toBeTruthy();
              expect(subscriptionResponse.status).toBe('active');

              // 驗證下次扣款日期是一個月後
              const nextBillingDate = new Date(subscriptionResponse.nextBillingDate);
              const startDate = new Date(subscriptionResponse.startDate);
              const expectedNextMonth = new Date(startDate);
              expectedNextMonth.setMonth(startDate.getMonth() + 1);

              // 檢查年份、月份和日期是否正確（處理跨年情況）
              expect(nextBillingDate.getFullYear()).toBe(expectedNextMonth.getFullYear());
              expect(nextBillingDate.getMonth()).toBe(expectedNextMonth.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextMonth.getDate());

              // 驗證資料庫中的訂閱記錄
              const dbSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId
              });
              expect(dbSubscription).toBeTruthy();
              expect(dbSubscription.status).toBe('active');
              expect(dbSubscription.renewalCount).toBe(0);
              expect(dbSubscription.userId.toHexString()).toBe(mockUser.userId.toHexString());
              expect(dbSubscription.productId).toBe(mockMonthlyProduct.productId);
            });

            // When 系統進行首次扣款
            it('When: 系統進行首次扣款', async () => {
              // 訂閱創建時會自動進行首次扣款，我們檢查payment attempt記錄
              const paymentAttempts = await db.getCollection('PaymentAttempts').find({
                subscriptionId: subscriptionResponse.subscriptionId
              }).toArray();

              expect(paymentAttempts.length).toBeGreaterThan(0);

              // 應該有一筆成功的支付記錄
              const successfulPayment = paymentAttempts.find((p: any) => p.status === 'success' || p.status === 'completed');
              expect(successfulPayment).toBeTruthy();
            });

            // Then 應該從我的支付方式扣款 $240
            // And 扣款記錄應該被正確保存
            // And 訂閱的續訂次數應該保持為 0（初始訂閱不計入續訂次數）
            it('Then: 驗證扣款成功並保持續訂次數為 0', async () => {
              // 驗證訂閱的續訂次數保持為0（初始訂閱創建時的第一次扣款不增加續訂次數）
              const updatedSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId
              });
              expect(updatedSubscription.renewalCount).toBe(0);

              // 驗證扣款記錄存在且成功
              const paymentAttempts = await db.getCollection('PaymentAttempts').find({
                subscriptionId: subscriptionResponse.subscriptionId
              }).toArray();
              expect(paymentAttempts.length).toBeGreaterThan(0);

              // 至少有一筆成功的扣款記錄
              const successfulPayment = paymentAttempts.find((p: any) => p.status === 'success');
              expect(successfulPayment).toBeTruthy();
              expect(successfulPayment.amount).toBe(240); // 驗證扣款金額
            });
          });
        });
      });
    });
  });
});