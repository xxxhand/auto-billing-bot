# 自動扣款機器人系統設計書 - Phase 2: MVP (Minimum Viable Product)

## 概述
**目的**：本系統設計書基於 `Phase_2_MVP_spec.md`，採用領域驅動設計（DDD）方法，定義自動扣款機器人 Phase 2 MVP 的系統架構與實現細節。系統在 Phase 1 POC 基礎上，新增自動扣款、優惠方案（百分比折扣與續訂優惠）、方案轉換、退款管理、扣款失敗重試與寬限期，實現最小可行產品，支援早期用戶測試與基本商業運營。開發過程結合測試驅動開發（TDD），確保代碼品質與業務邏輯正確性。

**範圍**：涵蓋自動扣款觸發、優惠碼與續訂折扣、月轉年方案切換、退款流程、扣款失敗重試、訂閱狀態與資料紀錄，忽略檔期優惠、多租戶與進階擴充。

**假設**：
- 系統運行於單一伺服器環境，無高可用性要求。
- 使用者身份由外部身份驗證系統提供（無內建認證）。
- 支付使用模擬服務，無真實支付網關。
- 資料庫使用 MongoDB，透過原生 MongoDB Driver 存取。
- 自動扣款使用 `@nestjs/schedule` 模組實現每日定時任務。

**依賴**：Phase 1 POC 功能（訂閱、產品管理、狀態流轉、模擬支付）。

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

- **前端**：React 單頁應用（SPA），使用 Tailwind CSS 進行響應式設計，支援訂閱操作、產品查詢、取消與退款申請。
- **後端**：NestJS 服務，分為應用層與領域層，處理訂閱、優惠、退款、重試與自動扣款邏輯。
- **領域層**：包含訂閱、產品、優惠、支付領域的實體、值物件與聚合。
- **儲存庫**：透過原生 MongoDB Driver 存取資料，映射領域模型。
- **模擬支付服務**：內部模組，模擬支付成功/失敗（80% 成功率）。
- **人工介入模組**：透過 REST API，支援客服取消訂閱、退款與手動補款。
- **自動扣款模組**：使用 `@nestjs/schedule` 的 `Cron` 功能，每天檢查到期訂閱並觸發扣款。

### DDD 分層架構
- **應用層**：協調領域邏輯，處理 REST API 請求與定時任務，呼叫領域服務。
- **領域層**：包含訂閱領域的核心業務邏輯（Entities、Value Objects、Aggregates、Domain Services）。
- **基礎設施層**：實現儲存庫（MongoDB Driver）、模擬支付、日誌（Pino）與定時任務。

---

## 前端設計與實現細節
### 技術棧
- **框架**：React 18（使用 JSX），透過 CDN（cdn.jsdelivr.net）引入 React、ReactDOM 與 React Router。
- **樣式**：Tailwind CSS，確保響應式設計與一致的 UI 風格。
- **狀態管理**：React Context API，管理用戶身份與訂閱狀態。
- **HTTP 客戶端**：Axios，處理與後端 REST API 的通信。
- **工具**：Vite 作為構建工具，提供快速開發與熱重載。

### 組件結構
前端採用模組化 React 組件設計，結構如下：
- **App**：根組件，設置路由與全局 Context。
- **Layout**：通用佈局，包含導航列（產品列表、訂閱管理、客服入口）。
- **ProductList**：顯示可用產品，支援篩選與訂閱按鈕。
- **SubscriptionForm**：訂閱表單，支援輸入優惠碼與選擇產品。
- **SubscriptionDetails**：顯示訂閱狀態、扣款歷史與操作按鈕（取消、退款、方案轉換）。
- **CustomerService**：客服介面，支援查詢訂閱與執行人工操作（取消、退款、手動補款）。
- **Notification**：全局通知組件，顯示操作結果（如扣款失敗、退款成功）。

### 使用者介面設計
- **設計原則**：
  - **響應式設計**：適配桌面與移動端（使用 Tailwind 的斷點，如 `sm:`, `md:`）。
  - **簡潔直觀**：清晰的按鈕與表單，減少用戶操作步驟。
  - **一致性**：統一的配色（藍白為主）與字體（Inter），確保品牌一致性。
  - **無障礙性**：支援鍵盤導航，ARIA 標籤（如 `aria-label`）提升可訪問性。
