# 自動扣款機器人系統設計文件 - Phase 3: Full Release (V1)

## 概述
本系統設計文件基於 **Phase_3_FULL_spec.md**，詳細定義 **Auto Billing Bot V1** 的系統架構、模組設計、資料流程、測試驅動開發（TDD）策略、錯誤處理與效能優化。系統採用 NestJS 框架、TypeScript 語言、MongoDB 資料庫，遵循領域驅動設計（DDD）架構，並以 TDD 模式開發，確保高品質代碼與功能實現。所有變數命名採用駝峰式（camelCase），字首小寫。

**目標**：實現進階訂閱管理、優惠方案、多平台支付支援、API 文件化與後台管理功能，支援商業運營。  
**依賴**：POC 和 MVP 階段功能（參考 `poc-completion.md` 和 `mvp-completion.md`）。  
**技術棧**：延續 MVP，新增 Swagger、JWT 認證、Redis 快取。

---

## 系統架構

### DDD 分層架構
```
src/
├── domain/                 # 領域層：核心業務邏輯
│   ├── entities/          # 實體（subscription, product, coupon）
│   ├── value-objects/     # 值物件（billingCycle, paymentResult）
│   └── services/         # 領域服務（subscriptionService, paymentService）
├── infra/                 # 基礎設施層：外部系統整合
│   ├── services/         # 外部服務（paymentGatewayService）
│   ├── repositories/     # 儲存庫（subscriptionRepository, productRepository）
│   └── models/          # 資料模型（MongoDB 結構）
├── application/           # 應用層：業務流程與 API
│   ├── controllers/      # REST API 控制器
│   ├── services/        # 應用服務（subscriptionApplicationService）
│   └── jobs/           # 定時任務（dailyBillingJob, dataCleanupJob）
├── app-components/       # 應用組件
│   ├── appExceptionFilter.ts
│   ├── appTracerMiddleware.ts
│   ├── jwtAuthGuard.ts
│   └── appInitial.ts
└── main.ts              # 應用程式入口
```

### 技術棧
- **框架**：NestJS v10.0.0
- **語言**：TypeScript
- **資料庫**：MongoDB v6.16.0（原生驅動）
- **快取**：Redis（熱門查詢優化）
- **定時任務**：`@nestjs/schedule` v6.0.1
- **日誌**：`pino` v9.3.2
- **API 文件化**：`@nestjs/swagger`
- **認證**：`@nestjs/jwt`（JWT）
- **日期處理**：`date-fns` v4.1.0
- **資料驗證**：`class-validator` v0.14.1，`class-transformer` v0.5.1
- **測試**：Jest
- **加密**：AES-256（支付資訊）
- **部署**：Docker

---

## 模組設計

### 1. 優惠模組
- **功能**：管理優惠方案（百分比/固定金額折扣、檔期優惠）、優惠碼、續訂優惠。
- **核心類別**：
  - **實體**：`coupon`（優惠碼資料結構）
  - **值物件**：`discount`（折扣類型與值）
  - **領域服務**：`couponService`（優先級計算、優惠套用）
- **實現邏輯**：
  - 優惠優先級：檔期 > 續訂 > 基本，相同優先級選金額高者。
  - 優惠有效期：使用 `date-fns` 的 `isWithinInterval` 驗證。
  - 優惠碼驗證：檢查 `usedBy` 和 `usageLimit`。

### 2. 訂閱管理模組
- **功能**：管理訂閱創建、狀態流轉、方案轉換。
- **核心類別**：
  - **實體**：`subscription`（訂閱資料結構）
  - **值物件**：`billingCycle`（計費週期）
  - **領域服務**：`subscriptionService`（訂閱邏輯、狀態流轉）
  - **應用服務**：`subscriptionApplicationService`（API 業務流程）
- **實現邏輯**：
  - 狀態流轉：`pending → active → cancelled/gracePeriod`。
  - 方案轉換：僅支援短期轉長期（如月轉年），下一週期生效。

### 3. 支付模組
- **功能**：處理自動扣款、手動扣款、失敗重試。
- **核心類別**：
  - **值物件**：`paymentResult`（支付結果）
  - **領域服務**：`paymentService`（模擬支付，預留真實網關接口）
  - **定時任務**：`dailyBillingJob`（自動扣款）、`retryJob`（重試）
- **實現邏輯**：
  - 重試：每 1 小時重試 3 次，特定失敗（如卡片過期）直接進入 7 天寬限期。
  - 支付接口：支援模擬支付，預留 Stripe/PayPal 整合。

### 4. 日誌與追蹤模組
- **功能**：記錄操作日誌，支援人工介入追蹤。
- **核心類別**：
  - **實體**：`operationLog`（操作記錄）
  - **儲存庫**：`operationLogRepository`
- **實現邏輯**：
  - 記錄格式：`{ subscriptionId, operatorId, action, timestamp }`。
  - 使用 `pino` 結構化日誌。

