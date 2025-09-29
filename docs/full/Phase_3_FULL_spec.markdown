# 自動扣款機器人階段規格書 - Phase 3: Full Release (V1)

## 概述
本規格書詳細定義 **Auto Billing Bot V1** 的功能實現、技術規範、API 設計和資料結構，基於 **Phase_3_FULL_requirements_v1.md** 需求，實現進階訂閱管理、優惠方案、多平台支付支援、文件化和後台管理功能。系統採用 NestJS 框架、TypeScript 語言、MongoDB 資料庫，並遵循領域驅動設計（DDD）架構。

**依賴**：POC 和 MVP 階段功能（參考 `poc-completion.md` 和 `mvp-completion.md`）。  
**目標**：提供完整的 V1 產品，支援商業運營所需的進階功能。  
**技術棧**：延續 MVP 技術棧，新增 Swagger 文件化和 JWT 認證。

---

## 系統架構

### DDD 分層架構
```
src/
├── domain/                 # 領域層
│   ├── entities/          # 實體
│   ├── value-objects/     # 值物件
│   └── services/         # 領域服務
├── infra/                 # 基礎設施層
│   ├── services/         # 外部服務整合
│   ├── repositories/     # 儲存庫
│   └── models/          # 資料模型
├── application/           # 應用層
│   ├── controllers/      # REST API 控制器
│   ├── services/        # 應用服務
│   └── jobs/           # 定時任務
├── app-components/       # 應用組件
│   ├── app-exception.filter.ts
│   ├── app-tracer.middleware.ts
│   ├── app.initial.ts
│   └── jwt-auth.guard.ts
└── main.ts              # 應用程式入口
```

### 技術棧
- **框架**：NestJS v10.0.0
- **語言**：TypeScript
- **資料庫**：MongoDB v6.16.0（原生驅動）
- **定時任務**：`@nestjs/schedule` v6.0.1
- **日誌**：`pino` v9.3.2
- **API 文件化**：Swagger（`@nestjs/swagger`）
- **認證**：JWT（`@nestjs/jwt`）
- **日期處理**：`date-fns` v4.1.0
- **資料驗證**：`class-validator` v0.14.1，`class-transformer` v0.5.1
- **測試**：Jest
- **部署**：Docker
- **加密**：AES-256（支付資訊加密）

---

## 功能規格

### 1. 優惠與方案

#### 1.1 優惠方案設計
- **功能**：支援固定金額折扣和檔期優惠，優先級：檔期 > 續訂 > 基本。
- **實現**：
  - 優惠儲存於 MongoDB 的 `coupons` 集合，包含欄位：
    ```typescript
    interface Coupon {
      _id: string;
      code: string; // 優惠碼
      type: 'percentage' | 'fixed'; // 折扣類型
      value: number; // 折扣值（如 10 表示 10% 或 $10）
      priority: number; // 優先級（越高越優先）
      valid_from: Date; // 開始時間
      valid_until: Date; // 結束時間
      usage_limit: number; // 使用次數上限
      used_by: string[]; // 已使用用戶 ID 列表
    }
    ```
  - 使用 `date-fns` 驗證優惠有效期（`isWithinInterval`）。
- **多重優惠疊加**：
  - 按優先級排序，選擇最高優先級優惠。
  - 若優先級相同，計算最終金額（原價 - 折扣），選擇金額較高者。
  - 實現於 `SubscriptionService` 的 `applyCoupon` 方法。
- **百分比與固定金額折扣**：
  - 百分比折扣：`finalPrice = originalPrice * (1 - value/100)`。
  - 固定金額折扣：`finalPrice = originalPrice - value`。
  - 與 MVP 的百分比折扣邏輯相容。

#### 1.2 優惠碼機制
- **功能**：一碼一人，設定次數上限。
- **實現**：
  - 驗證邏輯：檢查 `used_by` 陣列是否包含當前用戶 ID，檢查 `usage_limit` 是否已達上限。
  - 儲存於 `Coupon` 實體，更新 `used_by` 欄位。
  - 異常處理：若優惠碼無效，返回 HTTP 400 錯誤（`InvalidCouponException`）。