- **頁面與功能**：
  - **首頁**：展示產品列表（名稱、價格、週期、折扣），點擊「訂閱」跳轉至訂閱表單。
  - **訂閱表單**：輸入用戶 ID（由外部身份系統提供）、選擇產品、輸入優惠碼，提交後顯示訂閱 ID 與下次扣款日。
  - **訂閱詳情頁**：顯示訂閱狀態、產品資訊、扣款歷史，提供「取消訂閱」、「申請退款」、「轉換方案」按鈕。
  - **客服頁面**：僅限授權用戶訪問，支援查詢訂閱、執行取消/退款/補款，記錄操作日誌。
- **樣式範例**：
  ```jsx
  // ProductList.jsx
  function ProductList({ products, onSubscribe }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {products.map(product => (
          <div key={product.id} className="border rounded-lg p-4 shadow hover:shadow-lg">
            <h2 className="text-lg font-bold">{product.name}</h2>
            <p>價格: ${product.price}/{product.cycleType}</p>
            {product.discountPercentage && (
              <p className="text-green-600">續訂折扣: {product.discountPercentage * 100}%</p>
            )}
            <button
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => onSubscribe(product.id)}
            >
              訂閱
            </button>
          </div>
        ))}
      </div>
    );
  }
  ```

### 實現細節
- **路由**：使用 React Router 實現單頁應用導航，路由包括：
  - `/`：首頁（產品列表）。
  - `/subscribe`：訂閱表單。
  - `/subscriptions/:id`：訂閱詳情。
  - `/customer-service`：客服操作介面（限制訪問）。
- **狀態管理**：
  - 使用 Context API 儲存用戶 ID 與訂閱資料，避免 prop drilling。
  - 範例 Context：
    ```jsx
    const AuthContext = React.createContext();
    function AuthProvider({ children }) {
      const [userId, setUserId] = useState(null);
      return (
        <AuthContext.Provider value={{ userId, setUserId }}>
          {children}
        </AuthContext.Provider>
      );
    }
    ```
- **API 通信**：
  - 使用 Axios 發送請求至後端 REST API，處理錯誤並顯示通知。
  - 範例請求：
    ```jsx
    async function createSubscription(data) {
      try {
        const response = await axios.post('/client_service/api/subscriptions', data);
        return response.data;
      } catch (error) {
        throw new Error(error.response?.data?.message || '訂閱失敗');
      }
    }
    ```
- **錯誤處理**：
  - 顯示全局通知（如優惠碼無效、扣款失敗）。
  - 使用 try-catch 處理 API 錯誤，確保用戶體驗流暢。
- **部署**：
  - 前端打包為靜態檔案，部署於同一伺服器（與後端共用 Docker 容器）。
  - 使用 Nginx 提供靜態資源，代理 API 請求至 NestJS。
- **測試**：
  - 使用 Jest + React Testing Library 進行單元測試，測試組件渲染與互動。
  - 範例測試案例：
    - 產品列表渲染正確產品數量。
    - 訂閱表單提交觸發正確 API 請求。
    - 錯誤通知正確顯示。

---

## 領域模型（Domain Models）

### 1. 聚合（Aggregates）
#### 1.1 Subscription（訂閱聚合）
- **描述**：代表用戶對某產品的訂閱，包含週期計算、狀態管理、優惠應用與續訂次數，是主要聚合根。
- **實體（Entity）**：
  ```typescript
  interface Subscription {
    id: string; // 唯一識別碼
    userId: string; // 使用者ID
    productId: string; // 產品ID
    startDate: string; // 訂閱開始日（ISO 8601）
    nextBillingDate: string; // 下次扣款日（ISO 8601）
    status: 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled'; // 訂閱狀態
    createdAt: string; // 建立時間（ISO 8601）
    renewalCount: number; // 續訂次數
    couponCode?: string; // 優惠碼
    calculateNextBillingDate(): string; // 計算下次扣款日
    activate(): void; // 轉為已生效
    cancel(): void; // 取消訂閱
    requestRefund(): void; // 申請退款
    switchPlan(newProductId: string): void; // 方案轉換
    applyDiscount(): number; // 計算折扣後金額
  }
  ```
- **行為**：
  - `calculateNextBillingDate`：根據產品週期計算下次扣款日，處理大小月與閏年。
  - `activate`：首次扣款成功後，狀態從 `pending` 轉為 `active`。
  - `cancel`：人工介入取消，狀態設為 `cancelled`。
  - `requestRefund`：檢查退款條件，狀態轉為 `refunding`。
  - `switchPlan`：更新 `productId` 與 `nextBillingDate`，下期生效。
  - `applyDiscount`：根據 `renewalCount` 或 `couponCode` 計算折扣金額。
