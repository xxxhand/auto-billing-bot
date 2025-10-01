# 自動扣款機器人規格書 (v0.7.1)

## 概述
本規格書基於「自動扣款機器人需求說明書 (v0.5)」及更新要求編寫，定義自動扣款機器人（billingBot）的功能、技術規格與實現細節。系統旨在提供靈活的訂閱管理、扣款處理、優惠應用、狀態追蹤及多租戶支援，具備未來擴充性。命名規範採用駝峰式，字首小寫。本版新增自動化扣款的Cron job細節，確保定期檢查與觸發扣款。

---

## 1. 功能規格

### 1.1 訂閱週期與扣款邏輯
- **功能描述**：
  - 支援多種扣款週期：月、季、年、週（基於曆法）及固定天數（如30天）。
  - 正確處理大小月及閏年，例：1/31訂閱，2月扣款日為2/28（或2/29），下期為3/31。
  - 每個產品綁定唯一扣款週期，不可更改。若需不同週期，定義為新產品。
  - 提供可訂閱產品列表API，顯示即時優惠價格，過濾用戶已訂閱產品。
  - 自動扣款：使用Cron job定時檢查到期訂閱，觸發扣款流程。
- **技術規格**：
  - 使用日期計算庫（如`date-fns`）處理曆法邏輯。
  - 資料庫儲存產品週期設定（`cycleType`：enum[monthly, quarterly, yearly, weekly, fixedDays]，`cycleValue`：int）。
  - Cron job設定：每小時運行一次（e.g., `0 * * * *`），查詢`nextBillingDate` <= 當前時間的active訂閱，發送至RabbitMQ佇列觸發扣款。
  - API端點：`GET /products` 返回產品列表，包含`productId`, `name`, `price`, `discountPrice`, `cycleType`。

### 1.2 優惠與方案
- **功能描述**：
  - 支援優惠方案：固定金額折扣（例：減100元）或百分比折扣（例：30% off）。
  - 優惠碼分兩類：
    - 一碼多人使用：設定總次數上限（例：100次）。
    - 一碼一人使用：每用戶限用一次，記錄使用歷史。
  - 支援第二次及以上續訂優惠，與其他優惠比較優先級。
  - 多重優惠按優先級套用，若優先級相同，選擇金額較高者。
  - 方案轉換時，新方案下個週期以原價計費，僅允許優惠碼，續訂優惠從第二次週期開始。
  - 提供API讓用戶查詢其可用的優惠碼。
- **技術規格**：
  - 資料庫表：`discounts`（`discountId`, `type`：enum[fixed, percentage], `value`, `priority`, `startDate`, `endDate`）。
  - 優惠碼表：`promoCodes`（`code`, `discountId`, `usageLimit`, `isSingleUse`, `usedCount`）。
  - 續訂計數：`subscriptions`表中新增`renewalCount`欄位。
  - API端點：
    - `POST /applyPromo` 驗證並應用優惠碼。
    - `GET /discounts` 返回適用優惠列表。
    - `GET /userPromoCodes` 返回用戶可用的優惠碼列表，包含`code`, `discountId`, `isSingleUse`, `remainingUses`。

### 1.3 方案轉換
- **功能描述**：
  - 支援方案切換（例：月轉年），下個週期生效，不退還原方案剩餘金額。
  - 原方案剩餘優惠期數承接至新方案。
- **技術規格**：
  - 資料庫表：`subscriptions`（`subscriptionId`, `userId`, `productId`, `cycleType`, `startDate`, `nextBillingDate`, `remainingDiscountPeriods`）。
  - API端點：`POST /subscriptions/convert` 更新訂閱方案。

### 1.4 退款管理
- **功能描述**：
  - 僅允許用戶主動取消時申請全額退款，退款時機依產品設定優先，否則使用全域設定。
- **技術規格**：
  - 資料庫表：`refunds`（`refundId`, `subscriptionId`, `amount`, `status`, `createdAt`）。
  - 全域退款設定儲存於`config`表，產品級退款設定儲存於`products`表。
  - API端點：`POST /subscriptions/cancel` 處理取消與退款請求。

### 1.5 扣款失敗與重試
- **功能描述**：
  - 扣款失敗依原因分類：
    - 可重試（如網路錯誤）：最多3次，每次間隔1小時。
    - 不可重試（如卡片過期、餘額不足）：直接進入7天寬限期。
  - 寬限期內用戶可手動補款，無需再重試。
- **技術規格**：
  - 資料庫表：`paymentAttempts`（`attemptId`, `subscriptionId`, `status`, `failureReason`, `retryCount`, `createdAt`）。
  - 寬限期設定儲存於`products`或`config`表（`gracePeriodDays`：default 7）。
  - 使用RabbitMQ管理重試與非同步任務，定義佇列`retryQueue`處理重試邏輯。
  - API端點：`POST /payments/retry` 處理手動補款。

### 1.6 狀態管理與資料紀錄
- **功能描述**：
  - 訂閱狀態：待生效、已生效、寬限期、已取消、退款中等，明確定義流轉規則。
  - 記錄扣款、異常、重試、人工介入等歷史。