#### 1.3 續訂優惠
- **功能**：第二次及以上續訂提供折扣，與檔期/優惠碼比較優先級。
- **實現**：
  - 訂閱實體 (`Subscription`) 增加 `renewal_count` 欄位，記錄續訂次數。
  - 若 `renewal_count >= 1`，檢查產品設定的續訂優惠（儲存於 `Product` 實體的 `renewal_discount`）。
  - 優先級比較邏輯與優惠方案一致。

#### 1.4 方案轉換時優惠處理
- **功能**：下期原價計費，套用優惠碼，續訂優惠從第二次適用。
- **實現**：
  - 優惠期數儲存於 `Subscription` 的 `coupon_applied` 欄位，轉換時更新為新方案的週期數。
  - 計算下期金額時，優先檢查檔期優惠，後檢查續訂優惠或優惠碼。

### 2. 方案轉換
- **功能**：支援短期轉長期（如月轉年、季轉年），不支援長期轉短期，不退款，新方案下一週期生效。
- **實現**：
  - 訂閱實體 (`Subscription`) 包含：
    ```typescript
    interface Subscription {
      _id: string;
      userId: string;
      productId: string;
      billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      startDate: Date;
      nextBillingDate: Date;
      coupon_applied: { code: string; periods: number };
      renewal_count: number;
      status: 'pending' | 'active' | 'cancelled';
    }
    ```
  - 轉換邏輯：
    - 驗證目標方案是否為長期方案（`yearly` > `quarterly` > `monthly` > `weekly`）。
    - 更新 `billingCycle` 和 `nextBillingDate`，使用 `date-fns` 計算（`addMonths`, `addYears` 等）。
    - 不退款：當前週期繼續按原方案執行。
    - 下一週期生效：更新 `nextBillingDate` 為新方案的計費週期。
  - API：`PATCH /client_service/api/v1/subscriptions/:subscriptionId/plan`。
  - 異常處理：若轉換為長期轉短期，返回 HTTP 400 錯誤（`InvalidPlanChangeException`）。

### 3. 退款管理
- **功能**：暫時忽略，沿用 MVP 的退款功能。
- **實現**：
  - 保留 MVP 的退款邏輯（`SubscriptionController` 的退款 API）。
  - 後續進階階段再擴展試用期退款等功能。

### 4. 扣款失敗與重試
- **功能**：
  - 重試間隔 1 小時，最大 3 次，3 次後進入 7 天寬限期。
  - 卡片過期、餘額不足不重試，直接進入寬限期。
- **實現**：
  - 使用 `@nestjs/schedule` 實現定時任務 (`DailyBillingJob`)，新增 1 小時重試任務。
  - 支付結果值物件 (`PaymentResult`) 包含：
    ```typescript
    interface PaymentResult {
      success: boolean;
      reason?: 'insufficient_funds' | 'card_expired' | 'card_declined' | 'network_error';
      retryCount: number;
    }
    ```
  - 重試邏輯：
    - 若 `reason` 為 `card_expired` 或 `insufficient_funds`，直接進入寬限期。
    - 其他失敗原因（如 `network_error`），每 1 小時重試，最多 3 次。
    - 3 次後更新 `Subscription` 狀態為 `grace_period`，設置 `gracePeriodEndDate = currentDate + 7 days`。
  - 寬限期管理：若寬限期內無成功扣款，訂閱狀態變為 `cancelled`。

### 5. 狀態管理與資料紀錄
- **功能**：完整訂閱狀態流轉，支援人工介入記錄。
- **實現**：
  - 訂閱狀態流轉：
    ```
    pending → active (首次扣款成功)
    pending → cancelled (用戶取消)
    active → cancelled (用戶取消)
    active → grace_period (扣款失敗 3 次)
    grace_period → active (寬限期內扣款成功)
    grace_period → cancelled (寬限期結束)
    ```
  - 人工介入記錄儲存於 `operation_logs` 集合：
    ```typescript
    interface OperationLog {
      _id: string;
      subscriptionId: string;
      operatorId: string;
      action: string; // e.g., "manual_payment", "plan_change"
      timestamp: Date;
    }
    ```
  - 實現於 `OperationLogRepository`，支援查詢和導出。