- **不變條件**：
  - `startDate` 與 `nextBillingDate` 必須為有效 ISO 8601 格式。
  - `status` 流轉遵循規則（見狀態圖）。
  - `productId` 必須對應有效產品。
  - `couponCode` 必須有效且未被該用戶使用。

#### 1.2 Product（產品聚合）
- **描述**：代表可訂閱的產品，包含週期、價格與續訂折扣資訊，是獨立聚合根。
- **實體（Entity）**：
  ```typescript
  interface Product {
    id: string; // 唯一識別碼
    name: string; // 產品名稱
    cycleType: 'monthly' | 'yearly'; // 週期類型
    price: number; // 價格
    discountPercentage?: number; // 續訂折扣百分比
  }
  ```
- **不變條件**：
  - `cycleType` 必須為 `monthly` 或 `yearly`。
  - `price` 必須為正數。
  - `discountPercentage` 必須為 0 至 1 之間（若存在）。

#### 1.3 Coupon（優惠碼聚合）
- **描述**：代表可用的優惠碼，支援一碼多人使用，記錄使用歷史。
- **實體（Entity）**：
  ```typescript
  interface Coupon {
    id: string; // 唯一識別碼
    code: string; // 優惠碼
    discountPercentage: number; // 折扣百分比
    usedBy: string[]; // 使用過的用戶ID
    isValidForUser(userId: string): boolean; // 檢查用戶是否可使用
  }
  ```
- **行為**：
  - `isValidForUser`：檢查用戶是否已使用該優惠碼。
- **不變條件**：
  - `code` 必須唯一。
  - `discountPercentage` 必須為 0 至 1 之間。

### 2. 值物件（Value Objects）
#### 2.1 BillingCycle（計費週期）
- **描述**：封裝週期計算邏輯，嵌入 Subscription。
- **結構**：
  ```typescript
  interface BillingCycle {
    cycleType: 'monthly' | 'yearly';
    calculateNextDate(currentDate: string): string; // 計算下次扣款日
  }
  ```
- **行為**：
  - `calculateNextDate`：使用 `date-fns` 計算下次扣款日，處理大小月/閏年。

#### 2.2 PaymentResult（支付結果）
- **描述**：封裝單次扣款結果，記錄於 PaymentHistory。
- **結構**：
  ```typescript
  interface PaymentResult {
    status: 'success' | 'failed';
    failureReason?: string; // 若失敗，提供原因
    retryCount: number; // 重試次數
    isManual: boolean; // 是否手動補款
    isAuto: boolean; // 是否自動扣款
  }
  ```

### 3. 領域服務（Domain Services）
#### 3.1 PaymentService
- **描述**：處理模擬支付邏輯，支援自動與手動扣款。
- **行為**：
  - `processPayment(subscriptionId: string, amount: number, isAuto: boolean): PaymentResult`：模擬支付（80% 成功，失敗原因如 `insufficient_funds`、`network_error`）。
  - `retryPayment(subscriptionId: string, amount: number): PaymentResult`：手動補款。

#### 3.2 SubscriptionService
- **描述**：協調訂閱相關邏輯，包括創建、轉換與優惠應用。
- **行為**：
  - `createSubscription(userId: string, productId: string, startDate: string, couponCode?: string): Subscription`：創建訂閱，驗證產品與優惠碼。
  - `getAvailableProducts(userId: string): Product[]`：返回未訂閱的產品。
  - `switchPlan(subscriptionId: string, newProductId: string): Subscription`：方案轉換。
  - `calculateDiscountedPrice(subscription: Subscription, product: Product): number`：計算折扣後金額。

#### 3.3 AutoBillingService
- **描述**：處理自動扣款邏輯，定時觸發。
- **行為**：
  - `triggerBilling(): void`：查詢到期訂閱，執行扣款並更新。

---

## 資料庫設計
### MongoDB 集合
#### 1. users
- **對應領域模型**：無直接實體，儲存使用者資訊。
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
    discountPercentage?: number;
  }
  ```

#### 3. subscriptions
- **對應領域模型**：Subscription 聚合。
- **結構**：
  ```typescript
  interface Subscription {
    id: string;
    userId: string;
    productId: string;
    startDate: string; // ISO 8601
    nextBillingDate: string; // ISO 8601
    status: 'pending' | 'active' | 'grace_period' | 'refunding' | 'cancelled';
    createdAt: string; // ISO 8601
    renewalCount: number;
    couponCode?: string;
  }
  ```

#### 4. paymentHistory
- **對應領域模型**：PaymentResult 值物件。
- **結構**：
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
    createdAt: string; // ISO 8601
  }
  ```

