# 自動扣款機器人規格說明書 - Phase 2: MVP (Minimum Viable Product)

## 概述
**目的**：本規格書定義自動扣款機器人 Phase 2 MVP 的系統設計，基於 Phase 1 POC，新增自動扣款、優惠方案、退款處理與扣款失敗重試功能，實現最小可行產品，支援早期用戶測試與基本商業運營。系統延續 DDD 架構，支援月/年週期計算、狀態管理、模擬支付、人工介入（REST API），新增百分比折扣、方案轉換、退款、全域設定、扣款重試與寬限期，以及自動扣款觸發。

**範圍**：基於 `Phase_2_MVP_requirements_v1.md`，涵蓋自動扣款、優惠方案、方案轉換、退款管理、扣款失敗重試、狀態與資料紀錄，忽略檔期優惠、多租戶與進階擴充。

**假設**：
- 系統運行於單一伺服器環境，無高可用性要求。
- 使用者身份由外部身份驗證系統提供（無內建認證）。
- 支付使用模擬服務，無真實支付網關。
- 資料庫使用 MongoDB，透過原生 MongoDB Driver 存取。
- Phase 1 功能（訂閱、產品管理、狀態流轉、模擬支付）已實現。
- 自動扣款使用 `@nestjs/schedule` 定時任務實現。

**依賴**：Phase 1 POC 功能。

**輸出**：MVP 系統，支援早期用戶測試與商業運營。

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
    B -->|定時任務| G[自動扣款模組]
