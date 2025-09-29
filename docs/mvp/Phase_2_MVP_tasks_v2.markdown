# Phase 2 MVP 任務清單

本任務清單基於 `Phase_2_MVP_system_design_v2.md`，列出自動扣款機器人系統 Phase 2 MVP 的開發任務，涵蓋前端、後端、資料庫與測試，採用領域驅動設計（DDD）與測試驅動開發（TDD）。假設項目 2.1（設置 NestJS 環境）、3.1（配置 MongoDB 環境）、3.2（設置索引）已由現有 codebase 滿足，任務聚焦後續開發。任務按功能模組分組，包含優先級（高/中/低）、預估工時與依賴關係。

---

## 任務分組

### 1. 前端開發
#### 1.1 設置前端環境
- **任務**：初始化 React 項目，使用 Vite 構建，引入 React、ReactDOM、React Router、Axios 與 Tailwind CSS（透過 CDN）。
- **優先級**：高
- **預估工時**：4 小時
- **依賴**：無
- **產出**：Vite 項目結構，包含基本依賴與 Tailwind CSS 配置。

#### 1.2 實現通用佈局組件（Layout）
- **任務**：開發包含導航列的 Layout 組件，支援產品列表、訂閱管理與客服入口，確保響應式設計。
- **優先級**：高
- **預估工時**：6 小時
- **依賴**：1.1
- **產出**：Layout.jsx，包含導航與基本樣式。

#### 1.3 實現產品列表組件（ProductList）
- **任務**：開發 ProductList 組件，調用 `GET /products` API，顯示產品名稱、價格、週期與折扣，支援訂閱按鈕。
- **優先級**：高
- **預估工時**：8 小時
- **依賴**：1.1, 1.2, 後端 API（2.3）
- **產出**：ProductList.jsx，包含產品卡片與訂閱觸發邏輯。

#### 1.4 實現訂閱表單組件（SubscriptionForm）
- **任務**：開發 SubscriptionForm 組件，支援輸入用戶 ID、選擇產品、輸入優惠碼，調用 `POST /subscriptions` API，顯示結果通知。
- **優先級**：高
- **預估工時**：10 小時
- **依賴**：1.1, 1.2, 後端 API（2.2）
- **產出**：SubscriptionForm.jsx，包含表單驗證與錯誤處理。

#### 1.5 實現訂閱詳情組件（SubscriptionDetails）
- **任務**：開發 SubscriptionDetails 組件，調用 `GET /subscriptions/:id` API，顯示訂閱狀態、扣款歷史與操作按鈕（取消、退款、方案轉換）。
- **優先級**：高
- **預估工時**：12 小時
- **依賴**：1.1, 1.2, 後端 API（2.4, 2.6, 2.7, 2.8）
- **產出**：SubscriptionDetails.jsx，包含狀態顯示與操作邏輯。

#### 1.6 實現客服介面組件（CustomerService）
- **任務**：開發 CustomerService 組件，限制授權用戶訪問，支援查詢訂閱、取消、退款與手動補款，調用相關 API。
- **優先級**：中
- **預估工時**：10 小時
- **依賴**：1.1, 1.2, 後端 API（2.4, 2.6, 2.7, 2.8）
- **產出**：CustomerService.jsx，包含客服操作與日誌記錄。

#### 1.7 實現全局通知組件（Notification）
- **任務**：開發 Notification 組件，顯示 API 操作結果（如扣款失敗、退款成功），支持錯誤與成功提示。
- **優先級**：中
- **預估工時**：6 小時
- **依賴**：1.1
- **產出**：Notification.jsx，包含動態通知邏輯。

#### 1.8 設置路由與 Context
- **任務**：配置 React Router，實現首頁、訂閱表單、訂閱詳情與客服頁面路由；設置 AuthContext 管理用戶 ID。
- **優先級**：高
- **預估工時**：6 小時
- **依賴**：1.1, 1.2
- **產出**：App.jsx，包含路由與 Context 配置。

#### 1.9 前端單元測試
- **任務**：使用 Jest + React Testing Library 為組件撰寫單元測試，覆蓋渲染、互動與 API 請求。
- **優先級**：中
- **預估工時**：12 小時
- **依賴**：1.3, 1.4, 1.5, 1.6, 1.7, 1.8
- **產出**：測試檔案（如 ProductList.test.jsx），覆蓋核心功能。

### 2. 後端開發
#### 2.1 實現領域模型
- **任務**：實現 Subscription、Product、Coupon 聚合，BillingCycle、PaymentResult 值物件，包含行為與不變條件。
- **優先級**：高
- **預估工時**：12 小時
- **依賴**：現有 NestJS 環境與 MongoDB 設置
- **產出**：領域模型檔案（如 subscription.entity.ts），包含業務邏輯。

#### 2.2 實現 SubscriptionService
- **任務**：實現 SubscriptionService，包含創建訂閱、查詢產品、方案轉換與折扣計算邏輯。
- **優先級**：高
- **預估工時**：10 小時
- **依賴**：2.1
- **產出**：subscription.service.ts，包含核心訂閱邏輯。

#### 2.3 實現 ProductService
- **任務**：實現 ProductService，支援產品查詢與驗證。
- **優先級**：高
- **預估工時**：6 小時
- **依賴**：2.1
- **產出**：product.service.ts，包含產品管理邏輯。

