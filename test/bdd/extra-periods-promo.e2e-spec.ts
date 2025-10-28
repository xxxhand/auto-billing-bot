import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from '../__helpers__/app.helper';
import { MongoHelper } from '../__helpers__/mongo.helper';
import { IDiscountDocument, IProductDocument, IPromoCodeDocument, IUserDocument } from '../__helpers__/shcema-interface.helper';
import { DEFAULT_MONGO } from '@myapp/common';

describe('BDD: 用戶使用優惠碼訂閱年付產品（含額外服務期數）', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('bdd_extra_periods_promo');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const ruleCol = 'Rules';
  const productCol = 'Products';
  const discountCol = 'Discounts';
  const promoCodeCol = 'PromoCodes';

  // Background: 系統前提設定
  const mockUser: IUserDocument = {
    _id: dbHelper.newObjectId(),
    userId: dbHelper.newObjectId(),
    tenantId: 'tenant-001',
    encryptedData: 'encrypted-data',
    valid: true,
  };

  const mockYearlyProduct: IProductDocument = {
    _id: dbHelper.newObjectId(),
    productId: 'yearly-product-extra',
    name: '年付產品（含額外期數）',
    price: 2490, // 每年 $2490
    cycleType: 'yearly',
    valid: true,
  };

  // First-time yearly subscription discount rule
  const firstTimeYearlyDiscountRule = {
    _id: dbHelper.newObjectId(),
    ruleId: 'first-time-yearly-discount',
    type: 'discount',
    conditions: {
      'product.cycleType': 'yearly',
      'subscription.isFirstTimeSubscription': true,
      currentDate: { operator: 'lte', value: '2026-12-31' },
    },
    actions: {
      discount: {
        type: 'fixed',
        value: 1490, // 2490 - 1000 = 1490 discount
      },
    },
    valid: true,
  };

  // Renewal discount rule for yearly product (second billing onwards)
  const renewalYearlyDiscountRule = {
    _id: dbHelper.newObjectId(),
    ruleId: 'renewal-yearly-discount',
    type: 'discount',
    conditions: {
      'product.cycleType': 'yearly',
      'subscription.renewalCount': { operator: 'gte', value: 0 }
    },
    actions: {
      discount: {
        type: 'fixed',
        value: 500 // 2490 - 1990 = 500 discount
      }
    },
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
    applicableProducts: ['yearly-product-extra'], // 只適用於yearly產品
    valid: true,
  };

  // Discount with extra periods
  const mockExtraPeriodsDiscount: IDiscountDocument = {
    _id: dbHelper.newObjectId(),
    discountId: 'extra-periods-discount-001',
    type: 'fixed',
    value: 0, // No price reduction
    priority: 5,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2026-12-31'),
    applicableProducts: ['yearly-product-extra'],
    discountPeriods: 1,
    extraPeriods: 3, // 3 extra months
    valid: true,
  };

  // Promo code for extra periods
  const mockExtraPeriodsPromoCode: IPromoCodeDocument = {
    _id: dbHelper.newObjectId(),
    code: 'EXTRA3MONTHS',
    discountId: 'extra-periods-discount-001',
    minimumAmount: 1000,
    usageLimit: 50,
    usedCount: 0,
    valid: true,
    isSingleUse: false,
    applicableProducts: ['yearly-product-extra'],
  };

  // mock payment gateway
  const mockPaymentGateway = {
    charge: jest.fn(),
  };

  beforeAll(async () => {
    const mockContainer = getNewMockContainer().set('IPaymentGateway', mockPaymentGateway).set(DEFAULT_MONGO, dbHelper.mongo);
    agent = await AppHelper.getAgentWithMockers(mockContainer);
    await db.tryConnect();

    // Setup test data
    await Promise.all([
      db.getCollection(userCol).insertOne(mockUser),
      db.getCollection(productCol).insertOne(mockYearlyProduct),
      db.getCollection(discountCol).insertMany([mockYearlyRenewalDiscount, mockExtraPeriodsDiscount]),
      db.getCollection(promoCodeCol).insertOne(mockExtraPeriodsPromoCode),
      db.getCollection(ruleCol).insertMany([firstTimeYearlyDiscountRule, renewalYearlyDiscountRule]),
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
      describe('I want to 訂閱年付產品（使用含額外服務期數的優惠碼）', () => {
        describe('So that 我可以獲得延長的服務時間', () => {
          describe('Scenario: 用戶使用優惠碼訂閱年付產品（含額外服務期數）', () => {
            let subscriptionResponse: any;

            it('Given: 系統設定正確且用戶無訂閱記錄', async () => {
              // 驗證用戶存在
              const dbUser = await db.getCollection(userCol).findOne({ userId: mockUser.userId });
              expect(dbUser).toBeTruthy();

              // 驗證年付產品存在
              const dbYearlyProduct = await db.getCollection(productCol).findOne({ productId: mockYearlyProduct.productId });
              expect(dbYearlyProduct).toBeTruthy();
              expect(dbYearlyProduct.price).toBe(2490);
              expect(dbYearlyProduct.cycleType).toBe('yearly');

              // 驗證折扣存在且包含額外期數
              const dbDiscount = await db.getCollection(discountCol).findOne({ discountId: mockExtraPeriodsDiscount.discountId });
              expect(dbDiscount).toBeTruthy();
              expect(dbDiscount.extraPeriods).toBe(3);

              // 驗證優惠碼存在
              const dbPromoCode = await db.getCollection(promoCodeCol).findOne({ code: mockExtraPeriodsPromoCode.code });
              expect(dbPromoCode).toBeTruthy();
            });

            it('When: 用戶選擇年付產品並使用優惠碼 "EXTRA3MONTHS"', async () => {
              // Mock payment gateway to succeed
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-extra-12345',
              });

              const subscriptionRequest = {
                userId: mockUser.userId.toHexString(),
                productId: mockYearlyProduct.productId,
                promoCode: 'EXTRA3MONTHS',
              };

              const response = await agent.post(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`).send(subscriptionRequest);

              expect(response.status).toBe(201);
              expect(response.body.code).toBe(0);

              subscriptionResponse = response.body.result;
            });

            it('Then: 訂閱記錄應包含 extraPeriods: 3', async () => {
              expect(subscriptionResponse).toBeTruthy();
              expect(subscriptionResponse.subscriptionId).toBeTruthy();

              // 驗證資料庫中的訂閱記錄包含額外期數
              const dbSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId,
              });
              expect(dbSubscription).toBeTruthy();
              expect(dbSubscription.extraPeriods).toBe(3);
              expect(dbSubscription.status).toBe('active');
            });

            it('And: 下次扣款日期應為原始週期結束後加上額外期數（3個月）', async () => {
              const dbSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId,
              });

              const startDate = new Date(dbSubscription.startDate);
              const nextBillingDate = new Date(dbSubscription.nextBillingDate);

              // 下次扣款日期應該是開始日期 + 1年 + 3個月（考慮額外期數）
              const expectedNextBilling = new Date(startDate);
              expectedNextBilling.setFullYear(startDate.getFullYear() + 1);
              expectedNextBilling.setMonth(startDate.getMonth() + 3);

              expect(nextBillingDate.getFullYear()).toBe(expectedNextBilling.getFullYear());
              expect(nextBillingDate.getMonth()).toBe(expectedNextBilling.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextBilling.getDate());
            });

            it('And: 系統應繼續自動續訂（extraPeriods僅用於參考）', async () => {
              // 驗證訂閱狀態為active，系統會繼續自動續訂
              const dbSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId,
              });
              expect(dbSubscription.status).toBe('active');
              expect(dbSubscription.renewalCount).toBe(0); // After successful initial billing during subscription creation

              // extraPeriods 不會阻止續訂，系統會繼續扣款
              // 這是通過移除 shouldExpire() 檢查來實現的
            });

            it('When: 系統進行第二次扣款（第15個月後）', async () => {
              // 修改subscription的nextBillingDate到過去，模擬15個月已過
              const pastDate = new Date();
              pastDate.setDate(pastDate.getDate() - 1); // 設為昨天

              await db.getCollection('Subscriptions').updateOne({ subscriptionId: subscriptionResponse.subscriptionId }, { $set: { nextBillingDate: pastDate } }); // renewalCount is already 0 from initial billing

              // Mock payment gateway for renewal
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-renewal-12345',
              });

              // 獲取billing service並處理續訂
              const billingService = AppHelper.currentApp.get('IBillingService');

              const billingResult = await billingService.processBilling(subscriptionResponse.subscriptionId);
              expect(billingResult.success).toBe(true);
            });

            it('Then: 第二次扣款應以續訂價格$1990成功', async () => {
              // Mock payment gateway for verification
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-renewal-12345',
              });

              // 驗證扣款記錄
              const paymentAttempts = await db
                .getCollection('PaymentAttempts')
                .find({
                  subscriptionId: subscriptionResponse.subscriptionId,
                })
                .toArray();

              console.log(
                'Payment attempts:',
                paymentAttempts.map((p) => ({ amount: p.amount, status: p.status })),
              );

              expect(paymentAttempts.length).toBe(2); // 第一次 + 第二次

              const renewalPayment = paymentAttempts.find((p: any) => p.amount === 1990);
              expect(renewalPayment).toBeTruthy();
              expect(renewalPayment.status).toBe('success');

              // 驗證訂閱更新
              const updatedSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId,
              });
              expect(updatedSubscription.renewalCount).toBe(1);
              expect(updatedSubscription.status).toBe('active');

              // 下次扣款日期應該更新為1年後
              const nextBillingDate = new Date(updatedSubscription.nextBillingDate);
              const currentDate = new Date();
              const expectedNextYear = new Date(currentDate);
              expectedNextYear.setFullYear(currentDate.getFullYear() + 1);
              expectedNextYear.setMonth(expectedNextYear.getMonth() + 3); // 考慮extraPeriods

              // 由於測試運行時間可能不同，只檢查月份和日期
              expect(nextBillingDate.getMonth()).toBe(expectedNextYear.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextYear.getDate());
            });
          });
        });
      });
    });
  });
});
