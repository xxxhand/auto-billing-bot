import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from '../__helpers__/app.helper';
import { MongoHelper } from '../__helpers__/mongo.helper';
import {
  IProductDocument,
  IUserDocument,
  ISubscriptionDocument,
  IPaymentAttemptDocument,
  IDiscountDocument,
} from '../__helpers__/shcema-interface.helper';
import { BillingService } from '../../src/infra/services/billing.service';
import { IBillingServiceToken } from '../../src/domain/services/billing.service.interface';

describe('BDD: 續訂年付產品第二次扣款(週年慶折扣2000)', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('bdd_renewal_yearly_second_billing_anniversary');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const subscriptionCol = 'Subscriptions';
  const paymentAttemptCol = 'PaymentAttempts';
  const discountCol = 'Discounts';

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

  // 續訂discount for yearly product
  const mockYearlyRenewalDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'yearly-renewal-discount-001',
    type: 'fixed_price',
    value: 1990, // 續訂時固定價格$1990
    priority: 10,
    startDate: new Date(2020, 0, 1), // 長期有效
    endDate: new Date(2030, 11, 31),
    applicableProducts: ['yearly-product-001'], // 只適用於yearly產品
    valid: true,
  };

  // 週年慶discount for yearly product - 高優先級
  const mockAnniversaryDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'anniversary-discount-001',
    type: 'fixed',
    value: 2000, // 固定折扣$2000
    priority: 20, // 高於續訂折扣的優先級
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // 當月第一天
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // 當月最後一天
    applicableProducts: ['yearly-product-001'], // 只適用於yearly產品
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
    agent = await AppHelper.getAgentWithMockers(getNewMockContainer()
      .set('IPaymentGateway', mockPaymentGateway)
      .set('ITaskQueue', mockTaskQueue));

    billingService = AppHelper.currentApp.get(IBillingServiceToken);

    await db.tryConnect();

    // Setup test data according to Background
    await Promise.all([
      db.getCollection(userCol).insertOne(mockUser),
      db.getCollection(productCol).insertOne(mockMonthlyProduct),
      db.getCollection(productCol).insertOne(mockYearlyProduct),
      db.getCollection(discountCol).insertOne(mockYearlyRenewalDiscount),
      db.getCollection(discountCol).insertOne(mockAnniversaryDiscount),
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
      describe('I want to 系統自動續訂年付產品並套用週年慶優惠', () => {
        describe('So that 我能以優惠價格繼續使用服務', () => {

          describe('Scenario: 第二次扣款成功（年付產品續訂，週年慶折扣$2000）', () => {
            let existingSubscription: ISubscriptionDocument;
            let billingResult: any;

            // Given 我已經訂閱年付產品（價格：每年 $2490）
            // And 訂閱狀態為 "active"
            // And 續訂次數為 0
            // And 已經進行過第一次扣款（扣款 $1000 成功，第一年優惠）
            // And 下次扣款日期已到（從訂閱開始日後 1 年）
            // And 目前是週年慶期間（2025/10/15）
            // And 我沒有使用任何優惠碼
            it('Given: 用戶已有年付訂閱且第一次扣款成功，下次扣款日期已到，目前在週年慶期間', async () => {
              // 創建現有訂閱記錄
              const startDate = new Date();
              startDate.setFullYear(startDate.getFullYear() - 1); // 訂閱開始日為1年前
              startDate.setDate(startDate.getDate() - 5); // 再減5天

              const nextBillingDate = new Date();
              nextBillingDate.setDate(nextBillingDate.getDate() - 5); // 下次扣款日期為5天前（已到期）

              existingSubscription = {
                _id: dbHelper.newObjectId(),
                subscriptionId: dbHelper.newObjectId().toHexString(),
                userId: mockUser.userId,
                productId: mockYearlyProduct.productId,
                status: 'active',
                cycleType: 'yearly',
                startDate,
                nextBillingDate,
                renewalCount: 1, // 已經續訂過1次，這是第二次扣款（第一次續訂）
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
                amount: 1000, // 第一次扣款金額（第一年優惠）
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
              expect(dbSubscription.renewalCount).toBe(1); // 已經進行過第一次續訂，這是第二次扣款
              expect(dbSubscription.productId).toBe(mockYearlyProduct.productId);

              // 驗證第一次扣款記錄存在
              const paymentAttempts = await db.getCollection(paymentAttemptCol).find({
                subscriptionId: existingSubscription.subscriptionId
              }).toArray();
              expect(paymentAttempts.length).toBe(1);
              expect(paymentAttempts[0].status).toBe('success');
              expect(paymentAttempts[0].amount).toBe(1000);
            });

            // When 系統進行第二次扣款
            it('When: 系統進行第二次扣款', async () => {
              // Mock payment gateway to succeed for second billing
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-yearly-second-anniversary-12345',
              });

              // Process second billing using real billing service
              billingResult = await billingService.processBilling(existingSubscription.subscriptionId);

              expect(billingResult.success).toBe(true);
              expect(billingResult.transactionId).toBe('txn-yearly-second-anniversary-12345');
            });

            // Then 應該從我的支付方式扣款 $490（原價 $2490 - 週年慶折扣 $2000）
            // And 扣款記錄應該被正確保存
            // And 訂閱的續訂次數應該更新為 1
            // And 下次扣款日期應該更新為從現在開始的 1 年後
            // And 訂閱狀態應該保持 "active"
            // And 系統應該記錄續訂成功的事件及套用的週年慶優惠
            it('Then: 驗證第二次扣款成功並套用週年慶折扣，收費$490', async () => {
              // 驗證扣款金額為490（原價2490 - 週年慶折扣2000）
              expect(mockPaymentGateway.charge).toHaveBeenCalledWith(
                expect.objectContaining({
                  amount: 490,
                  description: expect.stringContaining('Subscription billing'),
                })
              );

              // 驗證扣款記錄被保存
              const paymentAttempts = await db.getCollection(paymentAttemptCol).find({
                subscriptionId: existingSubscription.subscriptionId
              }).toArray();

              expect(paymentAttempts.length).toBe(2); // 第一次 + 第二次

              // 找到第二次扣款記錄
              const secondPayment = paymentAttempts.find((p: any) => p.status === 'success' && p.amount === 490 && p.attemptId !== paymentAttempts[0].attemptId);
              expect(secondPayment).toBeTruthy();

              // 驗證訂閱更新
              const updatedSubscription = await db.getCollection(subscriptionCol).findOne({
                subscriptionId: existingSubscription.subscriptionId
              });

              expect(updatedSubscription.renewalCount).toBe(2); // 續訂次數從1更新為2
              expect(updatedSubscription.status).toBe('active'); // 狀態保持active

              // 驗證下次扣款日期更新為一年後
              const nextBillingDate = new Date(updatedSubscription.nextBillingDate);
              const now = new Date();
              const expectedNextYear = new Date(now);
              expectedNextYear.setFullYear(now.getFullYear() + 1);

              expect(nextBillingDate.getFullYear()).toBe(expectedNextYear.getFullYear());
              expect(nextBillingDate.getMonth()).toBe(expectedNextYear.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextYear.getDate());
            });
          });
        });
      });
    });
  });
});