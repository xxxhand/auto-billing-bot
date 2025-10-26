import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from '../__helpers__/app.helper';
import { MongoHelper } from '../__helpers__/mongo.helper';
import {
  IProductDocument,
  IUserDocument,
  ISubscriptionDocument,
  IPaymentAttemptDocument,
} from '../__helpers__/shcema-interface.helper';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { BillingService } from '../../src/infra/services/billing.service';
import { IBillingServiceToken } from '../../src/domain/services/billing.service.interface';

describe('BDD: 續訂月付產品第二次扣款(無優惠碼)', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('bdd_renewal_monthly_second_billing');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';
  const paymentAttemptCol = 'PaymentAttempts';

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

  // mock task queue
  const mockTaskQueue = {
    publishTask: jest.fn(),
    acknowledgeTask: jest.fn(),
    rejectTask: jest.fn(),
    consumeTasks: jest.fn(), // Add missing method
  };

  let billingService: BillingService;

  beforeAll(async () => {
    // Create testing module with mocks for payment gateway and task queue
    // const moduleFixture: TestingModule = await Test.createTestingModule({
    //   imports: [AppModule],
    // })
    //   .overrideProvider('IPaymentGateway')
    //   .useValue(mockPaymentGateway)
    //   .overrideProvider('ITaskQueue')
    //   .useValue(mockTaskQueue)
    //   .compile();

    // const app = moduleFixture.createNestApplication();
    // billingService = app.get(IBillingServiceToken);

    agent = await AppHelper.getAgentWithMockers(getNewMockContainer()
      .set('IPaymentGateway', mockPaymentGateway)
      .set('ITaskQueue', mockTaskQueue));

    // const app = AppHelper.app;
    billingService = AppHelper.currentApp.get(IBillingServiceToken);

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

  describe('Feature: 訂閱續訂', () => {
    describe('As a 現有訂閱用戶', () => {
      describe('I want to 系統自動續訂月付產品', () => {
        describe('So that 服務不中斷', () => {

          describe('Scenario: 第二次扣款成功（無優惠碼）', () => {
            let existingSubscription: ISubscriptionDocument;
            let billingResult: any;

            // Given 我已經訂閱月付產品（價格：每月 $240）
            // And 訂閱狀態為 "active"
            // And 續訂次數為 0
            // And 已經進行過第一次扣款（扣款 $240 成功）
            // And 下次扣款日期已到（從訂閱開始日後 1 個月）
            // And 我沒有使用任何優惠碼
            it('Given: 用戶已有月付訂閱且第一次扣款成功，下次扣款日期已到', async () => {
              // 創建現有訂閱記錄
              const startDate = new Date();
              startDate.setDate(startDate.getDate() - 35); // 訂閱開始日為35天前

              const nextBillingDate = new Date();
              nextBillingDate.setDate(nextBillingDate.getDate() - 5); // 下次扣款日期為5天前（已到期）

              existingSubscription = {
                _id: dbHelper.newObjectId(),
                subscriptionId: dbHelper.newObjectId().toHexString(),
                userId: mockUser.userId,
                productId: mockMonthlyProduct.productId,
                status: 'active',
                cycleType: 'monthly',
                startDate,
                nextBillingDate,
                renewalCount: 0, // 第一次扣款後續訂次數仍為0
                remainingDiscountPeriods: 0,
                appliedDiscountId: null,
                pendingConversion: null,
                gracePeriodEndDate: null,
                valid: true,
              };

              await db.getCollection(subscriptionCol).insertOne(existingSubscription);

              // 創建第一次扣款成功的記錄
              const firstPaymentAttempt: IPaymentAttemptDocument = {
                _id: dbHelper.newObjectId(),
                attemptId: dbHelper.newObjectId().toHexString(),
                subscriptionId: existingSubscription.subscriptionId,
                status: 'success',
                failureReason: '',
                retryCount: 0,
                amount: 240, // 第一次扣款金額（無折扣）
                createdAt: startDate,
                updatedAt: startDate,
                valid: true,
              };

              await db.getCollection(paymentAttemptCol).insertOne(firstPaymentAttempt);

              // 驗證設置正確
              const dbSubscription = await db.getCollection(subscriptionCol).findOne({
                subscriptionId: existingSubscription.subscriptionId
              });
              expect(dbSubscription).toBeTruthy();
              expect(dbSubscription.status).toBe('active');
              expect(dbSubscription.renewalCount).toBe(0);
              expect(dbSubscription.productId).toBe(mockMonthlyProduct.productId);

              // 驗證第一次扣款記錄存在
              const paymentAttempts = await db.getCollection(paymentAttemptCol).find({
                subscriptionId: existingSubscription.subscriptionId
              }).toArray();
              expect(paymentAttempts.length).toBe(1);
              expect(paymentAttempts[0].status).toBe('success');
              expect(paymentAttempts[0].amount).toBe(240);
            });

            // When 系統進行第二次扣款
            it('When: 系統進行第二次扣款', async () => {
              // Mock payment gateway to succeed for second billing
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-second-12345',
              });

              // Process second billing using real billing service
              billingResult = await billingService.processBilling(existingSubscription.subscriptionId);

              expect(billingResult.success).toBe(true);
              expect(billingResult.transactionId).toBe('txn-second-12345');
            });

            // Then 應該從我的支付方式扣款 $240（原價，無折扣）
            // And 扣款記錄應該被正確保存
            // And 訂閱的續訂次數應該更新為 1
            // And 下次扣款日期應該更新為從現在開始的 1 個月後
            // And 訂閱狀態應該保持 "active"
            // And 系統應該記錄續訂成功的事件
            it('Then: 驗證第二次扣款成功並更新訂閱狀態', async () => {
              // 驗證扣款金額為240（原價，無折扣）
              expect(mockPaymentGateway.charge).toHaveBeenCalledWith(
                expect.objectContaining({
                  amount: 240,
                  description: expect.stringContaining('Subscription billing'),
                })
              );

              // 驗證扣款記錄被保存
              const paymentAttempts = await db.getCollection(paymentAttemptCol).find({
                subscriptionId: existingSubscription.subscriptionId
              }).toArray();

              expect(paymentAttempts.length).toBe(2); // 第一次 + 第二次

              // 找到第二次扣款記錄
              const secondPayment = paymentAttempts.find((p: any) => p.status === 'success' && p.amount === 240 && p.attemptId !== paymentAttempts[0].attemptId);
              expect(secondPayment).toBeTruthy();

              // 驗證訂閱更新
              const updatedSubscription = await db.getCollection(subscriptionCol).findOne({
                subscriptionId: existingSubscription.subscriptionId
              });

              expect(updatedSubscription.renewalCount).toBe(1); // 續訂次數更新為1
              expect(updatedSubscription.status).toBe('active'); // 狀態保持active

              // 驗證下次扣款日期更新為一個月後
              const nextBillingDate = new Date(updatedSubscription.nextBillingDate);
              const now = new Date();
              const expectedNextMonth = new Date(now);
              expectedNextMonth.setMonth(now.getMonth() + 1);

              expect(nextBillingDate.getFullYear()).toBe(expectedNextMonth.getFullYear());
              expect(nextBillingDate.getMonth()).toBe(expectedNextMonth.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextMonth.getDate());
            });
          });
        });
      });
    });
  });
});