#### 5. operationLogs
- **對應領域模型**：記錄人工介入操作。
- **結構**：
  ```typescript
  interface OperationLog {
    id: string;
    subscriptionId: string;
    action: string; // e.g., "cancel", "refund", "retry-payment", "switch-plan"
    createdAt: string; // ISO 8601
  }
  ```

#### 6. coupons
- **對應領域模型**：Coupon 聚合。
- **結構**：
  ```typescript
  interface Coupon {
    id: string;
    code: string;
    discountPercentage: number;
    usedBy: string[];
  }
  ```

### 索引
- **subscriptions**：`userId`, `productId`, `status`, `nextBillingDate`（自動扣款查詢）。
- **paymentHistory**：`subscriptionId`, `retryCount`。
- **operationLogs**：`subscriptionId`。
- **coupons**：`code`（唯一）。

---

## 儲存庫（Repositories）
1. **SubscriptionRepository**：
   - `save(subscription: Subscription): Promise<void>`：儲存或更新訂閱。
   - `findById(id: string): Promise<Subscription>`：根據 ID 查詢訂閱。
   - `findByUserId(userId: string): Promise<Subscription[]>`：查詢用戶所有訂閱。
   - `findDueSubscriptions(date: string): Promise<Subscription[]>`：查詢到期訂閱（自動扣款）。
2. **ProductRepository**：
   - `findAll(): Promise<Product[]>`：查詢所有產品。
   - `findById(id: string): Promise<Product>`：根據 ID 查詢產品。
3. **PaymentHistoryRepository**：
   - `save(payment: PaymentHistory): Promise<void>`：儲存扣款記錄。
   - `findBySubscriptionId(subscriptionId: string): Promise<PaymentHistory[]>`：查詢訂閱的扣款歷史。
4. **OperationLogRepository**：
   - `save(log: OperationLog): Promise<void>`：儲存操作日誌。
5. **CouponRepository**：
   - `findByCode(code: string): Promise<Coupon>`：根據優惠碼查詢。
   - `save(coupon: Coupon): Promise<void>`：儲存或更新優惠碼。

---

## 應用服務（Application Services）
1. **SubscriptionApplicationService**：
   - `createSubscription(userId: string, productId: string, startDate: string, couponCode?: string): Promise<Subscription>`：創建訂閱，驗證優惠碼。
   - `getAvailableProducts(userId: string): Promise<Product[]>`：查詢可用產品。
   - `cancelSubscription(subscriptionId: string, operatorId: string): Promise<void>`：取消訂閱。
   - `requestRefund(subscriptionId: string, operatorId: string): Promise<void>`：申請退款。
   - `switchPlan(subscriptionId: string, newProductId: string): Promise<Subscription>`：方案轉換。
2. **PaymentApplicationService**：
   - `processPayment(subscriptionId: string, amount: number, isAuto: boolean): Promise<PaymentResult>`：執行扣款。
   - `retryPayment(subscriptionId: string, amount: number, operatorId: string): Promise<PaymentResult>`：手動補款。
3. **AutoBillingApplicationService**：
   - `triggerDailyBilling(): Promise<void>`：每日自動扣款任務。

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
   - 自動扣款任務：每日處理 1000+ 訂閱，執行時間 < 5 分鐘。
   - 前端頁面載入：< 2 秒（靜態資源經 CDN 加速）。
2. **安全性**：
   - 模擬支付不涉及敏感資料，無需額外加密。
   - API 使用 HTTPS。
   - 優惠碼驗證防止重複使用，MongoDB 事務確保一致性。
   - 前端限制客服頁面訪問，需後端驗證授權。
3. **可維護性**：
   - 使用 NestJS 模組化架構，分離控制器、應用服務、領域層與儲存庫。
   - 領域模型與儲存庫分離，確保業務邏輯獨立。
   - 前端組件模組化，支援重複使用與單元測試。
4. **日誌**：
   - 後端使用 Pino 記錄 API 請求、錯誤、操作日誌（取消、退款、重試、自動扣款），輸出至 `app.log`。
   - 前端記錄用戶操作錯誤（如表單驗證失敗）至控制台，供除錯。
   - 日誌格式：JSON，包含時間戳、層級、訊息。

---

## 開發方法
- **DDD 與 TDD 結合**：開發過程採用測試驅動開發（TDD），先為每個領域行為與應用服務撰寫失敗測試，然後實現代碼以通過測試，最後重構代碼以維持清潔性。TDD 確保業務邏輯正確性，並與 DDD 的領域模型緊密整合。
  - **TDD 流程**：
    1. **紅階段**：撰寫單元測試，預期失敗（定義預期行為）。
    2. **綠階段**：實現最小代碼以通過測試。
    3. **重構階段**：優化代碼而不改變行為，確保測試通過。
