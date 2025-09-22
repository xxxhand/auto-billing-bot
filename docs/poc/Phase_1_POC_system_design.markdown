# 自動扣款機器人系統設計書 - Phase 1: POC (Proof of Concept)

## 概述
**目的**：本系統設計書基於 `Phase_1_POC_spec.md`，採用領域驅動設計（DDD）方法，定義自動扣款機器人 Phase 1 POC 的系統架構與實現細節。系統實現基本訂閱與扣款邏輯，驗證技術可行性，支援月/年週期計算、狀態管理、模擬支付及人工介入（REST API），忽略優惠、退款、多租戶等功能。

**範圍**：聚焦訂閱週期計算、產品列表查詢、狀態流轉、扣款紀錄、模擬支付及人工取消訂閱，符合需求文件 `Phase_1_POC_requirements_v1.md`。

**假設**：
- 系統運行於單一伺服器環境，無高可用性要求。
- 使用者身份由外部身份驗證系統提供（無內建認證）。
- 支付使用模擬服務，無真實支付網關。
- 資料庫使用 MongoDB，透過原生 MongoDB Driver 存取。

**依賴**：無（初始階段）。

**輸出**：原型系統，驗證扣款計算正確性及基本功能。

---

## 系統架構

### 高階架構圖
```mermaid
graph TD
    A[前端: 使用者介面] -->|REST API| B[後端: NestJS 服務]
    B -->|應用服務| C[領域層: 訂閱領域]
    C -->|儲存庫| D[資料庫: MongoDB]
    B -->|應用服務| E[模擬支付服務]
    B -->|REST API| F[人工介入模組]
```

- **前端**：簡單網頁介面，支援產品列表查詢與訂閱操作。
- **後端**：NestJS 服務，分為應用層與領域層，處理訂閱邏輯、週期計算與狀態管理。
- **領域層**：實現訂閱領域的實體（Entities）、值物件（Value Objects）與聚合（Aggregates）。
- **儲存庫**：透過原生 MongoDB Driver 存取資料，映射領域模型。
- **模擬支付服務**：內部模組，模擬支付成功/失敗。
- **人工介入模組**：透過 REST API，支援客服取消訂閱。

### DDD 分層架構
- **應用層（Application Layer）**：負責協調領域邏輯，處理 REST API 請求，呼叫領域服務。
- **領域層（Domain Layer）**：包含訂閱領域的核心業務邏輯（Entities、Value Objects、Aggregates、Domain Services）。
- **基礎設施層（Infrastructure Layer）**：實現儲存庫（MongoDB Driver）、模擬支付與日誌（Pino）。

---

## 領域模型（Domain Models）

### 1. 聚合（Aggregates）
#### 1.1 Subscription（訂閱聚合）
- **描述**：代表用戶對某產品的訂閱，包含週期計算與狀態管理邏輯，是主要聚合根。
- **實體（Entity）**：
  ```typescript
  interface Subscription {
    id: string; // 唯一識別碼
    userId: string; // 使用者ID
    productId: string; // 產品ID
    startDate: string; // 訂閱開始日（ISO 8601）
    nextBillingDate: string; // 下次扣款日（ISO 8601）
    status: 'pending' | 'active' | 'cancelled'; // 訂閱狀態
    createdAt: string; // 建立時間（ISO 8601）
    calculateNextBillingDate(): string; // 計算下次扣款日
    activate(): void; // 轉為已生效
    cancel(): void; // 取消訂閱
  }
  ```
- **行為**：
  - `calculateNextBillingDate`：根據產品週期計算下次扣款日，處理大小月與閏年。
  - `activate`：首次扣款成功後，將狀態從 `pending` 轉為 `active`。
  - `cancel`：人工介入取消，將狀態設為 `cancelled`。
- **不變條件**：
  - `startDate` 與 `nextBillingDate` 必須為有效 ISO 8601 格式。
  - `status` 流轉遵循規則：`pending` → `active` 或 `cancelled`，`active` → `cancelled`。
  - `productId` 必須對應有效產品。

#### 1.2 Product（產品聚合）
- **描述**：代表可訂閱的產品，包含週期與價格資訊，是獨立聚合根。
- **實體（Entity）**：
  ```typescript
  interface Product {
    id: string; // 唯一識別碼
    name: string; // 產品名稱
    cycleType: 'monthly' | 'yearly'; // 週期類型
    price: number; // 價格
  }
  ```
- **不變條件**：
  - `cycleType` 必須為 `monthly` 或 `yearly`。
  - `price` 必須為正數。

