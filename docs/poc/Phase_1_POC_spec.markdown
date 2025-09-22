# 自動扣款機器人規格說明書 - Phase 1: POC (Proof of Concept)

## 概述
**目的**：本規格書定義自動扣款機器人 Phase 1 POC 的系統設計，實現基本訂閱與扣款邏輯，驗證技術可行性。系統支援月/年週期計算、狀態管理、模擬支付及人工介入（透過 REST API），忽略優惠、退款、多租戶等功能。

**範圍**：基於需求文件 `Phase_1_POC_requirements_v1.md`，聚焦訂閱週期計算、產品列表查詢、狀態流轉、扣款紀錄、模擬支付及人工取消訂閱。

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
    B -->|MongoDB Driver| C[資料庫: MongoDB]
    B -->|內部呼叫| D[模擬支付服務]
    B -->|REST API| E[人工介入模組]
```

- **前端**：簡單網頁介面，支援產品列表查詢與訂閱操作。
- **後端**：NestJS 服務，處理訂閱邏輯、週期計算與狀態管理。
- **資料庫**：MongoDB，儲存訂閱、產品、扣款歷史與操作日誌。
- **模擬支付服務**：內部模組，模擬支付成功/失敗。
- **人工介入模組**：透過 REST API，支援客服取消訂閱。

### 模組分解
1. **訂閱管理模組**：
   - 處理訂閱建立、週期計算、產品查詢。
   - 負責狀態流轉（待生效 → 已生效 → 已取消）。
2. **支付處理模組**：
   - 模擬支付邏輯，記錄結果（成功/失敗）。
3. **資料儲存模組**：
   - 使用原生 MongoDB Driver 管理資料存取，儲存訂閱、產品、扣款歷史。
4. **人工介入模組**：
   - 提供 REST API 端點，支援客服取消訂閱。

---

## 功能規格

### 1. 訂閱週期與扣款邏輯
#### 1.1 訂閱扣款週期可自定義
- **功能描述**：支援月與年週期，從訂閱開始日計算。處理大小月與閏年。
- **規格**：
  - 週期計算：基於曆法週期（1個月 = 28/29/30/31天，1年 = 12個月）。
  - 邊緣案例：
    - 1/31 訂閱，2月扣款日為 2/28（非閏年）或 2/29（閏年）。
    - 下期計算：2/28 → 3/31（加1個月，調整至月底）。
  - 輸入：訂閱開始日（ISO 8601 格式，如 `2025-01-31`）、週期類型（`monthly`/`yearly`）。
  - 輸出：下次扣款日期（ISO 8601 格式）。
- **API**：
  ```json
  POST /subscriptions
  {
    "userId": "string",
    "productId": "string",
    "startDate": "2025-01-31",
    "cycleType": "monthly"
  }
  Response:
  {
    "subscriptionId": "string",
    "nextBillingDate": "2025-02-28"
  }
  ```

#### 1.2 每個產品唯一扣款週期
- **功能描述**：產品綁定單一週期（月或年），不可變更。
- **規格**：
  - 產品集合包含固定週期欄位（`cycleType`）。
  - 訂閱建立時驗證產品週期，拒絕無效週期。
  - 若需不同週期，需於後台新增新產品。
- **資料結構**：
  ```typescript
  interface Product {
    id: string;
    name: string;
    cycleType: 'monthly' | 'yearly';
    price: number;
  }
  ```

#### 1.3 扣款週期的計算方式
- **功能描述**：僅支援曆法週期（月/年），產品端設定週期，使用者選擇產品。
- **規格**：
  - 週期設定儲存於產品集合，無使用者自定義選項。
  - 計算邏輯：使用 JavaScript `date-fns` 庫（如 `addMonths`）處理日期加減。
  - 忽略固定天數週期（如 30 天）。

#### 1.4 可訂閱產品列表
- **功能描述**：提供產品列表查詢，過濾使用者已訂閱的產品。
- **規格**：
  - 查詢顯示產品 ID、名稱、價格、週期類型。
  - 過濾邏輯：檢查訂閱集合，排除 `userId` 已訂閱的產品。
- **API**：
  ```json
  GET /products?userId={userId}
  Response:
  [
    {
      "id": "string",
      "name": "string",
      "cycleType": "monthly",
      "price": 10.00
    }
  ]
  ```

### 2. 狀態管理與資料紀錄
#### 2.1 訂閱狀態與生命週期
- **功能描述**：定義訂閱狀態（待生效、已生效、已取消），支援簡單流轉。
- **規格**：
  - 狀態定義：
    - `pending`：訂閱建立，尚未扣款。
    - `active`：首次扣款成功。
    - `cancelled`：用戶或客服取消。
  - 流轉規則：
    ```mermaid
    stateDiagram-v2
        [*] --> pending: 建立訂閱
        pending --> active: 首次扣款成功
        pending --> cancelled: 人工取消
        active --> cancelled: 人工取消
    ```
  - 狀態儲存於訂閱集合 `status` 欄位。
- **資料結構**：
  ```typescript
  interface Subscription {
    id: string;
    userId: string;
    productId: string;
    startDate: string;
    nextBillingDate: string;
    status: 'pending' | 'active' | 'cancelled';
    createdAt: string;
  }
  ```

#### 2.2 扣款歷史與異常記錄
- **功能描述**：記錄每次扣款結果（成功/失敗）。
- **規格**：
  - 儲存扣款時間、金額、狀態（`success`/`failed`）、失敗原因（若適用）。
  - 無重試機制，失敗即記錄。
- **資料結構**：
  ```typescript
  interface PaymentHistory {
    id: string;
    subscriptionId: string;
    amount: number;
    status: 'success' | 'failed';
    failureReason?: string;
    createdAt: string;
  }
  ```

### 3. 系統擴充性與彈性
#### 3.1 模擬支付支援
- **功能描述**：使用模擬支付服務處理扣款。
- **規格**：
  - 模擬支付邏輯：隨機返回 `success`（80%）或 `failed`（20%，原因如 `insufficient_funds`）。
  - 輸入：訂閱 ID、金額。
  - 錯誤處理：記錄模擬失敗原因。
- **API**：
  ```json
  POST /payments
  {
    "subscriptionId": "string",
    "amount": 10.00
  }
  Response:
  {
    "paymentId": "string",
    "status": "success"
  }
  ```

#### 3.2 人工介入與應急流程
- **功能描述**：客服透過 REST API 取消訂閱。
- **規格**：
  - 端點：`PATCH /subscriptions/{subscriptionId}/cancel`。
  - 更新訂閱狀態為 `cancelled`，記錄操作日誌。
  - 日誌儲存於資料庫：
  ```typescript
  interface OperationLog {
    id: string;
    subscriptionId: string;
    action: string;
    createdAt: string;
  }
  ```
- **API**：
  ```json
  PATCH /subscriptions/{subscriptionId}/cancel
  {
    "operatorId": "string"
  }
  Response:
  {
    "subscriptionId": "string",
    "status": "cancelled"
  }
  ```

---

## 資料庫設計
### MongoDB 集合
```typescript
interface User {
  id: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  cycleType: 'monthly' | 'yearly';
  price: number;
}