### 6. 系統擴充性與彈性
- **策略模式與規則引擎**：
  - 實現方式：使用 TypeScript 介面定義規則（如 `IDiscountRule`, `IRetryRule`），支援 JSON 配置。
  - 示例：
    ```typescript
    interface IDiscountRule {
      apply(subscription: Subscription, coupon: Coupon): number;
    }
    ```
  - 配置儲存於 MongoDB 的 `rules` 集合，支援動態更新。
- **多平台支付**：
  - 預留接口，支援 Stripe 和 PayPal 整合，實現於 `PaymentService`。
  - 模擬支付（80% 成功率）繼續用於測試環境。
- **人工介入**：
  - 支援手動觸發扣款（API：`POST /client_service/api/v1/subscriptions/payments/manual`）。
  - 支援修改優惠（API：`PATCH /client_service/api/v1/subscriptions/:subscriptionId/coupon`）。

### 7. API 與資料結構

#### 7.1 API 端點
- **版本控制**：所有 API 使用 `/client_service/api/v1/` 前綴。
- **認證**：使用 JWT，通過 `Authorization: Bearer <token>` 驗證。
- **端點列表**：
  - **POST `/client_service/api/v1/subscriptions`**  
    創建訂閱  
    ```json
    {
      "userId": "string",
      "productId": "string",
      "startDate": "2025-01-15T10:00:00.000Z",
      "couponCode": "string" // 可選
    }
    ```
    響應：
    ```json
    {
      "subscriptionId": "string",
      "status": "pending"
    }
    ```
  - **GET `/client_service/api/v1/subscriptions/products`**  
    查詢可用產品（過濾已訂閱產品）  
    Query: `?userId=string`  
    響應：
    ```json
    [
      {
        "productId": "string",
        "name": "string",
        "price": number,
        "billingCycle": "monthly | quarterly | yearly | weekly"
      }
    ]
    ```
  - **POST `/client_service/api/v1/subscriptions/payments`**  
    執行扣款  
    ```json
    {
      "subscriptionId": "string",
      "amount": number
    }
    ```
    響應：
    ```json
    {
      "success": boolean,
      "reason": "string | null"
    }
    ```
  - **GET `/client_service/api/v1/subscriptions/:subscriptionId`**  
    查詢訂閱詳情  
    響應：
    ```json
    {
      "subscriptionId": "string",
      "userId": "string",
      "productId": "string",
      "billingCycle": "string",
      "status": "string",
      "nextBillingDate": "string",
      "renewal_count": number
    }
    ```
  - **PATCH `/client_service/api/v1/subscriptions/:subscriptionId/plan`**  
    方案轉換  
    ```json
    {
      "newBillingCycle": "quarterly | yearly",
      "operatorId": "string"
    }
    ```
    響應：
    ```json
    {
      "subscriptionId": "string",
      "newBillingCycle": "string",
      "nextBillingDate": "string"
    }
    ```
  - **PATCH `/client_service/api/v1/subscriptions/:subscriptionId/cancel`**  
    取消訂閱  
    ```json
    {
      "operatorId": "string"
    }
    ```
    響應：
    ```json
    {
      "subscriptionId": "string",
      "status": "cancelled"
    }
    ```
  - **POST `/client_service/api/v1/subscriptions/payments/manual`**  
    手動扣款  
    ```json
    {
      "subscriptionId": "string",
      "amount": number,
      "operatorId": "string"
    }
    ```
  - **PATCH `/client_service/api/v1/subscriptions/:subscriptionId/coupon`**  
    修改優惠碼  
    ```json
    {
      "couponCode": "string",
      "operatorId": "string"
    }
    ```

#### 7.2 錯誤處理
- 使用全域異常過濾器 (`app-exception.filter.ts`) 統一處理錯誤。
- 常見錯誤：
  - `InvalidCouponException`: HTTP 400（無效優惠碼）。
  - `InvalidPlanChangeException`: HTTP 400（不支援的方案轉換）。
  - `UnauthorizedException`: HTTP 401（無效 JWT）。
  - `NotFoundException`: HTTP 404（訂閱或產品不存在）。

