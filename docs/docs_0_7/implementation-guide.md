yarn build
yarn start:prod
yarn start:debug
yarn test
yarn test:e2e
yarn test:cov
# 自動扣款機器人實現指南（v0.7）

## 版本背景

此指南對應 `docs/docs_0_7/requirements_0.7.markdown`、`docs/docs_0_7/billingBot_v0.7.1_spec.markdown` 與 `docs/docs_0_7/billingBot_v0.7.1_system_design.markdown`，提供 v0.7 版實作的整體藍圖與落地步驟。v0.7 聚焦於「可用的訂閱扣款引擎」，涵蓋多週期訂閱、優惠優先權、扣款重試、寬限期、退款、RabbitMQ 任務佇列與 Cron 自動化。未來 v0.8 之後才會處理多租戶與 webhook 等延伸功能。

> **開發守則**：持續遵循 Domain-Driven Design（DDD）與 Test-Driven Development（TDD），所有新邏輯須先定義領域模型與測試，再補齊應用層與基礎設施。
>
> **API 測試守則**：所有 API-* 任務的端點測試必須遵循以下規範：
> - 使用 `MongoHelper` 管理測試數據庫，確保測試隔離（指定專用測試數據庫名稱，如 `'get_products'`）
> - 在 `beforeAll` 中準備 mock 數據並插入測試數據庫
> - 在 `afterAll` 中使用 `dbHelper.clear()` 清理測試數據
> - 驗證標準 API 響應格式：`{ code: 0, message: '', result: <data> }`
> - 測試業務邏輯場景：新用戶、已訂閱用戶過濾、邊界條件等
> - 使用有效的 MongoDB ObjectId 作為測試數據的 ID 字段
> - 覆蓋成功路徑、錯誤處理和業務規則驗證

## 工作指南

- 每當任務完成，務必即時更新 `docs/docs_0_7/billingBot_development_status.markdown`，並暫停後續實作，等待產品負責人審閱與下一步指示。
- 開始任何任務前，先比對 `docs/docs_0_7/billingBot_v0.7.1_system_design.markdown` 與當前程式碼實作是否一致；若發現差異需先回報並取得指示後再繼續。
- 完成任務時同步更新 `docs/docs_0_7/billingBot_v0.7.2_tasks.markdown`，確保該任務狀態反映最新進度。

## 系統藍圖

### 整體架構概覽

```
auto-billing-bot/
├── docs/
│   ├── docs_0_7/
│   │   ├── requirements_0.7.markdown
│   │   ├── billingBot_v0.7.1_spec.markdown
│   │   ├── billingBot_v0.7.1_system_design.markdown
│   │   └── billingBot_v0.7.2_tasks.markdown
│   └── implementation-guide.md ← 本文件
├── libs/
│   ├── common/        # 共享工具：日誌、錯誤、客戶端、翻譯
│   └── conf/          # 統一設定存取
├── src/
│   ├── app-components/  # Filter、Middleware、Interceptor 等橫切關注
│   ├── application/     # Controllers、Jobs、Use-cases
│   ├── domain/          # Entities、Value Objects、Domain Services
│   ├── infra/           # Repositories、ORM/ODM 模型、外部驅動整合
│   └── main.ts 等入口
├── test/                # e2e 測試與測試工具
└── resources/, logs/, tmp/...
```

- **後端框架**：NestJS + TypeScript
- **資料庫**：MongoDB（聚焦訂閱、產品、優惠與扣款紀錄）
- **任務佇列**：RabbitMQ（扣款重試、延遲任務）
- **排程**：@nestjs/schedule Cron job 每小時掃描訂閱
- **支付**：抽象 payment gateway，先以 mock 實作（成功 / 可重試 / 不可重試）
- **監控**：Prometheus + Grafana（v0.7 僅規劃，實作可延後）
- **部署**：Docker 為基礎，可對應 AWS ECS / Kubernetes

### 核心目標

- 依產品週期（monthly、quarterly、yearly、weekly、fixedDays）計算 nextBillingDate
- 支援優惠組合與優先級，推導折扣後價格
- Cron job 小時級掃描，將到期訂閱推入 RabbitMQ 進行扣款任務
- RabbitMQ retryQueue 最多重試 3 次，並支援 7 天寬限期 + 手動補款 API
- 記錄扣款嘗試、付款紀錄、退款紀錄與操作日誌
- 為未來多租戶與 webhook 預留欄位與擴展點，但不在 v0.7 交付範圍內

## 模組拆解