interface Subscription {
  id: string;
  userId: string;
  productId: string;
  startDate: string; // ISO 8601, e.g., "2025-01-31"
  nextBillingDate: string; // ISO 8601
  status: 'pending' | 'active' | 'cancelled';
  createdAt: string; // ISO 8601
}

interface PaymentHistory {
  id: string;
  subscriptionId: string;
  amount: number;
  status: 'success' | 'failed';
  failureReason?: string;
  createdAt: string; // ISO 8601
}

interface OperationLog {
  id: string;
  subscriptionId: string;
  action: string;
  createdAt: string; // ISO 8601
}
```

### 集合結構
- **users**：儲存使用者基本資訊。
- **products**：儲存產品資訊（名稱、週期、價格）。
- **subscriptions**：儲存訂閱記錄。
- **paymentHistory**：儲存扣款歷史。
- **operationLogs**：儲存人工操作日誌。

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
   - 使用 NestJS 模組化架構，分離控制器、服務與資料存取層。
   - 週期計算與狀態管理獨立為服務模組。
4. **日誌**：
   - 使用 Pino 記錄 API 請求、錯誤及操作日誌，輸出至文件（`app.log`）。
   - 日誌格式：JSON，包含時間戳、層級、訊息。

---

## 實現細節
- **技術棧**：
  - 後端：Node.js + NestJS。
  - 資料庫：MongoDB（使用原生 MongoDB Driver）。
  - 支付：模擬支付服務（內部模組）。
  - 日期處理：date-fns 套件。
  - 日誌：Pino（輸出至文件）。
- **部署**：
  - 單一伺服器（Docker 容器）。
  - 環境變數管理 MongoDB 連線字串。
- **測試**：
  - 單元測試：週期計算、狀態流轉（使用 Jest）。
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
| 1. | 訂閱用戶 | 系統自動計算扣款日（處理大小月/閏年） | 我不用擔心錯誤收費 | 訂閱扣款週期可自定義 |
| 2. | 系統管理者 | 每個產品綁定唯一週期 | 減少規則衝突 | 每個產品唯一扣款週期 |
| 3. | 訂閱用戶 | 查詢產品列表（過濾已訂閱） | 我知道可選方案 | 可訂閱產品列表 |
| 4. | 客服人員 | 查詢訂閱狀態與扣款歷史 | 我能定位基本問題 | 訂閱狀態與扣款歷史查詢 |