### 8. 文件化策略
- **API 文件化**：
  - 使用 `@nestjs/swagger` 生成 Swagger 文件，部署於 `/api-docs` 端點。
  - 包含所有 API 的請求/響應格式、錯誤碼和範例。
- **後台管理**：
  - 查詢功能：支援按時間範圍、訂閱 ID 篩選（使用 MongoDB 索引）。
  - 導出功能：支援 CSV 和 JSON 格式，實現於 `SubscriptionApplicationService`。
- **運營手冊**：
  - Markdown 文件，涵蓋優惠設定、扣款失敗處理、方案轉換操作。
  - 儲存於項目倉庫的 `/docs` 目錄。

### 9. 合規與安全
- **資料加密**：支付資訊使用 AES-256 加密，實現於 `PaymentService`。
- **防止攻擊**：
  - 使用 `class-validator` 驗證 API 輸入，防止 SQL 注入。
  - 使用 Helmet 中間件防止 XSS 攻擊。
- **JWT 認證**：所有 API 需攜帶有效 JWT token。

### 10. 效能與資料管理
- **效能目標**：支援 1000 個並發訂閱查詢。
  - 使用 MongoDB 索引優化查詢（如 `userId`, `subscriptionId`）。
  - 選用 Redis 快取熱門查詢（如產品列表）。
- **資料保留**：歷史資料保留 1 年，定時任務 (`DataCleanupJob`) 清理過期資料。

---

## 資料結構

### MongoDB 集合
1. **subscriptions**：
   ```typescript
   {
     _id: string;
     userId: string;
     productId: string;
     billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
     startDate: Date;
     nextBillingDate: Date;
     coupon_applied: { code: string; periods: number };
     renewal_count: number;
     status: 'pending' | 'active' | 'cancelled' | 'grace_period';
     gracePeriodEndDate?: Date;
   }
   ```
2. **products**：
   ```typescript
   {
     _id: string;
     name: string;
     price: number;
     billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
     renewal_discount?: { type: 'percentage' | 'fixed'; value: number };
   }
   ```
3. **coupons**：見優惠方案設計。
4. **payment_history**：
   ```typescript
   {
     _id: string;
     subscriptionId: string;
     amount: number;
     success: boolean;
     reason?: string;
     timestamp: Date;
     retryCount: number;
   }
   ```
5. **operation_logs**：見狀態管理與資料紀錄。
6. **rules**：
   ```typescript
   {
     _id: string;
     type: 'discount' | 'retry';
     config: object; // JSON 配置，如 { interval: '1h', maxRetries: 3 }
   }
   ```

---

## 測試規範
- **單元測試**：
  - 覆蓋 `SubscriptionService`, `PaymentService`, `CouponService`。
  - 測試優惠優先級、方案轉換邏輯、重試機制。
- **整合測試**：
  - 測試 API 端點（創建、查詢、轉換、取消）。
  - 測試 MongoDB 資料操作。
- **目標**：測試覆蓋率 > 80%（MVP 為 45%）。
- **工具**：Jest。

---

## 部署與運行
- **環境要求**：
  - Node.js 18+
  - MongoDB 6+
  - Redis（快取）
  - Docker
- **啟動方式**：
  ```bash
  yarn install
  yarn start:dev # 開發模式
  yarn build && yarn start:prod # 生產模式
  yarn test # 測試
  ```
- **環境變數**：
  ```env
  PORT=3001
  DEFAULT_MONGO_URI=mongodb://localhost:27017/ccrc_test1
  DEFAULT_MONGO_DB_NAME=ccrc_test1
  JWT_SECRET=your_jwt_secret
  REDIS_URL=redis://localhost:6379
  ```
- **Docker 部署**：
  - 使用 `Dockerfile` 構建容器，包含 NestJS 應用和 MongoDB 連線。

---

## 結語
本規格書定義了 **Auto Billing Bot V1** 的詳細實現方案，涵蓋進階優惠管理、方案轉換、扣款重試、API 設計和文件化需求。系統在 POC 和 MVP 基礎上擴展，確保商業運營需求，並為未來多租戶和真實支付網關整合預留接口。

**開發團隊**：xxxhand  
**項目倉庫**：https://github.com/xxxhand/auto-billing-bot  
**規格書日期**：2025年9月29日