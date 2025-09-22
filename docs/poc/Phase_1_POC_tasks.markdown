# 自動扣款機器人任務清單 - Phase 1: POC (Proof of Concept)

## 概述
**目的**：本任務清單基於 `Phase_1_POC_system_design.md`，定義自動扣款機器人 Phase 1 POC 的開發任務，實現基本訂閱與扣款邏輯，驗證技術可行性。任務涵蓋領域模型、儲存庫、應用服務、API 端點、資料庫設定、日誌、測試與部署，滿足訂閱週期計算、產品列表查詢、狀態管理、模擬支付及人工取消訂閱的需求。假設任務 1（環境與專案設置）已由現有 codebase 提供，因此移除相關任務（T1.1-T1.4）。

**範圍**：對應系統設計書的功能，包括 Subscription/Product 聚合、BillingCycle/PaymentResult 值物件、應用服務、REST API、MongoDB 集合與模擬支付。

**假設**：
- 開發環境：Node.js + NestJS、MongoDB（原生 Driver）、Pino 日誌、date-fns 日期處理，已由 codebase 提供。
- 單一伺服器部署（Docker），環境變數與連線設定完成。
- 任務分配給單一開發團隊，無並行衝突。
- 外部身份驗證系統已提供 userId。

**優先級**：
- 高：核心功能（訂閱建立、週期計算、狀態流轉、產品查詢）。
- 中：輔助功能（扣款歷史、人工取消）。
- 低：日誌與測試。

**預估總工時**：約 72 小時（假設單人開發，2-3 週）。

---

## 任務清單

### 1. 領域模型實現
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T2.1 | 實現 Subscription 聚合（id, userId, productId, startDate, nextBillingDate, status, createdAt） | 高 | 4 小時 | 無 | 訂閱扣款週期 |
| T2.2 | 實現 Subscription.calculateNextBillingDate（使用 date-fns 處理大小月/閏年） | 高 | 4 小時 | T2.1 | 訂閱扣款週期 |
| T2.3 | 實現 Subscription.activate 與 cancel 方法（狀態流轉） | 高 | 2 小時 | T2.1 | 訂閱狀態 |
| T2.4 | 實現 Product 聚合（id, name, cycleType, price） | 高 | 2 小時 | 無 | 產品唯一週期 |
| T2.5 | 實現 BillingCycle 值物件（cycleType, calculateNextDate） | 高 | 2 小時 | T2.2 | 扣款週期計算 |
| T2.6 | 實現 PaymentResult 值物件（status, failureReason） | 中 | 1 小時 | 無 | 扣款歷史 |

### 2. 儲存庫實現
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T3.1 | 實現 SubscriptionRepository（save, findById, findByUserId） | 高 | 4 小時 | T2.1 | 訂閱管理 |
| T3.2 | 實現 ProductRepository（findAll, findById） | 高 | 3 小時 | T2.4 | 產品查詢 |
| T3.3 | 實現 PaymentHistoryRepository（save, findBySubscriptionId） | 中 | 3 小時 | T2.6 | 扣款歷史 |
| T3.4 | 實現 OperationLogRepository（save） | 中 | 2 小時 | 無 | 人工介入 |

### 3. 領域與應用服務
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T4.1 | 實現 PaymentService.processPayment（模擬支付，80% 成功） | 中 | 3 小時 | T2.6 | 模擬支付 |
| T4.2 | 實現 SubscriptionService.createSubscription（驗證產品與週期） | 高 | 4 小時 | T2.1, T2.4, T2.5 | 訂閱建立 |
| T4.3 | 實現 SubscriptionService.getAvailableProducts（過濾已訂閱產品） | 高 | 3 小時 | T2.1, T2.4, T3.1, T3.2 | 產品查詢 |
| T4.4 | 實現 SubscriptionApplicationService（createSubscription, getAvailableProducts, cancelSubscription） | 高 | 4 小時 | T4.2, T4.3, T3.1 | 訂閱與產品管理 |
| T4.5 | 實現 PaymentApplicationService.processPayment | 中 | 2 小時 | T4.1, T3.3 | 模擬支付 |