### 5. API 模組
- **功能**：提供 RESTful API，支援訂閱、支付、方案轉換等操作。
- **核心類別**：
  - **控制器**：`subscriptionController`, `paymentController`
  - **中間件**：`jwtAuthGuard`（認證）
- **實現邏輯**：
  - API 前綴：`/client_service/api/v1/`。
  - 使用 Swagger 提供文件化。

---

## 資料流程

### 訂閱創建與扣款
1. **請求**：POST `/client_service/api/v1/subscriptions` → `subscriptionController`。
2. **驗證**：`class-validator` 檢查輸入（`userId`, `productId`, `startDate`）。
3. **業務邏輯**：
   - `subscriptionApplicationService` 調用 `subscriptionService` 創建訂閱。
   - `couponService` 驗證優惠碼並計算金額。
   - `paymentService` 執行首次扣款。
4. **持久化**：`subscriptionRepository` 儲存訂閱，`paymentHistoryRepository` 記錄扣款。
5. **日誌**：`operationLogRepository` 記錄創建操作。
6. **響應**：返回訂閱 ID 和狀態。

### 方案轉換
1. **請求**：PATCH `/client_service/api/v1/subscriptions/:subscriptionId/plan`。
2. **驗證**：檢查 `newBillingCycle` 是否為長期方案。
3. **業務邏輯**：
   - `subscriptionService` 更新 `billingCycle` 和 `nextBillingDate`。
   - `couponService` 調整優惠期數。
4. **持久化**：更新 `subscriptions` 集合。
5. **日誌**：記錄方案轉換操作。

### 扣款失敗與重試
1. **定時任務**：`dailyBillingJob` 檢查到期訂閱。
2. **支付**：`paymentService` 執行扣款，若失敗記錄 `reason` 和 `retryCount`。
3. **重試**：
   - 若 `reason` 為 `cardExpired` 或 `insufficientFunds`，進入寬限期。
   - 其他失敗，`retryJob` 每 1 小時重試，最多 3 次。
4. **寬限期**：3 次後更新 `subscription` 為 `gracePeriod`，設置 `gracePeriodEndDate`。

---

## TDD 策略

### TDD 流程
1. **撰寫測試**：先為每個功能點撰寫單元測試和整合測試。
2. **運行測試**：確認測試失敗（紅燈）。
3. **實現功能**：編寫最小化代碼使測試通過（綠燈）。
4. **重構**：優化代碼，確保測試仍通過。
5. **迭代**：重複上述步驟，直到完成所有功能。

### 測試案例設計

#### 1. 優惠模組
- **單元測試**（`couponService`）：
  - 測試優先級排序：檔期優惠 > 續訂優惠 > 基本優惠。
  - 測試相同優先級金額比較：選擇金額較高者。
  - 測試有效期驗證：無效優惠碼應拋出 `invalidCouponException`。
  - 測試用例：
    ```typescript
    describe('couponService', () => {
      it('should apply highest priority coupon', async () => {
        const coupons = [
          { priority: 2, type: 'fixed', value: 10 },
          { priority: 1, type: 'percentage', value: 20 }
        ];
        const result = await couponService.applyCoupon(subscription, coupons);
        expect(result.discount).toBe(10); // 優先級 2 優惠
      });
    });
    ```
- **整合測試**：
  - 測試 API 應用優惠碼：POST `/subscriptions` 帶 `couponCode` 應正確計算金額。

#### 2. 訂閱管理模組
- **單元測試**（`subscriptionService`）：
  - 測試狀態流轉：`pending → active`（首次扣款成功）。
  - 測試方案轉換：月轉年成功，年轉月拋出 `invalidPlanChangeException`。
  - 測試用例：
    ```typescript
    describe('subscriptionService', () => {
      it('should change plan from monthly to yearly', async () => {
        const subscription = { billingCycle: 'monthly', nextBillingDate: new Date() };
        const result = await subscriptionService.changePlan(subscription, 'yearly');
        expect(result.billingCycle).toBe('yearly');
      });
    });
    ```
- **整合測試**：
  - 測試 API 方案轉換：PATCH `/subscriptions/:id/plan` 應更新 `nextBillingDate`。

#### 3. 支付模組
- **單元測試**（`paymentService`）：
  - 測試重試邏輯：3 次失敗後進入寬限期。
  - 測試特定失敗原因：`cardExpired` 直接進入寬限期。
  - 測試用例：
    ```typescript
    describe('paymentService', () => {
      it('should skip retry for cardExpired', async () => {
        const result = await paymentService.processPayment(subscription, { reason: 'cardExpired' });
        expect(result.status).toBe('gracePeriod');
        expect(result.retryCount).toBe(0);
      });
    });
    ```
- **整合測試**：
  - 測試定時任務：模擬扣款失敗，驗證 `retryJob` 觸發。

#### 4. API 模組
- **整合測試**：
  - 測試所有 API 端點（創建、查詢、轉換、取消）。
  - 測試認證：無效 JWT 應返回 HTTP 401。
  - 測試錯誤處理：無效訂閱 ID 應返回 HTTP 404。