### 2. 值物件（Value Objects）
#### 2.1 BillingCycle（計費週期）
- **描述**：封裝週期計算邏輯，作為值物件嵌入 Subscription。
- **結構**：
  ```typescript
  interface BillingCycle {
    cycleType: 'monthly' | 'yearly';
    calculateNextDate(currentDate: string): string; // 計算下次扣款日
  }
  ```
- **行為**：
  - `calculateNextDate`：根據 `cycleType` 與當前日期，使用 `date-fns` 計算下次扣款日（考慮大小月/閏年）。

#### 2.2 PaymentResult（支付結果）
- **描述**：封裝單次扣款結果，作為值物件記錄於 PaymentHistory。
- **結構**：
  ```typescript
  interface PaymentResult {
    status: 'success' | 'failed';
    failureReason?: string; // 若失敗，提供原因
  }
  ```

### 3. 領域服務（Domain Services）
#### 3.1 PaymentService
- **描述**：處理模擬支付邏輯，與外部模擬支付服務互動。
- **行為**：
  - `processPayment(subscriptionId: string, amount: number): PaymentResult`：模擬支付，返回結果（80% 成功，20% 失敗，隨機原因如 `insufficient_funds`）。

#### 3.2 SubscriptionService
- **描述**：協調訂閱相關邏輯，如建立訂閱、計算週期。
- **行為**：
  - `createSubscription(userId: string, productId: string, startDate: string): Subscription`：創建訂閱，驗證產品有效性。
  - `getAvailableProducts(userId: string): Product[]`：返回未訂閱的產品列表。

---

## 資料庫設計
### MongoDB 集合（映射領域模型）
#### 1. users
- **對應領域模型**：無直接實體，僅作為參考儲存使用者資訊。
- **結構**：
  ```typescript
  interface User {
    id: string;
    email: string;
  }
  ```

#### 2. products
- **對應領域模型**：Product 聚合。
- **結構**：
  ```typescript
  interface Product {
    id: string;
    name: string;
    cycleType: 'monthly' | 'yearly';
    price: number;
  }
  ```

#### 3. subscriptions
- **對應領域模型**：Subscription 聚合（包含 BillingCycle 值物件）。
- **結構**：
  ```typescript
  interface Subscription {
    id: string;
    userId: string;
    productId: string;
    startDate: string; // ISO 8601
    nextBillingDate: string; // ISO 8601
    status: 'pending' | 'active' | 'cancelled';
    createdAt: string; // ISO 8601
  }
  ```

#### 4. paymentHistory
- **對應領域模型**：PaymentResult 值物件的持久化。
- **結構**：
  ```typescript
  interface PaymentHistory {
    id: string;
    subscriptionId: string;
    amount: number;
    status: 'success' | 'failed';
    failureReason?: string;
    createdAt: string; // ISO 8601
  }
  ```

#### 5. operationLogs
- **對應領域模型**：記錄人工介入操作，無直接對應實體。
- **結構**：
  ```typescript
  interface OperationLog {
    id: string;
    subscriptionId: string;
    action: string;
    createdAt: string; // ISO 8601
  }
  ```

### 索引
- **subscriptions**：索引 `userId`（查詢用戶訂閱）、`productId`（驗證產品）。
- **paymentHistory**：索引 `subscriptionId`（查詢扣款歷史）。
- **operationLogs**：索引 `subscriptionId`（查詢操作日誌）。

---

## 儲存庫（Repositories）
1. **SubscriptionRepository**：
   - `save(subscription: Subscription): Promise<void>`：儲存或更新訂閱。
   - `findById(id: string): Promise<Subscription>`：根據 ID 查詢訂閱。
   - `findByUserId(userId: string): Promise<Subscription[]>`：查詢用戶所有訂閱。
2. **ProductRepository**：
   - `findAll(): Promise<Product[]>`：查詢所有產品。
   - `findById(id: string): Promise<Product>`：根據 ID 查詢產品。
3. **PaymentHistoryRepository**：
   - `save(payment: PaymentHistory): Promise<void>`：儲存扣款記錄。
   - `findBySubscriptionId(subscriptionId: string): Promise<PaymentHistory[]>`：查詢訂閱的扣款歷史。
4. **OperationLogRepository**：
   - `save(log: OperationLog): Promise<void>`：儲存操作日誌。

---

## 應用服務（Application Services）
1. **SubscriptionApplicationService**：
   - `createSubscription(userId: string, productId: string, startDate: string): Promise<Subscription>`：創建訂閱，調用 SubscriptionService 與儲存庫。
   - `getAvailableProducts(userId: string): Promise<Product[]>`：查詢可用產品，過濾已訂閱產品。
   - `cancelSubscription(subscriptionId: string, operatorId: string): Promise<void>`：取消訂閱，記錄操作日誌。