#### 2.4 實現 PaymentService
- **任務**：實現 PaymentService，支援模擬支付（80% 成功率）與手動補款邏輯。
- **優先級**：高
- **預估工時**：8 小時
- **依賴**：2.1
- **產出**：payment.service.ts，包含支付模擬邏輯。

#### 2.5 實現 AutoBillingService
- **任務**：實現 AutoBillingService，使用 @nestjs/schedule 配置每日自動扣款，查詢到期訂閱並執行扣款。
- **優先級**：高
- **預估工時**：8 小時
- **依賴**：2.1, 2.2, 2.4
- **產出**：auto-billing.service.ts，包含定時任務邏輯。

#### 2.6 實現儲存庫（Repositories）
- **任務**：實現 SubscriptionRepository、ProductRepository、PaymentHistoryRepository、OperationLogRepository、CouponRepository，支援 MongoDB 存取。
- **優先級**：高
- **預估工時**：12 小時
- **依賴**：2.1
- **產出**：儲存庫檔案（如 subscription.repository.ts），包含資料存取邏輯。

#### 2.7 實現應用服務（Application Services）
- **任務**：實現 SubscriptionApplicationService、PaymentApplicationService、AutoBillingApplicationService，協調 API 與領域邏輯。
- **優先級**：高
- **預估工時**：10 小時
- **依賴**：2.2, 2.3, 2.4, 2.5, 2.6
- **產出**：應用服務檔案（如 subscription.app.service.ts）。

#### 2.8 實現 REST API 控制器
- **任務**：實現 API 端點（POST /subscriptions、GET /products、POST /payments 等），處理請求與響應。
- **優先級**：高
- **預估工時**：12 小時
- **依賴**：2.7
- **產出**：控制器檔案（如 subscription.controller.ts），包含 API 實現。

#### 2.9 實現日誌系統
- **任務**：配置 Pino 日誌，記錄 API 請求、錯誤與操作（取消、退款、重試、自動扣款），輸出至 app.log。
- **優先級**：中
- **預估工時**：4 小時
- **依賴**：現有 NestJS 環境
- **產出**：日誌配置與輸出檔案。

#### 2.10 後端單元與整合測試
- **任務**：使用 Jest 為領域模型、服務與 API 撰寫單元與整合測試，覆蓋優惠計算、狀態流轉、重試邏輯與自動扣款。
- **優先級**：中
- **預估工時**：16 小時
- **依賴**：2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8
- **產出**：測試檔案（如 subscription.service.spec.ts），覆蓋核心邏輯。

### 3. 部署與環境配置
#### 3.1 配置 Docker 環境
- **任務**：創建 Docker 配置文件，包含 NestJS 後端與 Nginx（前端靜態資源與 API 代理）。
- **優先級**：高
- **預估工時**：6 小時
- **依賴**：1.1
- **產出**：Dockerfile 與 docker-compose.yml。

#### 3.2 配置環境變數
- **任務**：設置環境變數（DEFAULT_API_ROUTER_PREFIX、DEFAULT_MONGO_URI、REFUND_WINDOW_DAYS、GRACE_PERIOD_DAYS）。
- **優先級**：高
- **預估工時**：2 小時
- **依賴**：3.1
- **產出**：.env 文件與環境變數配置。

### 4. 測試與驗證
#### 4.1 功能驗證
- **任務**：驗證核心功能：優惠碼應用、續訂折扣、方案轉換、退款、扣款重試、自動扣款。
- **優先級**：高
- **預估工時**：12 小時
- **依賴**：1.9, 2.10, 3.1
- **產出**：功能驗證報告，記錄測試結果。

#### 4.2 性能測試
- **任務**：測試 API 回應時間（< 500ms）、MongoDB 查詢（< 100ms）、自動扣款任務（1000+ 訂閱 < 5 分鐘）、前端頁面載入（< 2 秒）。
- **優先級**：中
- **預估工時**：8 小時
- **依賴**：4.1
- **產出**：性能測試報告。

---

## 總工時估計
- 前端開發：74 小時
- 後端開發：78 小時
- 部署與環境配置：8 小時
- 測試與驗證：20 小時
- **總計**：180 小時（約 22.5 個工作天，假設每日 8 小時）

---

## 任務執行順序
1. **並行初始化**：1.1（前端環境）。
2. **後端核心**：2.1（領域模型）、2.6（儲存庫）、2.2-2.5（服務）、2.7（應用服務）、2.8（API 控制器）、2.9（日誌）。
3. **前端核心**：1.2（佈局）、1.8（路由與 Context）、1.3-1.7（組件）。
4. **部署**：3.1（Docker）、3.2（環境變數）。
5. **測試**：2.10（後端測試）、1.9（前端測試）、4.1（功能驗證）、4.2（性能測試）。

---

## 注意事項
- **TDD 實踐**：每個功能開發前撰寫測試用例，遵循紅-綠-重構流程。
- **依賴管理**：確保前端與後端 API 開發同步，避免阻塞。
- **風險緩解**：
  - 使用 MongoDB 事務確保優惠碼與扣款一致性。
  - 定期檢查定時任務執行，避免遺漏。
  - 前端分頁或懶加載，應對大量訂閱數據。
- **進度跟踪**：每日更新任務狀態，使用工具（如 Jira）記錄進度與問題。