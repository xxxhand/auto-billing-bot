# 自動扣款機器人開發任務清單 (v0.7.2)

## 概述
本任務清單基於「自動扣款機器人系統設計書 (v0.7.1)」編寫，列出開發billingBot所需的具體任務，涵蓋資料庫、領域模型、API、自動化排程及任務佇列等模組。假設已有現有CODEBASE，無需環境與基礎設置。支付網關整合僅實現介面與mock邏輯，監控與日誌功能留待進階版實現。任務遵循**Domain-Driven Design (DDD)** 和 **Test-Driven Development (TDD)** 模式，採用駝峰式命名（字首小寫）。每個任務包含描述、依賴關係、完成狀態及對應的系統設計書章節。完成狀態分為：已完成、進行中、待處理。

---

## 1. 資料模型與資料庫

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| DB-001 | 建立users集合，實現userId、tenantId、encryptedData欄位 | 無 | 已完成 | 4.1 資料表設計 |
| DB-002 | 建立products集合，實現productId、name、price、cycleType等欄位 | 無 | 已完成 | 4.1 資料表設計 |
| DB-003 | 建立subscriptions集合，實現subscriptionId、userId、productId、status、cycleType、startDate、nextBillingDate、renewalCount、remainingDiscountPeriods、pendingConversion等欄位 | DB-001, DB-002 | 已完成 | 4.1 資料表設計 |
| DB-004 | 建立discounts集合，實現discountId、type、value等欄位 | 無 | 已完成 | 4.1 資料表設計 |
| DB-005 | 建立promoCodes集合，實現code、discountId、usageLimit等欄位 | DB-004 | 已完成 | 4.1 資料表設計 |
| DB-006 | 建立paymentAttempts集合，實現attemptId、subscriptionId、status等欄位 | DB-003 | 已完成 | 4.1 資料表設計 |
| DB-007 | 建立refunds集合，實現refundId、subscriptionId、amount等欄位 | DB-003 | 已完成 | 4.1 資料表設計 |
| DB-008 | 建立billingLogs集合，實現logId、subscriptionId、eventType等欄位 | DB-003 | 已完成 | 4.1 資料表設計 |
| DB-009 | 建立config集合，實現configId、type、gracePeriodDays等欄位 | 無 | 已完成 | 4.1 資料表設計 |
| DB-010 | 建立rules集合，實現ruleId、type、conditions等欄位 | 無 | 已完成 | 4.1 資料表設計 |
| DB-011 | 建立promoCodeUsages集合，實現usageId、promoCode、userId、usedAt、orderAmount等欄位 | DB-005 | 已完成 | 4.1 資料表設計 |
| DB-012 | 為所有集合添加索引，優化nextBillingDate與status查詢 | DB-001~DB-011 | 待處理 | 4.1 資料表設計, 7.1 性能 |

---

## 2. 領域模型與服務（DDD + TDD）

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| DDD-001 | 定義Subscription聚合根，實現calculateNextBillingDate方法（含TDD測試） | DB-003 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-002 | 實現Subscription.applyDiscount方法（含TDD測試） | DDD-001, DB-004 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-003 | 實現Subscription.convertToNewCycle方法（等到下個週期生效，處理費用差額，含TDD測試） | DDD-001 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-004 | 實現Subscription.handlePaymentFailure方法（含TDD測試） | DDD-001, DB-006 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-005 | 實現Subscription.renew方法（含TDD測試） | DDD-001 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-006 | 定義Discount實體，實現isApplicable與calculateDiscountedPrice方法（含TDD測試） | DB-004 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-007 | 定義PromoCode值物件，實現canBeUsed與incrementUsage方法（加入minimumAmount欄位，含TDD測試） | DB-005 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-008 | 定義PaymentAttempt實體，實現shouldRetry方法（含TDD測試） | DB-006 | 已完成 | 4.3 核心領域模型設計與方法 |
| DDD-009 | 實現promoCodeDomainService領域服務，處理優惠碼業務邏輯（用戶重複使用檢查、消費門檻驗證，含TDD測試） | DB-005, DB-011, DDD-007 | 待處理 | 4.3 核心領域模型設計與方法, 6.4 優惠碼應用流程 |
| DDD-010 | 實現billingService領域服務，整合mock支付網關與RabbitMQ（含TDD測試） | DDD-001, DDD-004, DDD-008, PAY-001 | 待處理 | 4.3 核心領域模型設計與方法, 6.1 訂閱與扣款流程 |
| DDD-011 | 實現discountPriorityService領域服務，處理多重優惠優先級（含TDD測試） | DDD-002, DDD-006 | 待處理 | 4.3 核心領域模型設計與方法, 6.2 優惠應用流程 |