| 模組 | 職責 | 對應程式路徑 | 主要任務 ID |
| --- | --- | --- | --- |
| 資料模型 | 建立 MongoDB 集合、索引與 ODM | `src/infra/models`, `src/infra/repositories` | DB-001 ~ DB-011 |
| 領域層 | Subscription / Discount / PromoCode / PaymentAttempt 等核心邏輯 | `src/domain` | DDD-001 ~ DDD-010 |
| 應用層 | REST API、Use-case、工作排程 | `src/application/controllers`, `src/application/jobs` | API-001 ~ API-012, CRON-001 ~ CRON-003 |
| 支付整合 | 抽象支付介面 + mock gateway | `src/domain/services`, `libs/common` | PAY-001 ~ PAY-003 |
| 任務佇列 | 與 RabbitMQ 互動、重試、寬限期 | `src/application/jobs`, `src/infra` | QUEUE-001 ~ QUEUE-003 |
| 測試 & 文件 | 單元 / 整合 / API 測試、OpenAPI 文件 | `test/`, `docs/` | TEST-001 ~ TEST-004, DOC-001, DOC-002 |

所有任務細節請對照 `docs/docs_0_7/billingBot_v0.7.2_tasks.markdown`，依建議順序逐步完成。

## 開發路線建議

1. **資料層奠基**
  - 依任務表建立 users、products、subscriptions、discounts、promoCodes、paymentAttempts、refunds、billingLogs、config、rules 集合。
  - 加入必要索引（`nextBillingDate`, `status`, `subscriptionId` 等）以支援 Cron 掃描與報表查詢。

2. **領域模組實作（TDD 優先）**
  - Subscription 聚合根：`calculateNextBillingDate`、`applyDiscount`、`convertToNewCycle`、`handlePaymentFailure`、`renew`。
  - Discount / PromoCode / PaymentAttempt 等實體或值物件；確保測試覆蓋大小月、閏年、優惠衝突、重試次數等邊界情境。
  - BillingService、DiscountPriorityService 等領域服務封裝規則。

3. **支付抽象與佇列整合**
  - 定義 `PaymentGateway` 介面與 mock 實作（成功 / 可重試失敗 / 不可重試失敗）。
  - 建立 RabbitMQ publisher/consumer；使用延遲 exchange 或死信佇列實現 1 小時重試。

4. **應用層 API 與 Cron**
  - `GET /products`、`POST /subscriptions`、`POST /subscriptions/convert`、`POST /payments/retry` 等主要端點。
  - Cron job (`0 * * * *`) 讀取 `nextBillingDate <= now` 的訂閱，封包後丟入佇列。
  - 針對寬限期訂閱的手動補款流程：驗證 `retryCount` 與狀態再觸發支付。

5. **測試 & 文件**
  - 單元測試：覆蓋所有領域方法與支付 mock。
  - 整合測試：Cron + Queue + Payment 重試流程。
  - 端點測試：Jest e2e 或 Postman collection。
  - API 文件：以 OpenAPI 3.0 格式輸出。

## 資料模型重點

| 集合 | 關鍵欄位 | 說明 |
| --- | --- | --- |
| `users` | `userId`, `tenantId`, `encryptedData` | 預留多租戶與敏感資訊加密儲存 |
| `products` | `price`, `cycleType`, `cycleValue`, `gracePeriodDays` | 支援多種週期與產品專屬寬限期 |
| `subscriptions` | `status`, `nextBillingDate`, `renewalCount`, `remainingDiscountPeriods` | 核心聚合根資料來源 |
| `discounts` / `promoCodes` | `type`, `value`, `priority`, `usageLimit`, `isSingleUse` | 優惠組合與使用控制 |
| `paymentAttempts` | `status`, `failureReason`, `retryCount` | 重試邏輯依據 |
| `refunds` | `amount`, `status` | 取消訂閱與退款流程資料 |
| `billingLogs` | `eventType`, `details` | 紀錄扣款事件與排錯資訊 |
| `config` / `rules` | `type`, `conditions`, `actions` | 全域或產品級設定與規則引擎基礎 |

資料結構詳見系統設計書第 4 章。

## 關鍵流程

### 定時扣款流程（Cron + Queue）

1. Cron 每小時啟動，透過分布式鎖（建議 Redis）避免多實例重複執行。
2. 查詢 `status=active` 且 `nextBillingDate <= now` 的訂閱。
3. 對每筆訂閱發佈扣款任務至 RabbitMQ `billingQueue`。
4. Consumer 取出任務，呼叫 BillingService：
  - 準備支付 Context（訂閱、產品、優惠、最近一次付款結果）。
  - 呼叫支付網關。
  - 成功：更新 `nextBillingDate`、`renewalCount`、重置 `retryCount`，寫入 `billingLogs`。
  - 失敗：寫入 `paymentAttempts`，依可重試與否決定重入 queue 或進入寬限期，必要時更新 `status=grace`。