2. **PaymentApplicationService**：
   - `processPayment(subscriptionId: string, amount: number): Promise<PaymentResult>`：執行模擬支付，儲存結果。

---

## API 規格
### 1. 建立訂閱
- **端點**：`POST /subscriptions`
- **輸入**：
  ```json
  {
    "userId": "string",
    "productId": "string",
    "startDate": "2025-01-31",
    "cycleType": "monthly"
  }
  ```
- **輸出**：
  ```json
  {
    "subscriptionId": "string",
    "nextBillingDate": "2025-02-28"
  }
  ```

### 2. 查詢產品列表
- **端點**：`GET /products?userId={userId}`
- **輸出**：
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "cycleType": "monthly",
      "price": 10.00
    }
  ]
  ```

### 3. 執行扣款
- **端點**：`POST /payments`
- **輸入**：
  ```json
  {
    "subscriptionId": "string",
    "amount": 10.00
  }
  ```
- **輸出**：
  ```json
  {
    "paymentId": "string",
    "status": "success"
  }
  ```

### 4. 查詢訂閱狀態與扣款歷史
- **端點**：`GET /subscriptions/{subscriptionId}`
- **輸出**：
  ```json
  {
    "subscriptionId": "string",
    "userId": "string",
    "productId": "string",
    "status": "active",
    "nextBillingDate": "2025-02-28",
    "paymentHistory": [
      {
        "paymentId": "string",
        "amount": 10.00,
        "status": "success",
        "createdAt": "2025-01-31T10:00:00Z"
      }
    ]
  }
  ```

### 5. 取消訂閱
- **端點**：`PATCH /subscriptions/{subscriptionId}/cancel`
- **輸入**：
  ```json
  {
    "operatorId": "string"
  }
  ```
- **輸出**：
  ```json
  {
    "subscriptionId": "string",
    "status": "cancelled"
  }
  ```

---

## 非功能性需求
1. **效能**：
   - API 回應時間：< 500ms（單用戶測試）。
   - MongoDB 查詢：< 100ms（簡單查詢）。
2. **安全性**：
   - 模擬支付不涉及敏感資料，無需額外加密。
   - API 使用 HTTPS。
3. **可維護性**：
   - 使用 NestJS 模組化架構，分離控制器、應用服務、領域層與儲存庫。
   - 領域模型與儲存庫分離，確保業務邏輯獨立。
4. **日誌**：
   - 使用 Pino 記錄 API 請求、錯誤及操作日誌，輸出至文件（`app.log`）。
   - 日誌格式：JSON，包含時間戳、層級、訊息。

---

## 實現細節
- **技術棧**：
  - 後端：Node.js + NestJS。
  - 資料庫：MongoDB（原生 MongoDB Driver）。
  - 支付：模擬支付服務（內部模組）。
  - 日期處理：date-fns 套件。
  - 日誌：Pino（輸出至文件）。
- **部署**：
  - 單一伺服器（Docker 容器）。
  - 環境變數管理 MongoDB 連線字串。
- **測試**：
  - 單元測試：領域模型行為（週期計算、狀態流轉），使用 Jest。
  - 整合測試：API 端點與模擬支付。
  - 測試案例：1/31 訂閱月週期、2/28 扣款、人工取消。

---

## 限制與風險
1. **限制**：
   - 僅支援模擬支付，無法驗證真實支付場景。
   - 無扣款失敗重試，影響續訂成功率。
   - 無高可用性設計，單點故障風險。
2. **風險**：
   - 大小月計算錯誤：需嚴格測試邊緣日期。
   - MongoDB 效能：需索引優化以確保查詢速度。
   - 人工介入權限控制：REST API 需後續加入身份驗證。

---

## User Stories 對應
| Case | As a | I want | So that | 對應功能 |
|------|------|--------|---------|----------|
| 1. | 訂閱用戶 | 系統自動計算扣款日（處理大小月/閏年） | 我不用擔心錯誤收費 | Subscription.calculateNextBillingDate |
| 2. | 系統管理者 | 每個產品綁定唯一週期 | 減少規則衝突 | Product.cycleType 不變條件 |
| 3. | 訂閱用戶 | 查詢產品列表（過濾已訂閱） | 我知道可選方案 | SubscriptionApplicationService.getAvailableProducts |
| 4. | 客服人員 | 查詢訂閱狀態與扣款歷史 | 我能定位基本問題 | SubscriptionRepository.findById, PaymentHistoryRepository.findBySubscriptionId |