- **前端 TDD**：使用 Jest 與 React Testing Library 測試組件渲染、事件處理與 API 請求。
- **適用範圍**：應用於領域模型行為（如 `calculateNextBillingDate`、`applyDiscount`）、服務邏輯（如 `processPayment`）、自動扣款任務與前端組件。

## 實現細節
- **技術棧**：
  - **後端**：Node.js + NestJS。
  - **前端**：React 18 + Tailwind CSS + Axios + React Router + Vite。
  - **資料庫**：MongoDB（原生 MongoDB Driver）。
  - **支付**：模擬支付服務（內部模組，80% 成功率）。
  - **日期處理**：date-fns 套件。
  - **日誌**：Pino（後端，輸出至文件）、控制台（前端）。
  - **定時任務**：`@nestjs/schedule` 模組（Cron 功能）。
- **部署**：
  - 單一伺服器（Docker 容器），Nginx 提供前端靜態資源並代理後端 API。
  - 環境變數：
    ```env
    DEFAULT_API_ROUTER_PREFIX=/client_service/api
    DEFAULT_MONGO_URI=mongodb://localhost:27017/ccrc_test1
    REFUND_WINDOW_DAYS=7
    GRACE_PERIOD_DAYS=7
    ```
- **自動扣款實現**：
  - 使用 `@nestjs/schedule` 的 `@Cron('0 0 * * *')` 每日 00:00 執行。
  - 查詢 `subscriptions` 集合中 `status=active` 且 `nextBillingDate <= 當前日期` 的記錄。
  - 呼叫 `PaymentService.processPayment` 執行扣款，更新訂閱與支付歷史。
- **測試**：
  - **後端測試**：
    - 單元測試：優惠計算、狀態流轉、重試邏輯、自動扣款觸發（Jest）。
    - 整合測試：API 端點、模擬支付與自動扣款。
  - **前端測試**：
    - 單元測試：組件渲染、用戶互動、錯誤處理（Jest + React Testing Library）。
    - 範例測試案例：
      - 產品列表顯示正確價格與折扣。
      - 訂閱表單驗證無效優惠碼。
      - 訂閱詳情頁按鈕觸發正確 API 請求。
  - **測試案例**：
    - 優惠碼應用（首次扣款）。
    - 續訂優惠（第二次扣款）。
    - 月轉年方案切換。
    - 退款流程（7 天內）。
    - 自動扣款失敗，3 次重試後進入寬限期。
    - 手動補款成功/失敗。

---

## 限制與風險
1. **限制**：
   - 模擬支付與定時任務，無法驗證真實支付與高併發場景。
   - 固定 3 次重試與 7 天寬限期，缺乏靈活性。
   - 無高可用性設計，單點故障風險。
   - 前端依賴後端 API，無離線模式。
2. **風險**：
   - 優惠碼驗證：需 MongoDB 事務確保一致性。
   - 自動扣款：伺服器重啟可能錯過任務，需後續優化為分布式任務。
   - 退款窗口：全域設定可能無法滿足未來產品差異化需求。
   - 前端性能：大量訂閱數據可能影響頁面載入，需後續優化分頁或懶加載。
   - TDD 應用：初期可能增加開發時間，但提升長期品質。

---

## User Stories 對應
| Case | As a | I want | So that | 對應功能 |
|------|------|--------|---------|----------|
| 5. | 新用戶 | 使用優惠碼獲得折扣 | 我能以低成本開始 | 優惠碼機制（前端表單支援） |
| 6. | 長期訂閱用戶 | 第二次續訂享有折扣 | 我願意繼續訂閱 | 第二次以上續訂優惠 |
| 7. | 訂閱用戶 | 轉換方案而不退費 | 我能升級方案 | 方案切換支援（前端詳情頁） |
| 8. | 訂閱用戶 | 主動取消時退款 | 我有購買保障 | 退款條件與流程（前端申請按鈕） |
| 9. | 系統管理者 | 依失敗原因重試扣款 | 提升續訂成功率 | 扣款失敗重試與寬限期 |
| 10. | 客服人員 | 查詢擴展狀態與重試歷史 | 快速協助申訴 | 訂閱狀態與扣款歷史（前端客服頁面） |
| 11. | 訂閱用戶 | 系統自動按週期扣款 | 我無需手動續訂 | 自動扣款觸發 |