```

- **前端**：網頁介面，支援訂閱操作、產品查詢、取消與退款申請。
- **後端**：NestJS 服務，分為應用層與領域層，處理訂閱、優惠、退款與重試邏輯。
- **領域層**：包含訂閱、產品、優惠、支付領域的實體、值物件與聚合。
- **儲存庫**：透過原生 MongoDB Driver 存取資料，映射領域模型。
- **模擬支付服務**：內部模組，模擬支付成功/失敗。
- **人工介入模組**：透過 REST API，支援客服取消訂閱與退款。
- **自動扣款模組**：使用 `@nestjs/schedule` 模組，每天檢查到期訂閱並觸發扣款。

### DDD 分層架構
- **應用層**：協調領域邏輯，處理 REST API 請求與定時任務，呼叫領域服務。
- **領域層**：包含訂閱領域的核心業務邏輯（Entities、Value Objects、Aggregates、Domain Services）。
- **基礎設施層**：實現儲存庫（MongoDB Driver）、模擬支付、日誌（Pino）與定時任務。

---

## 功能規格

### 1. 自動扣款
#### 1.1 自動扣款觸發
- **功能描述**：根據訂閱的 `nextBillingDate`，定時觸發扣款，整合優惠計算（優惠碼或續訂折扣）。
- **規格**：
  - 觸發機制：使用 `@nestjs/schedule` 的 `Cron` 功能，每天檢查 `nextBillingDate` 為當天或過期的 `active` 訂閱。
  - 扣款金額計算：應用續訂優惠（若 `renewalCount >= 1`）或優惠碼，計算折扣後金額。
  - 結果處理：扣款成功更新 `nextBillingDate`、`renewalCount += 1`、狀態保持 `active`；失敗進入重試流程。
  - 記錄：新增支付歷史記錄，標記為自動扣款（`isAuto: true`）。
- **內部服務**：
  - `AutoBillingService.triggerBilling()`：查詢到期訂閱，呼叫支付服務。

### 2. 優惠與方案
#### 2.1 優惠方案設計
- **功能描述**：支援百分比折扣（如 30% off），設定優先級（續訂優惠 > 優惠碼）。
- **規格**：
  - 優惠儲存於產品，包含折扣百分比（如 0.3）。
  - 優先級：續訂優惠 > 優惠碼。
  - 計算邏輯：`discountedPrice = originalPrice * (1 - discountPercentage)`，應用於自動扣款。
- **API**：
  ```json
  POST /products
  {
    "id": "string",
    "name": "string",
    "cycleType": "monthly",
    "price": 10.00,
    "discountPercentage": 0.3
  }
  ```

#### 2.2 優惠碼機制
- **功能描述**：支援一碼多人使用（無次數上限），記錄使用防止重複。自動扣款時檢查優惠碼有效性。
- **規格**：
  - 優惠碼儲存於新集合，包含碼與折扣百分比。
  - 驗證邏輯：訂閱創建時檢查用戶是否已使用該碼（儲存 userId 與 couponId）。
  - 應用邏輯：自動扣款時若有優惠碼，套用折扣（但優先級低於續訂優惠）。
- **API**：
  ```json
  POST /subscriptions
  {
    "userId": "string",
    "productId": "string",
    "startDate": "2025-01-31",
    "cycleType": "monthly",
    "couponCode": "string"
  }
  ```

#### 2.3 第二次以上續訂優惠
- **功能描述**：第二次及以上續訂提供簡單折扣，記錄續訂次數。
- **規格**：
  - 訂閱集合新增 `renewalCount` 欄位，初始為 0，成功自動扣款後 +1。
  - 續訂優惠：若 `renewalCount >= 1`，套用產品定義的續訂折扣（優先於優惠碼）。
  - 應用於自動扣款金額計算。

#### 2.4 方案轉換時的優惠處理
- **功能描述**：轉換後下期以新方案原價計費，適用續訂優惠（忽略優惠碼）。
- **規格**：
  - 下期生效：更新 `productId` 與 `nextBillingDate`，不變更當前週期。
  - 優惠：僅套用新產品的續訂優惠（若 `renewalCount >= 1`），不承接優惠碼。
- **API**：
  ```json
  PATCH /subscriptions/{subscriptionId}/switch
  {
    "newProductId": "string"
  }
  ```

### 3. 方案轉換
#### 3.1 方案切換支援
- **功能描述**：支援月轉年，下期生效，無退費，無優惠承接。
- **規格**：
  - 驗證新產品存在且週期有效（`monthly` 或 `yearly`）。
  - 更新訂閱的 `productId` 與 `nextBillingDate`（依新產品週期計算）。
  - 狀態保持 `active`，記錄操作日誌。
- **API**：同 2.4。

### 4. 退款管理
#### 4.1 退款條件與流程
- **功能描述**：主動取消時全額退款，依全域設定（固定 7 天退款窗口）。
- **規格**：
  - 全域設定：退款窗口 7 天（環境變數 `REFUND_WINDOW_DAYS`）。
  - 條件：訂閱狀態為 `active`，取消時間在 `startDate` 後 7 天內。
  - 流程：取消訂閱，記錄退款記錄，狀態轉為 `refunding`，模擬退款後轉為 `cancelled`。
- **API**：
  ```json
  PATCH /subscriptions/{subscriptionId}/refund
  {
    "operatorId": "string"
  }
  Response:
  {
    "subscriptionId": "string",
    "status": "refunding"
  }
  ```

### 5. 扣款失敗與重試
#### 5.1 扣款失敗重試與寬限期
- **功能描述**：分類失敗原因，固定 3 次重試，寬限期內手動補款。
- **規格**：
  - 失敗原因：`network_error`、`insufficient_funds`。
  - 重試：自動扣款失敗後記錄，重試 3 次（間隔 1 小時，模擬環境簡化為即時）。
  - 寬限期：7 天（環境變數 `GRACE_PERIOD_DAYS`），狀態設為 `grace_period`。
  - 手動補款：客服透過 API 觸發補款，重試成功後狀態恢復 `active`。
- **API**：
  ```json
  POST /subscriptions/{subscriptionId}/retry-payment
  {
    "operatorId": "string",
    "amount": 10.00
  }
  ```

### 6. 狀態管理與資料紀錄
#### 6.1 訂閱狀態與生命週期
- **功能描述**：擴展 Phase 1，新增 `grace_period`、`refunding` 狀態，整合自動扣款、失敗與取消。
- **規格**：
  - 狀態：`pending`、`active`、`grace_period`、`refunding`、`cancelled`。
  - 流轉規則：
    ```mermaid
    stateDiagram-v2
        [*] --> pending: 建立訂閱
        pending --> active: 首次扣款成功
        pending --> cancelled: 人工取消
        active --> grace_period: 自動扣款失敗
        grace_period --> active: 補款成功
        grace_period --> cancelled: 寬限期結束
        active --> refunding: 申請退款
        refunding --> cancelled: 退款完成
        active --> cancelled: 人工取消
    ```
- **資料結構**：
  ```typescript
  interface Subscription {
    id: string;
    userId: string;
    productId: string;
    startDate: string;
    nextBillingDate: string;
    status: 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled';
    createdAt: string;
    renewalCount: number;
    couponCode?: string;
  }
  ```

#### 6.2 扣款歷史與異常記錄
- **功能描述**：記錄自動扣款、重試與手動補款。
- **規格**：
  - 新增欄位：`retryCount`（重試次數）、`isManual`（是否手動補款）、`isAuto`（是否自動扣款）。
- **資料結構**：
  ```typescript
  interface PaymentHistory {
    id: string;
    subscriptionId: string;
    amount: number;
    status: 'success' | 'failed';
    failureReason?: string;
    retryCount: number;
    isManual: boolean;
    isAuto: boolean;
    createdAt: string;
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
  discountPercentage?: number; // 續訂折扣
}

interface Subscription {
  id: string;
  userId: string;
  productId: string;
  startDate: string; // ISO 8601
  nextBillingDate: string; // ISO 8601
  status: 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled';
  createdAt: string; // ISO 8601
  renewalCount: number; // 續訂次數
  couponCode?: string; // 優惠碼
}

interface PaymentHistory {
  id: string;
  subscriptionId: string;
  amount: number;
  status: 'success' | 'failed';
  failureReason?: string;
  retryCount: number; // 重試次數
  isManual: boolean; // 是否手動補款
  isAuto: boolean; // 是否自動扣款
  createdAt: string; // ISO 8601
}

interface OperationLog {
  id: string;
  subscriptionId: string;
  action: string; // e.g., "cancel", "refund", "retry-payment"
  createdAt: string; // ISO 8601
}

