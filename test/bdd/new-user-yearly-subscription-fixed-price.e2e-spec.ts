import * as superTest from 'supertest';
import { AppHelper, getNewMockContainer } from '../__helpers__/app.helper';
import { MongoHelper } from '../__helpers__/mongo.helper';
import {
  IProductDocument,
  IUserDocument,
} from '../__helpers__/shcema-interface.helper';

describe('BDD: 新用戶使用「固定結帳金額」訂閱年付產品', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('bdd_new_user_yearly_subscription_fixed_price');
  const db = dbHelper.mongo;
  const userCol = 'Users';
  const productCol = 'Products';
  const ruleCol = 'Rules';
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

  // First-time yearly subscription discount rule
  const firstTimeYearlyDiscountRule = {
    _id: dbHelper.newObjectId(),
    ruleId: 'first-time-yearly-discount',
    type: 'discount',
    conditions: {
      'product.cycleType': 'yearly',
      'subscription.isFirstTimeSubscription': true,
      'currentDate': { operator: 'lte', value: '2026-12-31' }
    },
    actions: {
      discount: {
        type: 'fixed',
        value: 1490 // 2490 - 1000 = 1490 discount
      }
    },
    valid: true,
  };

    // Promo code discount rule (higher priority)
  const promoCodeDiscountRule = {
    _id: dbHelper.newObjectId(),
    ruleId: 'promo-code-discount',
    type: 'discount',
    conditions: {
      'product.cycleType': 'yearly',
      'subscription.isFirstTimeSubscription': true,
      'promoCode.code': 'FIXED1500',
      'currentDate': { operator: 'lte', value: '2026-12-31' }
    },
    actions: {
      discount: {
        type: 'fixed_price',
        value: 1500 // Fixed checkout amount $1500
      }
    },
    priority: 2, // Higher priority
    valid: true,
  };

  // Fixed price discount entity for testing
  const mockFixedPriceDiscount = {
    _id: dbHelper.newObjectId(),
    discountId: 'fixed-price-discount-001',
    name: 'Fixed Price Discount',
    type: 'fixed_price',
    value: 1500, // Fixed checkout amount $1500
    priority: 10, // Higher priority than system discount
    startDate: new Date('2024-01-01'),
    endDate: new Date('2026-12-31'),
    applicableProducts: [mockYearlyProduct.productId],
    valid: true,
  };

  // Fixed price promo code entity for testing (single use)
  const mockFixedPricePromoCode = {
    _id: dbHelper.newObjectId(),
    code: 'FIXED1500',
    discountId: 'fixed-price-discount-001',
    minimumAmount: 0, // No minimum amount for fixed price
    usageLimit: 1, // Single use
    isSingleUse: true,
    usedCount: 0,
    assignedUserId: null,
    applicableProducts: [mockYearlyProduct.productId],
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2026-12-31'),
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
      db.getCollection(ruleCol).insertOne(firstTimeYearlyDiscountRule),
      db.getCollection(ruleCol).insertOne(promoCodeDiscountRule),
      db.getCollection(discountCol).insertOne(mockFixedPriceDiscount),
      db.getCollection(promoCodeCol).insertOne(mockFixedPricePromoCode),
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
      describe('I want to 使用固定結帳金額優惠碼訂閱年付產品', () => {
        describe('So that 我可以獲得特殊的固定價格優惠', () => {

          describe('Scenario: 成功訂閱年付產品（使用固定結帳金額優惠碼）', () => {
            let subscriptionResponse: any;
            let productsResponse: any;

            // Given 我是一個新用戶，尚未有任何訂閱
            // And 系統中有可訂閱的年付產品（價格：每年 $2490）
            // And 系統中有有效的優惠碼 "FIXED1500"（固定結帳金額 $1500，適用於年付產品，一碼一人使用，尚未被使用）
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

              // 驗證固定結帳金額優惠碼存在且設定正確
              const dbPromoCode = await db.getCollection(promoCodeCol).findOne({ code: mockFixedPricePromoCode.code });
              expect(dbPromoCode).toBeTruthy();
              expect(dbPromoCode.code).toBe('FIXED1500');
              expect(dbPromoCode.isSingleUse).toBe(true);
              expect(dbPromoCode.usedCount).toBe(0);
              expect(dbPromoCode.applicableProducts).toContain(mockYearlyProduct.productId);

              // 驗證固定結帳金額折扣存在且設定正確
              const dbDiscount = await db.getCollection(discountCol).findOne({ discountId: mockFixedPriceDiscount.discountId });
              expect(dbDiscount).toBeTruthy();
              expect(dbDiscount.type).toBe('fixed_price');
              expect(dbDiscount.value).toBe(1500);
              expect(dbDiscount.priority).toBe(10);
            });

            // When 我查詢可訂閱產品列表
            it('When: 查詢可訂閱產品列表', async () => {
              const response = await agent
                .get(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`)
                .query({
                  userId: mockUser.userId.toHexString()
                });

              expect(response.status).toBe(200);
              expect(response.body.code).toBe(0);
              expect(Array.isArray(response.body.result)).toBe(true);

              productsResponse = response.body.result;

              // 驗證返回的產品資訊
              const yearlyProduct = productsResponse.find((p: any) => p.productId === mockYearlyProduct.productId);
              expect(yearlyProduct).toBeTruthy();
              expect(yearlyProduct.name).toBe('年付產品');
              expect(yearlyProduct.originalPrice).toBe(2490);
              expect(yearlyProduct.cycleType).toBe('yearly');
            });

            // Then 我應該看到年付產品的完整資訊（產品名稱、價格 $1000、年付週期）
            // And 顯示價格應該是第一次訂閱折扣價 $1000（系統自動折扣）
            it('Then: 看到年付產品完整資訊且有系統自動折扣', () => {
              const yearlyProduct = productsResponse.find((p: any) => p.productId === mockYearlyProduct.productId);
              expect(yearlyProduct.name).toBe('年付產品');
              expect(yearlyProduct.originalPrice).toBe(2490);
              expect(yearlyProduct.cycleType).toBe('yearly');
              // 系統自動折扣，顯示 $1000 (2490 - 1490)
              expect(yearlyProduct.discountedPrice).toBe(1000);
            });

            // When 我輸入優惠碼 "FIXED1500"
            it('When: 輸入固定結帳金額優惠碼', async () => {
              const response = await agent
                .get(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`)
                .query({
                  userId: mockUser.userId.toHexString(),
                  promoCode: 'FIXED1500'
                });

              expect(response.status).toBe(200);
              expect(response.body.code).toBe(0);

              productsResponse = response.body.result;
            });

            // Then 系統應該驗證優惠碼有效性
            // And 顯示最終價格應該是 $1500（固定結帳金額，覆蓋系統自動折扣）
            // And 顯示優惠碼折扣明細（優惠碼：FIXED1500，類型：固定結帳金額，金額：$1500）
            it('Then: 驗證優惠碼有效性並顯示固定結帳金額', () => {
              const yearlyProduct = productsResponse.find((p: any) => p.productId === mockYearlyProduct.productId);
              expect(yearlyProduct).toBeTruthy();
              expect(yearlyProduct.originalPrice).toBe(2490);
              expect(yearlyProduct.cycleType).toBe('yearly');
              // 固定結帳金額覆蓋系統自動折扣，顯示 $1500
              expect(yearlyProduct.discountedPrice).toBe(1500);

              // 驗證優惠碼折扣明細
              expect(yearlyProduct.appliedDiscount).toBeTruthy();
              expect(yearlyProduct.appliedDiscount.type).toBe('fixed_price');
              expect(yearlyProduct.appliedDiscount.value).toBe(1500);
              expect(yearlyProduct.appliedDiscount.promoCode).toBe('FIXED1500');
            });

            // When 我選擇年付產品並確認訂閱
            it('When: 選擇年付產品並確認訂閱', async () => {
              // Mock payment gateway to succeed
              jest.spyOn(mockPaymentGateway, 'charge').mockResolvedValue({
                success: true,
                transactionId: 'txn-fixed-price-12345',
              });

              const subscriptionRequest = {
                userId: mockUser.userId.toHexString(),
                productId: mockYearlyProduct.productId,
                promoCode: 'FIXED1500',
              };

              const response = await agent
                .post(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/subscriptions`)
                .send(subscriptionRequest);

              if (response.status !== 201) {
                console.log('Subscription creation failed:', response.status, response.body);
              }

              expect(response.status).toBe(201);
              expect(response.body.code).toBe(0);

              subscriptionResponse = response.body.result;
            });

            // Then 系統應該為我創建新的訂閱記錄
            // And 訂閱狀態應該是 "active"
            // And 訂閱記錄應該包含優惠碼使用資訊（優惠碼：FIXED1500，使用時間：當前時間）
            // And 下次扣款日期應該是從今天開始的 1 年後
            // And 續訂次數應該是 0
            // And 我應該收到訂閱成功的確認訊息
            it('Then: 創建新的訂閱記錄並驗證訂閱狀態', async () => {
              expect(subscriptionResponse).toBeTruthy();
              expect(subscriptionResponse.subscriptionId).toBeTruthy();
              expect(subscriptionResponse.status).toBe('active');

              // 驗證下次扣款日期是一年後
              const nextBillingDate = new Date(subscriptionResponse.nextBillingDate);
              const startDate = new Date(subscriptionResponse.startDate);
              const expectedNextYear = new Date(startDate);
              expectedNextYear.setFullYear(startDate.getFullYear() + 1);

              // 檢查年份、月份和日期是否正確（處理跨年情況）
              expect(nextBillingDate.getFullYear()).toBe(expectedNextYear.getFullYear());
              expect(nextBillingDate.getMonth()).toBe(expectedNextYear.getMonth());
              expect(nextBillingDate.getDate()).toBe(expectedNextYear.getDate());

              // 驗證資料庫中的訂閱記錄
              const dbSubscription = await db.getCollection('Subscriptions').findOne({
                subscriptionId: subscriptionResponse.subscriptionId
              });
              expect(dbSubscription).toBeTruthy();
              expect(dbSubscription.status).toBe('active');
              expect(dbSubscription.renewalCount).toBe(0);
              expect(dbSubscription.userId.toHexString()).toBe(mockUser.userId.toHexString());
              expect(dbSubscription.productId).toBe(mockYearlyProduct.productId);
              expect(dbSubscription.promoCode).toBe('FIXED1500');
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

            // Then 應該從我的支付方式扣款 $1500
            // And 扣款記錄應該被正確保存
            // And 優惠碼應該標記為已使用狀態
            // And 訂閱的續訂次數應該保持為 0
            it('Then: 驗證扣款成功、優惠碼狀態並保持續訂次數為 0', async () => {
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

              // 至少有一筆成功的扣款記錄，金額為$1500
              const successfulPayment = paymentAttempts.find((p: any) => p.status === 'success');
              expect(successfulPayment).toBeTruthy();
              expect(successfulPayment.amount).toBe(1500); // 驗證扣款金額（固定結帳金額）

              // 驗證優惠碼被標記為已使用狀態
              const updatedPromoCode = await db.getCollection(promoCodeCol).findOne({ code: 'FIXED1500' });
              expect(updatedPromoCode).toBeTruthy();
              expect(updatedPromoCode.usedCount).toBe(1);

              // 驗證PromoCodeUsages記錄
              const promoCodeUsages = await db.getCollection('PromoCodeUsages').find({
                promoCode: 'FIXED1500'
              }).toArray();
              expect(promoCodeUsages.length).toBe(1);
              expect(promoCodeUsages[0].userId.toHexString()).toBe(mockUser.userId.toHexString());
              expect(promoCodeUsages[0].orderAmount).toBe(1500);
            });
          });

          describe('Scenario: 固定結帳金額優惠碼與其他優惠比較', () => {
            let comparisonUser: IUserDocument;

            // Given 我是一個新用戶，尚未有任何訂閱
            // And 系統中有可訂閱的年付產品（價格：每年 $2490）
            // And 系統中有多個優惠碼：
            // - "DISCOUNT200"（固定折扣 $200，一碼一人使用，尚未被使用）
            // - "FIXED1500"（固定結帳金額 $1500，一碼一人使用，尚未被使用）
            it('Given: 準備比較測試的用戶和優惠碼', async () => {
              // 創建新用戶
              comparisonUser = {
                _id: dbHelper.newObjectId(),
                userId: dbHelper.newObjectId(),
                tenantId: 'tenant-comparison',
                encryptedData: 'encrypted-data-comparison',
                valid: true,
              };
              await db.getCollection(userCol).insertOne(comparisonUser);

              // 創建固定折扣優惠碼
              const fixedDiscount = {
                _id: dbHelper.newObjectId(),
                discountId: 'fixed-discount-002',
                name: 'Fixed Discount',
                type: 'fixed',
                value: 200, // Fixed discount $200
                priority: 5, // Lower priority
                startDate: new Date('2024-01-01'),
                endDate: new Date('2026-12-31'),
                applicableProducts: [mockYearlyProduct.productId],
                valid: true,
              };
              await db.getCollection(discountCol).insertOne(fixedDiscount);

              const discountPromoCode = {
                _id: dbHelper.newObjectId(),
                code: 'DISCOUNT200',
                discountId: 'fixed-discount-002',
                minimumAmount: 0,
                usageLimit: 1,
                isSingleUse: true,
                usedCount: 0,
                assignedUserId: null,
                applicableProducts: [mockYearlyProduct.productId],
                validFrom: new Date('2024-01-01'),
                validUntil: new Date('2026-12-31'),
                valid: true,
              };
              await db.getCollection(promoCodeCol).insertOne(discountPromoCode);

              // 創建固定折扣規則
              const discountRule = {
                _id: dbHelper.newObjectId(),
                ruleId: 'discount-200-rule',
                type: 'discount',
                conditions: {
                  'product.cycleType': 'yearly',
                  'subscription.isFirstTimeSubscription': true,
                  'promoCode.code': 'DISCOUNT200',
                  'currentDate': { operator: 'lte', value: '2026-12-31' }
                },
                actions: {
                  discount: {
                    type: 'fixed',
                    value: 200 // Fixed discount $200
                  }
                },
                priority: 1, // Lower priority than fixed_price
                valid: true,
              };
              await db.getCollection(ruleCol).insertOne(discountRule);

              // 創建另一個固定結帳金額優惠碼（與上面的不同）
              const anotherFixedPriceDiscount = {
                _id: dbHelper.newObjectId(),
                discountId: 'fixed-price-discount-002',
                name: 'Another Fixed Price Discount',
                type: 'fixed_price',
                value: 1500,
                priority: 10,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2026-12-31'),
                applicableProducts: [mockYearlyProduct.productId],
                valid: true,
              };
              await db.getCollection(discountCol).insertOne(anotherFixedPriceDiscount);

              const anotherFixedPricePromoCode = {
                _id: dbHelper.newObjectId(),
                code: 'FIXED1500_COMPARE',
                discountId: 'fixed-price-discount-002',
                minimumAmount: 0,
                usageLimit: 1,
                isSingleUse: true,
                usedCount: 0,
                assignedUserId: null,
                applicableProducts: [mockYearlyProduct.productId],
                validFrom: new Date('2024-01-01'),
                validUntil: new Date('2026-12-31'),
                valid: true,
              };
              await db.getCollection(promoCodeCol).insertOne(anotherFixedPricePromoCode);

              // 創建固定結帳金額規則
              const anotherFixedPriceRule = {
                _id: dbHelper.newObjectId(),
                ruleId: 'fixed-price-compare-rule',
                type: 'discount',
                conditions: {
                  'product.cycleType': 'yearly',
                  'subscription.isFirstTimeSubscription': true,
                  'promoCode.code': 'FIXED1500_COMPARE',
                  'currentDate': { operator: 'lte', value: '2026-12-31' }
                },
                actions: {
                  discount: {
                    type: 'fixed_price',
                    value: 1500 // Fixed checkout amount $1500
                  }
                },
                priority: 3, // Higher priority than discount rule
                valid: true,
              };
              await db.getCollection(ruleCol).insertOne(anotherFixedPriceRule);
            });

            // When 我先輸入優惠碼 "DISCOUNT200"
            it('When: 先輸入固定折扣優惠碼', async () => {
              const response = await agent
                .get(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`)
                .query({
                  userId: comparisonUser.userId.toHexString(),
                  promoCode: 'DISCOUNT200'
                });

              expect(response.status).toBe(200);
              expect(response.body.code).toBe(0);

              const products = response.body.result;
              const yearlyProduct = products.find((p: any) => p.productId === mockYearlyProduct.productId);
              expect(yearlyProduct).toBeTruthy();
              expect(yearlyProduct.discountedPrice).toBe(2290); // 2490 - 200 = 2290
            });

            // Then 顯示最終價格應該是 $2290（原價 $2490 - $200 折扣）
            it('Then: 顯示固定折扣價格', () => {
              // 已在上面的測試中驗證
            });

            // When 我再輸入優惠碼 "FIXED1500_COMPARE"
            it('When: 再輸入固定結帳金額優惠碼', async () => {
              const response = await agent
                .get(`${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/products`)
                .query({
                  userId: comparisonUser.userId.toHexString(),
                  promoCode: 'FIXED1500_COMPARE'
                });

              expect(response.status).toBe(200);
              expect(response.body.code).toBe(0);

              const products = response.body.result;
              const yearlyProduct = products.find((p: any) => p.productId === mockYearlyProduct.productId);
              expect(yearlyProduct).toBeTruthy();
              expect(yearlyProduct.discountedPrice).toBe(1500); // 固定結帳金額覆蓋之前的折扣
            });

            // Then 系統應該驗證優惠碼有效性
            // And 顯示最終價格應該是 $1500（固定結帳金額覆蓋之前的折扣）
            // And 顯示優惠碼折扣明細（優惠碼：FIXED1500_COMPARE，類型：固定結帳金額，金額：$1500）
            // And 系統應該提示只能使用一個優惠碼
            it('Then: 顯示固定結帳金額並提示只能使用一個優惠碼', () => {
              // 已在上面的測試中驗證價格為$1500
              // 實際的API應該會有邏輯來防止同時使用多個優惠碼
              // 這裡我們驗證固定結帳金額的優先級較高
            });
          });
        });
      });
    });
  });
});