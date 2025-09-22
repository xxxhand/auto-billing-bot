# 自動扣款機器人實現指南

## 項目概述

自動扣款機器人是基於 NestJS 的應用程式，旨在根據 `requirements_0.5.md` 中指定的需求處理自動訂閱扣款、折扣、重試和退款。此項目目前處於概念驗證 (POC) 階段，實現了基本結構，並包含可擴展以滿足完整需求的示例組件。

應用程式遵循領域驅動設計 (DDD) 原則，具有將關注點分離到庫、應用層和基礎設施的模組化架構。

## 架構

### 整體結構

```
auto-billing-bot/
├── docker-compose.yml
├── Dockerfile
├── jest-global-setup.ts
├── logrotate.conf
├── nest-cli.json
├── package.json
├── README.md
├── run-compose.sh
├── tsconfig.build.json
├── tsconfig.json
├── docs/
│   ├── requirements_0.5.md
│   ├── poc/
│   │   ├── Phase_1_POC_requirements_v1.md
│   │   ├── Phase_1_POC_spec.markdown
│   │   ├── Phase_1_POC_system_design.markdown
│   │   └── Phase_1_POC_tasks.markdown
│   └── implementation-guide.md
├── libs/
│   ├── common/
│   │   ├── tsconfig.lib.json
│   │   └── src/
│   │       ├── common.const.ts
│   │       ├── common.module.ts
│   │       ├── common.service.ts
│   │       ├── err.code.ts
│   │       ├── err.const.ts
│   │       ├── err.exception.ts
│   │       ├── index.ts
│   │       ├── clients/
│   │       │   └── async-local-storage.provider.ts
│   │       └── components/
│   │           ├── default-logger.service.ts
│   │           ├── easy-translate.service.ts
│   │           └── file.transport.ts
│   │       └── interfaces/
│   │           └── translations.interface.ts
│   └── conf/
│       ├── tsconfig.lib.json
│       └── src/
│           ├── conf.module.ts
│           ├── conf.present.ts
│           ├── conf.service.spec.ts
│           └── conf.service.ts
│           └── index.ts
├── logs/
├── resources/
│   └── langs/
│       ├── dev.json
│       └── zh-tw.json
├── src/
│   ├── app.controller.spec.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── main.ts
│   ├── app-components/
│   │   ├── app-exception.filter.ts
│   │   ├── app-tracer.middleware.ts
│   │   ├── app.initial.ts
│   │   └── single-upload-file.interceptor.ts
│   ├── application/
│   │   ├── controllers/
│   │   │   ├── exemple.controller.ts
│   │   │   └── v1.ts
│   │   └── jobs/
│   │       ├── daily-billing.ts
│   │       └── index.ts
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── base-entity.abstract.ts
│   │   │   └── example.entity.ts
│   │   └── value-objects/
│   │       └── create-example.request.ts
│   ├── infra/
│   │   ├── models/
│   │   │   ├── base-model.interface.ts
│   │   │   ├── example.model.ts
│   │   │   └── models.definition.ts
│   │   └── repositories/
│   │       └── example.repository.ts
│   └── test/
│       ├── app.e2e-spec.ts
│       ├── get-v1-examples.e2e-spec.ts
│       ├── post-v1-examples-upload.e2e-spec.ts
│       ├── post-v1-examples.e2e-spec.ts
│       └── __helpers__/
│           ├── app.helper.ts
│           ├── e2e-global-setup.ts
│           └── mongo.helper.ts
│       └── __upload-files__/
├── test/
└── tmp/
```