---

## 3. API 實現

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| API-001 | 實現GET /products，查詢產品列表與即時優惠價 | DB-002, DDD-006, DDD-010 | 待處理 | 5.1 RESTful API, 5.2 API 資料格式示例 |
| API-002 | 實現POST /subscriptions，創建訂閱 | DB-003, DDD-001 | 待處理 | 5.1 RESTful API, 6.1 訂閱與扣款流程 |
| API-003 | 實現GET /subscriptions/{id}，查詢訂閱狀態 | DB-003, DDD-001 | 待處理 | 5.1 RESTful API |
| API-004 | 實現POST /subscriptions/convert，記錄方案轉換請求，處理費用調整（升級立即補收差額），但實際生效等到當前週期結束後的下個週期開始 | DDD-003 | 待處理 | 5.1 RESTful API, 6.1 訂閱與扣款流程 |
| API-005 | 實現POST /subscriptions/cancel，取消訂閱與退款 | DB-007, DDD-001 | 待處理 | 5.1 RESTful API, 6.3 退款流程 |
| API-006 | 實現GET /discounts，返回適用優惠列表 | DB-004, DDD-006 | 待處理 | 5.1 RESTful API, 6.2 優惠應用流程 |
| API-007 | 實現POST /applyPromo，應用優惠碼（包含消費門檻檢查、用戶重複使用檢查） | DB-005, DB-011, DDD-007, DDD-009 | 待處理 | 5.1 RESTful API, 6.4 優惠碼應用流程 |
| API-008 | 實現GET /userPromoCodes，返回用戶可用優惠碼（包含minimumAmount欄位） | DB-005, DDD-007, DDD-009 | 待處理 | 5.1 RESTful API, 5.2 API 資料格式示例 |
| API-009 | 實現GET /admin/promoCodes/{code}/usage，後台查詢優惠碼使用狀態與歷史 | DB-005, DB-011 | 待處理 | 5.1 RESTful API |
| API-010 | 實現POST /payments/retry，手動補款 | DB-006, DDD-008 | 待處理 | 5.1 RESTful API, 6.1 訂閱與扣款流程 |
| API-011 | 實現GET /subscriptions/{id}/history，查詢訂閱與扣款歷史 | DB-008 | 待處理 | 5.1 RESTful API |
| API-012 | 實現GET /admin/logs/export，導出CSV日誌 | DB-008 | 待處理 | 5.1 RESTful API |
| API-013 | 實現JWT認證，包含userId與tenantId | 無 | 待處理 | 5.1 RESTful API |

---

## 4. 自動化與任務佇列

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| CRON-001 | 實現Cron job（每小時，0 * * * *），掃描nextBillingDate <= now的訂閱 | DB-003, DDD-001 | 待處理 | 6.1 訂閱與扣款流程, 7.1 性能 |
| CRON-002 | 實現分布式鎖（如Redis），避免多實例Cron重複執行 | CRON-001 | 待處理 | 6.1 訂閱與扣款流程, 7.3 可靠性 |
| QUEUE-001 | 實現RabbitMQ retryQueue，處理扣款任務 | DDD-009 | 待處理 | 6.1 訂閱與扣款流程 |
| QUEUE-002 | 實現重試邏輯（最多3次，間隔1小時） | QUEUE-001, DDD-004 | 待處理 | 6.1 訂閱與扣款流程 |
| QUEUE-003 | 實現寬限期邏輯（7天），支援手動補款 | QUEUE-001, DDD-004, API-009 | 待處理 | 6.1 訂閱與扣款流程 |