### 優惠套用流程

1. 使用者於 `POST /subscriptions` 或 `POST /applyPromo` 提供優惠碼。
2. DiscountPriorityService 依 `priority` 與折抵結果挑選最佳優惠；支援固定金額與百分比。
3. 更新 `remainingDiscountPeriods`，在續訂時遞減。

### 手動補款 / 寬限期

1. 寬限期內使用者呼叫 `POST /payments/retry`。
2. 系統檢查 `retryCount < 3` 且狀態為 `grace`，再發送扣款任務。
3. 成功後恢復 `status=active` 並刷新 `nextBillingDate`；失敗則更新 `retryCount`。

## 技術細節與最佳實務

- **配置管理**：
  - 新增 RabbitMQ、Redis、支付 API 等環境變數；集中於 `libs/conf`。
  - Cron 表達式預設 `0 * * * *`，可透過配置覆寫。

- **錯誤分類**：
  - 支付失敗需區分「可重試」（暫時性錯誤、支付網關中斷）與「不可重試」（卡片拒絕、餘額不足）。
  - 使用 `libs/common/src/err.code.ts` 定義標準錯誤碼，方便記錄與監控。

- **日誌與觀測性**：
  - 每次扣款任務需寫入 `billingLogs`，包含訂閱 ID、任務來源（Cron / 手動）、支付結果。
  - 預留 Prometheus 指標（如 `billing_success_count`、`billing_retry_count`）。

- **安全**：
  - 支付相關資料儲存於 `encryptedData`，需使用金鑰管理機制（v0.7 先以環境變數提供）。
  - API 層導入 JWT（任務 API-012），payload 至少包含 `userId`（未來擴充 `tenantId`）。

- **測試策略**：
  - 單元測試覆蓋所有領域方法（TEST-001）。
  - 整合測試模擬 Cron + Queue 流程（TEST-003），可使用 in-memory RabbitMQ mock 或測試容器。
  - API 測試確保主要端點行為（TEST-002），覆蓋成功、無效參數、無效狀態等案例。

## 環境建置與執行

1. **安裝依賴**
  ```bash
  yarn install
  ```

2. **環境變數**
  - 依 `libs/conf/src/conf.present.ts` 建立 `.env`。
  - 新增以下建議設定：
    - `RABBITMQ_URI`
    - `BILLING_QUEUE_NAME`
    - `BILLING_RETRY_EXCHANGE`
    - `CRON_BILLING_EXPRESSION`（預設 `0 * * * *`）
    - `PAYMENT_GATEWAY_MODE`（mock / sandbox）
    - `GRACE_PERIOD_DAYS`

3. **啟動服務**
  ```bash
  yarn start:dev
  ```
  需要外部 MongoDB、RabbitMQ、（可選）Redis，可透過 `docker-compose.yml` 啟動。

4. **測試**
  ```bash
  yarn test          # 單元測試
  yarn test:e2e      # e2e / API 測試
  yarn test:cov      # 覆蓋率
  ```

## 任務檢查清單（節錄）

- [ ] DB-001 ~ DB-011：完成資料集合與索引
- [ ] DDD-001 ~ DDD-010：領域模型 + 測試
- [ ] PAY-001 ~ PAY-003：支付抽象與 Mock
- [ ] CRON-001 ~ CRON-003, QUEUE-001 ~ QUEUE-003：自動化與佇列
- [ ] API-001 ~ API-012：REST API 端點
- [ ] TEST-001 ~ TEST-004, DOC-001, DOC-002：測試與文件

完成後請更新 `billingBot_v0.7.2_tasks.markdown` 狀態欄位，以追蹤剩餘工作。

## 風險與後續規劃

- **多租戶與 Webhook**：目前僅預留欄位；後續需在認證與資料層導入租戶隔離，並新增 webhook 發送器。
- **支付實連**：v0.7 僅 mock；下一階段需整合綠界 / Stripe / PayPal，落實簽章、退款與對帳。
- **監控與告警**：Prometheus / Grafana 尚未落地，待基礎流程穩定後補齊。
- **資料安全**：規劃 Key rotation、PII 匿名化與合規審查。

保持此指南與需求/設計文件同步更新，確保團隊對系統現況與工作優先順序有一致理解。