#### 5. 測試覆蓋率目標
- 單元測試覆蓋率：> 80%（MVP 為 45%）。
- 整合測試：涵蓋所有 API 端點和業務流程。
- 工具：Jest，輸出覆蓋率報告。

---

## 錯誤處理
- **全域異常過濾器**（`appExceptionFilter.ts`）：
  - 捕獲所有異常，返回標準化錯誤響應：
    ```json
    {
      "code": 400,
      "message": "Invalid coupon code"
    }
    ```
- **常見異常**：
  - `invalidCouponException`：無效優惠碼（code: 400）。
  - `invalidPlanChangeException`：不支援的方案轉換（code: 400）。
  - `unauthorizedException`：無效 JWT（code: 401）。
  - `notFoundException`：訂閱/產品不存在（code: 404）。

---

## 效能優化
- **資料庫查詢**：
  - 在 `subscriptions`, `products`, `coupons` 集合上建立索引（如 `userId`, `subscriptionId`）。
  - 使用 Redis 快取熱門查詢（如產品列表）。
- **並發處理**：
  - 系統支援 1000 個並發訂閱查詢，使用 NestJS 的非阻塞 I/O。
  - 定時任務（`dailyBillingJob`）分批處理訂閱，避免單次負載過高。
- **資料清理**：
  - 實現 `dataCleanupJob`，刪除超過 1 年的 `paymentHistory` 和 `operationLogs`。

---

## 資料結構
與規格書一致，包含以下 MongoDB 集合（變數命名為駝峰式）：
1. **subscriptions**：
   ```typescript
   {
     id: string;
     userId: string;
     productId: string;
     billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
     startDate: Date;
     nextBillingDate: Date;
     couponApplied: { code: string; periods: number };
     renewalCount: number;
     status: 'pending' | 'active' | 'cancelled' | 'gracePeriod';
     gracePeriodEndDate?: Date;
   }
   ```
2. **products**：
   ```typescript
   {
     id: string;
     name: string;
     price: number;
     billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
     renewalDiscount?: { type: 'percentage' | 'fixed'; value: number };
   }
   ```
3. **coupons**：
   ```typescript
   {
     id: string;
     code: string;
     type: 'percentage' | 'fixed';
     value: number;
     priority: number;
     validFrom: Date;
     validUntil: Date;
     usageLimit: number;
     usedBy: string[];
   }
   ```
4. **paymentHistory**：
   ```typescript
   {
     id: string;
     subscriptionId: string;
     amount: number;
     success: boolean;
     reason?: string;
     timestamp: Date;
     retryCount: number;
   }
   ```
5. **operationLogs**：
   ```typescript
   {
     id: string;
     subscriptionId: string;
     operatorId: string;
     action: string;
     timestamp: Date;
   }
   ```
6. **rules**：
   ```typescript
   {
     id: string;
     type: 'discount' | 'retry';
     config: object;
   }
   ```

---

## 部署與運行
- **環境要求**：
  - Node.js 18+
  - MongoDB 6+
  - Redis
  - Docker
- **環境變數**：
  ```env
  port=3001
  defaultMongoUri=mongodb://localhost:27017/ccrc_test1
  defaultMongoDbName=ccrc_test1
  jwtSecret=your_jwt_secret
  redisUrl=redis://localhost:6379
  ```
- **啟動方式**：
  ```bash
  yarn install
  yarn start:dev # 開發模式
  yarn build && yarn start:prod # 生產模式
  yarn test # 測試
  ```
- **Docker 部署**：
  - 使用 `Dockerfile` 構建，包含 NestJS 應用、MongoDB 和 Redis 連線。

---

## TDD 實施計劃
1. **前期準備**：
   - 配置 Jest 環境，包含覆蓋率報告。
   - 定義模擬資料（Mock）用於測試（如模擬 MongoDB 資料）。
2. **模組開發順序**：
   - 優惠模組 → 訂閱管理模組 → 支付模組 → API 模組 → 日誌與追蹤模組。
3. **迭代週期**：
   - 每個功能點 1-2 天完成（撰寫測試 → 實現 → 重構）。
   - 每週審查測試覆蓋率，確保 > 80%。
4. **持續整合**：
   - 使用 GitHub Actions 運行測試，確保提交前所有測試通過。
   - 部署前執行整合測試，驗證 API 與資料庫互動。

---

## 結語
本系統設計文件為 **Auto Billing Bot V1** 提供了詳細的實現藍圖，結合 TDD 模式確保高品質代碼。系統在 POC 和 MVP 基礎上擴展，支援進階優惠、方案轉換、扣款重試等功能，並預留未來擴展空間（如真實支付網關）。所有變數命名遵循駝峰式（camelCase），字首小寫，錯誤處理使用標準化響應格式 `{ "code": number, "message": string }`。開發團隊應遵循 TDD 流程，優先完成測試案例，確保功能穩定性與可維護性。

**開發團隊**：xxxhand  
**項目倉庫**：https://github.com/xxxhand/auto-billing-bot  
**設計文件日期**：2025年9月29日