### 4. REST API 端點
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T5.1 | 實現 POST /subscriptions（建立訂閱） | 高 | 3 小時 | T4.4 | 訂閱建立 |
| T5.2 | 實現 GET /products?userId={userId}（查詢產品列表） | 高 | 2 小時 | T4.4 | 產品查詢 |
| T5.3 | 實現 POST /payments（執行模擬扣款） | 中 | 2 小時 | T4.5 | 模擬支付 |
| T5.4 | 實現 GET /subscriptions/{subscriptionId}（查詢訂閱與扣款歷史） | 中 | 3 小時 | T3.1, T3.3 | 訂閱狀態與歷史 |
| T5.5 | 實現 PATCH /subscriptions/{subscriptionId}/cancel（取消訂閱） | 中 | 2 小時 | T4.4, T3.4 | 人工介入 |

### 5. 資料庫設定
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T6.1 | 設定 MongoDB 集合（users, products, subscriptions, paymentHistory, operationLogs） | 高 | 3 小時 | 無 | 資料庫 |
| T6.2 | 為 subscriptions 集合建立索引（userId, productId） | 高 | 1 小時 | T6.1 | 查詢效能 |
| T6.3 | 為 paymentHistory 集合建立索引（subscriptionId） | 中 | 1 小時 | T6.1 | 查詢效能 |
| T6.4 | 為 operationLogs 集合建立索引（subscriptionId） | 中 | 1 小時 | T6.1 | 查詢效能 |

### 6. 日誌與監控
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T7.1 | 為 API 請求與錯誤實現 Pino 日誌（JSON 格式，輸出至 app.log） | 低 | 2 小時 | 無 | 日誌 |
| T7.2 | 為人工介入操作（取消訂閱）記錄日誌 | 低 | 1 小時 | T5.5 | 人工介入 |

### 7. 測試
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T8.1 | 撰寫單元測試：Subscription.calculateNextBillingDate（含大小月/閏年案例） | 高 | 4 小時 | T2.2 | 訂閱週期 |
| T8.2 | 撰寫單元測試：Subscription.activate/cancel（狀態流轉） | 高 | 2 小時 | T2.3 | 訂閱狀態 |
| T8.3 | 撰寫單元測試：PaymentService.processPayment（模擬支付） | 中 | 2 小時 | T4.1 | 模擬支付 |
| T8.4 | 撰寫整合測試：API 端點（訂閱建立、產品查詢、扣款、取消） | 中 | 6 小時 | T5.1-T5.5 | 所有 API |
| T8.5 | 測試邊緣案例：1/31 訂閱月週期、2/28 扣款、人工取消 | 高 | 3 小時 | T8.1, T8.4 | 訂閱週期/人工介入 |

### 8. 部署與驗證
| 任務 ID | 描述 | 優先級 | 預估工時 | 依賴 | 對應功能 |
|---------|------|--------|----------|------|----------|
| T9.1 | 部署應用至 Docker 容器（單伺服器，假設環境已配置） | 低 | 2 小時 | T5.1-T5.5 | 部署 |
| T9.2 | 驗證系統功能（訂閱建立、產品查詢、扣款、取消） | 高 | 3 小時 | T9.1, T8.4 | 所有功能 |

---

## 任務總覽
- **總任務數**：24 個
- **總工時**：約 72 小時
- **優先級分佈**：
  - 高：13 個任務（約 44 小時）
  - 中：8 個任務（約 22 小時）
  - 低：3 個任務（約 5 小時）
- **建議執行順序**：
  1. 領域模型實現（T2.1-T2.6）
  2. 資料庫設定（T6.1-T6.4）
  3. 儲存庫實現（T3.1-T3.4）
  4. 領域與應用服務（T4.1-T4.5）
  5. REST API 端點（T5.1-T5.5）
  6. 日誌與監控（T7.1-T7.2）
  7. 測試（T8.1-T8.5）
  8. 部署與驗證（T9.1-T9.2）

---

## User Stories 對應
| Case | As a | I want | So that | 對應任務 |
|------|------|--------|---------|----------|
| 1. | 訂閱用戶 | 系統自動計算扣款日（處理大小月/閏年） | 我不用擔心錯誤收費 | T2.1, T2.2, T2.5, T8.1 |
| 2. | 系統管理者 | 每個產品綁定唯一週期 | 減少規則衝突 | T2.4, T3.2, T4.2 |
| 3. | 訂閱用戶 | 查詢產品列表（過濾已訂閱） | 我知道可選方案 | T2.4, T3.2, T4.3, T5.2 |
| 4. | 客服人員 | 查詢訂閱狀態與扣款歷史 | 我能定位基本問題 | T2.1, T3.1, T3.3, T5.4 |