- **libs/**: 共享庫，用於通用功能和配置。
  - **common/**: 提供全局服務，如 MongoDB 客戶端、HTTP 客戶端、日誌記錄、翻譯和錯誤處理。
  - **conf/**: 集中式配置管理，使用環境變數。

- **src/**: 主要應用程式代碼。
  - **app-components/**: 應用程式級組件，如過濾器、中間件和攔截器。
  - **application/**: 用例層，包含控制器和任務。
  - **domain/**: 領域實體和值物件。
  - **infra/**: 基礎設施層，包含倉庫和模型。

- **test/**: 使用 Jest 的單元和端到端測試。

- **docs/**: 文檔，包括需求和此實現指南。

### 關鍵設計模式

- **DDD (領域驅動設計)**: 將領域邏輯與基礎設施分離。
- **倉庫模式**: 資料持久性的抽象。
- **依賴注入**: 由 NestJS 管理。
- **策略模式**: 計劃用於計費規則、折扣和重試（如同需求中所述）。

## 技術棧

- **框架**: NestJS (用於可擴展服務端應用程式的 Node.js 框架)
- **語言**: TypeScript
- **資料庫**: MongoDB (通過自定義 MongoDB 客戶端)
- **日誌記錄**: Pino
- **排程**: @nestjs/schedule 用於 cron 任務
- **驗證**: class-validator 和 class-transformer
- **HTTP 客戶端**: 用於外部 API 調用的自定義 HTTP 客戶端
- **測試**: 使用 e2e 測試的 Jest
- **代碼檢查/格式化**: ESLint 和 Prettier

## 主要組件

### 庫 (libs/)

#### 通用模組 (`libs/common/`)
- **CommonService**: 提供預設日誌記錄器、HTTP 客戶端和結果實例。
- **錯誤處理**: 集中式錯誤代碼和異常。
- **客戶端**: MongoDB、HTTP 和 AsyncLocalStorage 提供者。
- **組件**: 翻譯服務和檔案傳輸。

#### 配置模組 (`libs/conf/`)
- **ConfService**: 從環境變數公開配置。
- **配置介面**: 定義所有可配置參數（端口、MongoDB 設定、cron 排程等）。

### 應用層 (src/)

#### 控制器 (`src/application/controllers/`)
- **ExampleController**: 示例控制器，演示 CRUD 操作、檔案上傳和 HTTP 調用。
- API 版本控制 (v1) 和路由。

#### 任務 (`src/application/jobs/`)
- **DailyBillingJob**: 基於 cron 的每日計費執行任務（目前為佔位符）。

#### 領域層 (`src/domain/`)
- **實體**: 如 `ExampleEntity` 擴展 `BaseEntity` 的業務物件。
- **值物件**: 如 `CreateExampleRequest` 的請求 DTO。

#### 基礎設施層 (`src/infra/`)
- **倉庫**: 資料存取層（例如，用於 MongoDB 操作的 `ExampleRepository`）。
- **模型**: MongoDB 文檔介面和定義。

### 應用組件 (`src/app-components/`)
- **過濾器**: 異常處理 (`AppExceptionFilter`)。
- **中間件**: 追蹤 (`AppTracerMiddleware`)。
- **攔截器**: 檔案上傳處理 (`SingleUploadFileInterceptor`)。

## 配置

配置通過 `dotenv` 載入的環境變數進行管理。關鍵設定包括：

- **服務器**: `PORT`, `DOMAIN`
- **MongoDB**: `DEFAULT_MONGO_URI`, `DEFAULT_MONGO_DB_NAME` 等
- **上傳**: `DEFAULT_UPLOAD_TEMP_DIR`, `DEFAULT_UPLOAD_MAX_SIZE`
- **日誌記錄**: `DEFAULT_LOGGER_PATH`
- **本地化**: `LOCALES_PATH`, `FALLBACK_LOCALE`
- **排程**: `DAILY_BILLING_EXEC` (每日計費的 cron 表達式)

請參閱 `libs/conf/src/conf.present.ts` 以獲取完整的配置介面。

## 如何運行

### 先決條件
- Node.js (與 NestJS 10 相容的版本)
- MongoDB
- Yarn 或 npm

### 安裝
```bash
yarn install
```

### 環境設定
基於 `libs/conf/src/conf.present.ts` 創建 `.env` 文件，包含所需環境變數。

### 運行應用程式
```bash
# 帶監視的開發模式
yarn start:dev

# 生產建置
yarn build
yarn start:prod

# 除錯模式
yarn start:debug
```

### 運行測試
```bash
# 單元測試
yarn test

# e2e 測試
yarn test:e2e

# 測試覆蓋率
yarn test:cov
```

### Docker
項目包含 `Dockerfile` 和 `docker-compose.yml` 用於容器化部署。

## 當前實現狀態

### 已實現功能
- 具有 DDD 架構的基本 NestJS 應用程式結構。
- 使用倉庫模式的 MongoDB 整合。
- 每日計費的 cron 任務排程（佔位符）。
- 檔案上傳處理。
- 錯誤處理和日誌記錄。
- 國際化支援。
- 示例 CRUD 操作。

### 尚未實現（基於 requirements_0.5.md）
- **訂閱管理**: 產品列表、訂閱週期、計費邏輯。
- **折扣和促銷**: 優惠券代碼、促銷優惠、續訂折扣。
- **方案切換**: 升級/降級訂閱。
- **退款**: 退款處理和條件。
- **計費失敗和重試**: 失敗分類、重試邏輯、寬限期。
- **狀態管理**: 訂閱生命週期狀態。
- **多租戶**: 租戶隔離和自定義。
- **合規性**: GDPR 合規性、資料匿名化。
- **API**: 計費操作的完整 API 端點。
- **通知/Webhook**: 事件驅動通知。

## 擴展點

### 計費邏輯
- 擴展 `DailyBillingJob` 以實現實際計費計算。
- 實現不同計費週期（每月、每年等）的策略模式。
- 為訂閱、產品、付款和交易添加實體。

### 折扣和優惠券
- 為優惠券和促銷創建領域實體。
- 使用優先級處理實現折扣計算服務。
- 添加優惠券使用限制和過期的驗證。

### 重試和失敗處理
- 基於失敗類型開發重試策略。
- 實現寬限期管理。
- 添加人工干預工作流程。

### 多租戶
- 修改倉庫以包含租戶上下文。
- 更新配置以支援租戶特定設定。
- 確保租戶間的資料隔離。

### API
- 擴展訂閱管理、付款處理和報告的控制器。
- 實現適當的 DTO 和驗證。
- 添加身份驗證和授權。

### 測試
- 增加新功能的測試覆蓋率。
- 為計費工作流程添加整合測試。
- 實現高容量場景的效能測試。

## 開發指南

### 代碼風格
- 嚴格使用 TypeScript。
- 遵循 NestJS 慣例。
- 使用 ESLint 和 Prettier 確保代碼品質。

### 資料庫
- 使用 MongoDB 並進行適當索引。
- 遵循倉庫模式進行資料存取。
- 確保資料驗證和清理。

### 錯誤處理
- 使用 `libs/common/src/err.code.ts` 中的集中式錯誤代碼。
- 使用 Pino 實現適當日誌記錄。

### 安全性
- 使用 class-validator 實現輸入驗證。
- 確保敏感資料（付款、PII）的安全處理。
- 遵循 GDPR 和合規性要求。

## 未來路線圖

1. **階段 1 POC 完成**: 實現核心計費邏輯和基本 API。
2. **折扣系統**: 添加優惠券和促銷管理。
3. **重試機制**: 實現失敗處理和重試。
4. **多租戶**: 添加租戶支援。
5. **合規性**: 確保 GDPR 合規性和資料安全性。
6. **通知**: 添加 webhook 和通知系統。
7. **生產部署**: 優化可擴展性和監控。

詳細需求請參閱 `docs/requirements_0.5.md`。