- **技術規格**：
  - 資料庫表：`subscriptionStatus`（`subscriptionId`, `status`：enum[pending, active, grace, cancelled, refunding], `updatedAt`）。
  - 日誌表：`billingLogs`（`logId`, `subscriptionId`, `eventType`, `details`, `createdAt`）。
  - API端點：`GET /subscriptions/{id}/history` 返回訂閱與扣款歷史。

### 1.7 系統擴充性
- **功能描述**：
  - 使用策略模式或規則引擎實現扣款、優惠、重試等邏輯，支援未來擴充。
  - 支援多平台支付（綠界、Stripe、PayPal等）。
  - 提供人工介入流程處理例外。
  - 自動化扣款：整合Cron job與RabbitMQ，確保定期扣款觸發。
- **技術規格**：
  - 策略模式實現代碼結構，規則儲存於`rules`表（`ruleId`, `type`, `conditions`, `actions`）。
  - 支付模組化，使用抽象層（如`paymentGateway`介面）支援綠界、Stripe、PayPal。
  - Cron job整合：使用NestJS的@nestjs/schedule模組，定義Cron任務定時掃描到期訂閱，並推送至RabbitMQ處理扣款。
  - API端點：`POST /admin/intervention` 處理人工介入。

### 1.8 多租戶支援
- **功能描述**：
  - 支援多租戶架構，租戶間資料與規則隔離。
  - 租戶可自定義扣款週期、優惠及退款規則。
- **技術規格**：
  - 資料庫分隔：每個租戶獨立MongoDB集合，包含`tenantId`欄位。
  - API端點：`GET /tenants/{id}/configs` 返回租戶自定義設定。

### 1.9 API與資料結構
- **功能描述**：
  - 提供API支援查詢、狀態變更、異常追蹤、續訂次數及租戶識別。
- **技術規格**：
  - RESTful API設計，遵循OpenAPI 3.0規範。
  - 核心資料集合：
    - `users`（`userId`, `tenantId`, `encryptedData`）
    - `products`（`productId`, `name`, `price`, `cycleType`）
    - `subscriptions`（`subscriptionId`, `userId`, `productId`, `status`, `renewalCount`）
  - API端點示例：
    - `GET /subscriptions/{id}`：查詢訂閱狀態。
    - `POST /subscriptions`：創建訂閱。
    - `GET /userPromoCodes`：查詢用戶可用優惠碼。

### 1.10 文件化與管理後台
- **功能描述**：
  - 提供完整文件，後台支援查詢與導出紀錄。
- **技術規格**：
  - 文件使用Markdown格式，儲存於版本控制系統。
  - 後台API：`GET /admin/logs/export` 導出CSV格式日誌。

### 1.11 未來擴充
- **功能描述**：
  - 預留Webhook與通知功能，支援行銷與客服。
- **技術規格**：
  - Webhook集合：`webhooks`（`webhookId`, `tenantId`, `eventType`, `url`）。
  - API端點：`POST /webhooks` 註冊事件鉤子。
  - 支援事件：訂閱創建、扣款成功、扣款失敗等。

---

## 2. 系統架構
- **後端**：使用Node.js + NestJS框架，搭配MongoDB資料庫。
- **任務佇列**：RabbitMQ，處理重試與非同步任務，定義佇列`retryQueue`。
- **支付網關**：模組化設計，支援綠界、Stripe、PayPal等。
- **自動化**：使用NestJS Schedule模組實現Cron job，每小時檢查到期訂閱並觸發扣款。
- **部署**：Docker容器化，部署於AWS ECS或Kubernetes。
- **監控**：使用Prometheus與Grafana監控系統性能與扣款成功率。

---

## 3. 使用者故事實現
1. **訂閱用戶**：系統自動計算扣款日，處理大小月/閏年，確保無錯誤收費。
2. **系統管理者**：產品綁定唯一週期，減少規則衝突。
3. **訂閱用戶**：查詢產品列表，顯示即時優惠價，過濾已訂閱產品。
4. **新用戶**：使用優惠碼獲得折扣或免費期數，查詢可用優惠碼。
5. **營運人員**：設定優惠碼使用限制，控制推廣範圍。
6. **長期用戶**：第二次續訂享有專屬優惠，增加續訂意願。
7. **營運人員**：管理多重優惠與優先級，自動套用正確規則。
8. **訂閱用戶**：方案轉換不退費，享受長期方案優惠。
9. **訂閱用戶**：主動取消可申請退款，保障購買信心。
10. **系統管理者**：依失敗原因執行重試策略，提升扣款成功率。
11. **客服人員**：查詢訂閱狀態與扣款歷史，快速處理申訴。
12. **企業租戶**：獨立訂閱規則與資料隔離。
13. **前端工程師**：完善API整合訂閱與扣款邏輯。
14. **行銷人員**：Webhook觸發即時行銷與客服通知。

---

## 4. 未來擴充計劃
- **通知系統**：整合email與SMS通知。
- **多語言支援**：產品描述與API回應支援多語言。
- **進階分析**：提供扣款成功率與用戶續訂行為報表。