interface Coupon {
  id: string;
  code: string;
  discountPercentage: number;
  usedBy: string[]; // 用戶ID列表
}
```

### 索引
- **subscriptions**：`userId`, `productId`, `status`, `nextBillingDate`（用於自動扣款查詢）。
- **paymentHistory**：`subscriptionId`, `retryCount`。
- **operationLogs**：`subscriptionId`。
- **coupons**：`code`（唯一）。

---

## API 規格
### 1. 建立訂閱（支援優惠碼）
- **端點**：`POST /subscriptions`
- **輸入**：
  ```json
  {
    "userId": "string",
    "productId": "string",
    "startDate": "2025-01-31",
    "cycleType": "monthly",
    "couponCode": "string"
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
      "price": 10.00,
      "discountPercentage": 0.3
    }
  ]
  ```

### 3. 執行扣款（手動或測試自動扣款）
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
    "renewalCount": 1,
    "couponCode": "string",
    "paymentHistory": [
      {
        "paymentId": "string",
        "amount": 10.00,
        "status": "success",
        "isAuto": true,
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

### 6. 申請退款
- **端點**：`PATCH /subscriptions/{subscriptionId}/refund`
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
    "status": "refunding"
  }
  ```

### 7. 手動補款
- **端點**：`POST /subscriptions/{subscriptionId}/retry-payment`
- **輸入**：
  ```json
  {
    "operatorId": "string",
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

### 8. 方案轉換
- **端點**：`PATCH /subscriptions/{subscriptionId}/switch`
- **輸入**：
  ```json
  {
    "newProductId": "string"
  }
  ```
- **輸出**：
  ```json
  {
    "subscriptionId": "string",
    "productId": "new-string",
    "nextBillingDate": "2025-12-31"
  }
  ```

---

## 非功能性需求
1. **效能**：
   - API 回應時間：< 500ms（單用戶測試）。
   - MongoDB 查詢：< 100ms（簡單查詢）。
   - 自動扣款任務：每日執行一次，處理 1000+ 訂閱。
2. **安全性**：
   - 模擬支付不涉及敏感資料，無需額外加密。
   - API 使用 HTTPS。
   - 優惠碼驗證防止重複使用。
3. **可維護性**：
   - 使用 NestJS 模組化架構，分離控制器、應用服務、領域層與儲存庫。
   - 領域模型與儲存庫分離，確保業務邏輯獨立。
4. **日誌**：
   - 使用 Pino 記錄 API 請求、錯誤、操作日誌（取消、退款、重試、自動扣款），輸出至 `app.log`。
   - 日誌格式：JSON，包含時間戳、層級、訊息。

---

## 實現細節
- **技術棧**：
  - 後端：Node.js + NestJS。
  - 資料庫：MongoDB（原生 MongoDB Driver）。
  - 支付：模擬支付服務（內部模組）。
  - 日期處理：date-fns 套件。
  - 日誌：Pino（輸出至文件）。
  - 定時任務：NestJS `@nestjs/schedule` 模組。
- **部署**：
  - 單一伺服器（Docker 容器）。
  - 環境變數管理 MongoDB 連線字串與全域設定（`REFUND_WINDOW_DAYS`、`GRACE_PERIOD_DAYS`）。
- **測試**：
  - 單元測試：優惠計算、狀態流轉、重試邏輯、自動扣款觸發（使用 Jest）。
  - 整合測試：API 端點與模擬支付。
  - 測試案例：優惠碼應用、月轉年、退款流程、3 次重試失敗進入寬限期、自動扣款成功/失敗。

---

## 限制與風險
1. **限制**：
   - 僅支援模擬支付與定時任務，無法驗證真實支付與高併發自動扣款。
   - 固定 3 次重試與 7 天寬限期，缺乏靈活性。
   - 無高可用性設計，單點故障風險。
2. **風險**：
   - 優惠碼重複使用驗證：需確保 MongoDB 事務一致性。
   - 自動扣款任務：若伺服器重啟，可能錯過扣款；需後續優化為分布式任務。
   - 退款窗口：全域設定可能無法滿足未來產品差異化需求。

---

## User Stories 對應
| Case | As a | I want | So that | 對應功能 |
|------|------|--------|---------|----------|
| 5. | 新用戶 | 使用優惠碼獲得折扣 | 我能以低成本開始 | 優惠碼機制 |
| 6. | 長期訂閱用戶 | 第二次續訂享有折扣 | 我願意繼續訂閱 | 第二次以上續訂優惠 |
| 7. | 訂閱用戶 | 轉換方案而不退費 | 我能升級方案 | 方案切換支援 |
| 8. | 訂閱用戶 | 主動取消時退款 | 我有購買保障 | 退款條件與流程 |
| 9. | 系統管理者 | 依失敗原因重試扣款 | 提升續訂成功率 | 扣款失敗重試與寬限期 |
| 10. | 客服人員 | 查詢擴展狀態與重試歷史 | 快速協助申訴 | 訂閱狀態與扣款歷史 |
| 11. | 訂閱用戶 | 系統自動按週期扣款 | 我無需手動續訂 | 自動扣款觸發 |