---

## 5. 支付網關介面與Mock

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| PAY-001 | 實現支付網關抽象層（paymentGateway介面） | 無 | 待處理 | 3 技術選型, 6.1 訂閱與扣款流程 |
| PAY-002 | 實現mock支付網關，模擬成功與失敗（含網路錯誤、餘額不足等） | PAY-001 | 待處理 | 6.1 訂閱與扣款流程 |
| PAY-003 | 實現支付失敗分類與處理邏輯（可重試/不可重試，含TDD測試） | PAY-001, DDD-004 | 待處理 | 6.1 訂閱與扣款流程 |

---

## 6. 測試與文件

| 任務ID | 描述 | 依賴關係 | 狀態 | 設計書 |
|--------|------|----------|------|--------|
| TEST-001 | 為所有領域模型方法撰寫Jest單元測試 | DDD-001~DDD-011 | 待處理 | 4.3 核心領域模型設計與方法 |
| TEST-002 | 為所有API端點撰寫Postman測試 | API-001~API-013 | 待處理 | 5.1 RESTful API |
| TEST-003 | 為Cron與RabbitMQ邏輯撰寫整合測試 | CRON-001, QUEUE-001 | 待處理 | 6.1 訂閱與扣款流程 |
| TEST-004 | 為mock支付網關撰寫測試，涵蓋成功與失敗案例 | PAY-002 | 待處理 | 6.1 訂閱與扣款流程 |
| DOC-001 | 撰寫Markdown格式API文件，遵循OpenAPI 3.0 | API-001~API-013 | 待處理 | 5.1 RESTful API, 5.2 API 資料格式示例 |
| DOC-002 | 撰寫開發指南，包含領域模型與Cron實現細節 | DDD-001~DDD-010, CRON-001 | 待處理 | 4.3 核心領域模型設計與方法, 6.1 訂閱與扣款流程 |

---

## 7. 總計
- **總任務數**：30
- **狀態分布**：
  - 已完成：19個任務
  - 進行中：0個任務
  - 待處理：11個任務
- **建議開發順序**：
  1. 資料庫設置（DB-001~DB-012）
  2. 領域模型與服務（DDD-001~DDD-011）
  3. API實現（API-001~API-013）
  4. 支付網關介面與mock（PAY-001~PAY-003）
  5. 自動化與任務佇列（CRON-001~CRON-002, QUEUE-001~QUEUE-003）
  6. 測試與文件（TEST-001~TEST-004, DOC-001~DOC-002）

---

## 8. 注意事項
- **TDD實踐**：每個領域模型、API及支付mock任務需先撰寫測試，涵蓋正常、邊緣與異常案例（如大小月、閏年、優惠無效、消費門檻未達、用戶重複使用等）。
- **DDD原則**：確保業務邏輯封裝在領域層，避免應用層直接操作資料庫。Subscription為核心聚合根，控制所有訂閱相關操作。PromoCode為值物件，業務邏輯通過promoCodeDomainService處理。
- **優惠碼業務邏輯**：需實現消費門檻檢查、用戶重複使用防護及使用記錄追蹤。情境一（共用優惠碼）與情境二（獨立優惠碼）有不同驗證邏輯。
- **Cron可靠性**：分布式鎖（CRON-002）需優先實現，以避免多實例重複執行扣款任務。
- **支付模擬**：mock支付網關需模擬真實場景（成功、網路錯誤、餘額不足等），確保重試與寬限期邏輯正確。