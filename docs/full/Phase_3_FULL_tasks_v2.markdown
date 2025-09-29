# 自動扣款機器人任務清單 - Phase 3: Full Release (V1)

## 概述
本任務清單基於 **Phase_3_FULL_system_design_v3.md**，將 **### 8. 基礎設施與配置
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| INFRA-001 | 安裝新依賴包（@nestjs/swagger, @nestjs/jwt, redis, ioredis） | BE | 0.5 天 | 高 | 無 |
| INFRA-002 | 配置環境變數（JWT_SECRET, REDIS_URL, AES_ENCRYPTION_KEY） | BE | 1 天 | 高 | 無 |
| INFRA-003 | 設定 Redis 連線和快取配置 | BE | 1 天 | 中 | INFRA-001 |
| INFRA-004 | 建立資料庫遷移腳本（新增 coupons, rules, operation_logs 集合） | BE | 2 天 | 高 | SUB-002, COUPON-002 |
| INFRA-005 | 準備測試資料和 seed 腳本 | QA | 1 天 | 中 | INFRA-004 |
| INFRA-006 | 更新 package.json 腳本（新增 Redis 健康檢查） | BE | 0.5 天 | 中 | INFRA-003 |

---

### 9. 文檔與部署
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| DOC-001 | 更新 README.md（新功能說明、環境要求、部署步驟） | BE | 1 天 | 中 | 所有功能完成 |
| DOC-002 | 建立 API 文檔（請求響應範例、錯誤碼說明） | BE | 2 天 | 中 | API-006 |
| DOC-003 | 撰寫部署文檔（Docker 配置、環境變數、監控設定） | BE | 1 天 | 中 | INFRA-002 |
| DOC-004 | 更新 Phase 3 完成總結文檔 | BE | 1 天 | 低 | 所有任務完成 |

---

### 10. 品質保障與安全
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| QA-001 | 執行安全漏洞掃描（npm audit, Snyk） | QA | 1 天 | 高 | INFRA-001 |
| QA-002 | 設定應用監控和健康檢查端點 | BE | 1 天 | 中 | API-006 |
| QA-003 | 建立回滾計劃和緊急處理流程 | BE | 1 天 | 中 | 所有功能完成 |
| QA-004 | 效能基準測試（建立效能基準線） | QA | 1 天 | 中 | PERF-005 |
| QA-005 | 負載測試（模擬生產環境負載） | QA | 2 天 | 低 | PERF-005 |

---

### 11. 持續整合與交付
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| CI-001 | 更新 GitHub Actions 配置（Redis 測試環境） | BE | 1 天 | 中 | INFRA-003 |
| CI-002 | 新增安全掃描到 CI 流程 | QA | 1 天 | 中 | QA-001 |
| CI-003 | 設定效能回歸測試 | QA | 1 天 | 中 | QA-004 |
| CI-004 | 配置生產環境部署流程 | BE | 2 天 | 低 | DOC-003ling Bot V1** 的開發工作分解為具體任務，涵蓋優惠模組、訂閱管理、支付模組、日誌與追蹤、API 模組、錯誤處理與效能優化。假設已有基本 codebase，省略環境設置與部署相關任務。任務遵循測試驅動開發（TDD）模式，確保每個功能點先撰寫測試案例後實現功能。所有變數命名採用駝峰式（camelCase），錯誤處理使用標準化響應格式 `{ "code": number, "message": string }`。

**目標**：實現進階訂閱管理、優惠方案、多平台支付支援、API 文件化與後台管理功能，支援商業運營。  
**依賴**：POC 和 MVP 階段功能（參考 `poc-completion.md` 和 `mvp-completion.md`）。  
**預估總時程**：6-7 週（假設 3 名後端工程師、1 名測試工程師）。  
**負責角色**：後端工程師（BE）、測試工程師（QA）。

---

## 任務分解

### 1. 優惠模組
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| COUPON-001 | 撰寫 `coupon` 實體單元測試（`id`, `code`, `type`, `value`, `priority`, `validFrom`, `validUntil`, `usageLimit`, `usedBy`） | QA | 1 天 | 高 | 無 |
| COUPON-002 | 實現 `coupon` 實體，包含資料驗證（`class-validator`） | BE | 1 天 | 高 | COUPON-001 |
| COUPON-003 | 撰寫 `discount` 值物件單元測試（百分比/固定金額折扣計算） | QA | 1 天 | 高 | COUPON-001 |
| COUPON-004 | 實現 `discount` 值物件，支援百分比與固定金額計算 | BE | 1 天 | 高 | COUPON-003 |
| COUPON-005 | 撰寫 `couponService` 單元測試（優先級排序、金額比較、有效期驗證） | QA | 2 天 | 高 | COUPON-001, COUPON-003 |
| COUPON-006 | 實現 `couponService`，包含優先級邏輯（檔期 > 續訂 > 基本） | BE | 2 天 | 高 | COUPON-005 |
| COUPON-007 | 撰寫優惠碼驗證測試（一碼一人，`usageLimit` 檢查） | QA | 1 天 | 中 | COUPON-005 |
| COUPON-008 | 實現優惠碼驗證邏輯，拋出 `invalidCouponException` | BE | 1 天 | 中 | COUPON-007 |
| COUPON-009 | 撰寫續訂優惠單元測試（`renewalCount >= 1` 時套用） | QA | 1 天 | 中 | COUPON-005 |
| COUPON-010 | 實現續訂優惠邏輯，與檔期/優惠碼優先級比較 | BE | 1 天 | 中 | COUPON-009 |
| COUPON-011 | 撰寫整合測試（API 應用優惠碼，POST `/subscriptions`） | QA | 2 天 | 中 | COUPON-006, API-001 |
| COUPON-012 | 優化 `couponService` 效能，使用 Redis 快取熱門優惠 | BE | 2 天 | 低 | COUPON-006 |

---

### 2. 訂閱管理模組
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| SUB-001 | 撰寫 `subscription` 實體單元測試（`id`, `userId`, `productId`, `billingCycle`, `startDate`, `nextBillingDate`, `couponApplied`, `renewalCount`, `status`, `gracePeriodEndDate`） | QA | 1 天 | 高 | 無 |
| SUB-002 | 實現 `subscription` 實體，包含資料驗證 | BE | 1 天 | 高 | SUB-001 |
| SUB-003 | 撰寫 `billingCycle` 值物件單元測試（週期驗證） | QA | 1 天 | 高 | SUB-001 |
| SUB-004 | 實現 `billingCycle` 值物件（`weekly`, `monthly`, `quarterly`, `yearly`） | BE | 1 天 | 高 | SUB-003 |
| SUB-005 | 撰寫 `subscriptionService` 單元測試（狀態流轉、方案轉換） | QA | 2 天 | 高 | SUB-001, SUB-003 |
| SUB-006 | 實現 `subscriptionService`，包含狀態流轉（`pending → active → cancelled/gracePeriod`） | BE | 2 天 | 高 | SUB-005 |
| SUB-007 | 撰寫方案轉換測試（短期轉長期，拋出 `invalidPlanChangeException`） | QA | 1 天 | 高 | SUB-005 |
| SUB-008 | 實現方案轉換邏輯（僅支援月→年、季→年，下一週期生效） | BE | 2 天 | 高 | SUB-007 |
| SUB-009 | 撰寫 `subscriptionApplicationService` 單元測試（API 業務流程） | QA | 1 天 | 中 | SUB-005 |
| SUB-010 | 實現 `subscriptionApplicationService`，處理 API 請求 | BE | 1 天 | 中 | SUB-009 |
| SUB-011 | 撰寫整合測試（訂閱創建、方案轉換 API） | QA | 2 天 | 中 | SUB-006, SUB-008, API-001 |

---

### 3. 支付模組
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| PAY-001 | 撰寫 `paymentResult` 值物件單元測試（`success`, `reason`, `retryCount`） | QA | 1 天 | 高 | 無 |
| PAY-002 | 實現 `paymentResult` 值物件 | BE | 1 天 | 高 | PAY-001 |
| PAY-003 | 撰寫 `paymentService` 單元測試（扣款、重試、寬限期） | QA | 2 天 | 高 | PAY-001 |
| PAY-004 | 實現 `paymentService`，支援模擬支付與真實網關接口 | BE | 2 天 | 高 | PAY-003 |
| PAY-005 | 撰寫 `dailyBillingJob` 單元測試（檢查到期訂閱） | QA | 1 天 | 高 | PAY-003 |
| PAY-006 | 實現 `dailyBillingJob`，使用 `@nestjs/schedule` | BE | 1 天 | 高 | PAY-005 |
| PAY-007 | 撰寫 `retryJob` 單元測試（1 小時重試 3 次，特定失敗進入寬限期） | QA | 1 天 | 高 | PAY-003 |
| PAY-008 | 實現 `retryJob`，處理重試邏輯（`cardExpired`, `insufficientFunds` 跳過重試） | BE | 2 天 | 高 | PAY-007 |
| PAY-009 | 撰寫整合測試（模擬扣款失敗，驗證重試與寬限期） | QA | 2 天 | 中 | PAY-004, PAY-008 |
| PAY-010 | 實現支付資訊 AES-256 加密 | BE | 1 天 | 中 | PAY-004 |

---

### 4. 日誌與追蹤模組
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| LOG-001 | 撰寫 `operationLog` 實體單元測試（`id`, `subscriptionId`, `operatorId`, `action`, `timestamp`） | QA | 1 天 | 中 | 無 |
| LOG-002 | 實現 `operationLog` 實體，包含資料驗證 | BE | 1 天 | 中 | LOG-001 |
| LOG-003 | 撰寫 `operationLogRepository` 單元測試（儲存與查詢） | QA | 1 天 | 中 | LOG-001 |
| LOG-004 | 實現 `operationLogRepository`，支援日誌儲存與查詢 | BE | 1 天 | 中 | LOG-003 |
| LOG-005 | 配置 `pino` 日誌，支援結構化日誌 | BE | 1 天 | 中 | 無 |
| LOG-006 | 撰寫整合測試（記錄創建、轉換操作日誌） | QA | 1 天 | 低 | LOG-004, SUB-011 |

---

### 5. API 模組
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| API-001 | 撰寫 `subscriptionController` 整合測試（POST `/subscriptions`, GET `/subscriptions/:id`, PATCH `/subscriptions/:id/plan` 等） | QA | 3 天 | 高 | SUB-006, COUPON-006 |
| API-002 | 實現 `subscriptionController`，處理訂閱相關 API | BE | 3 天 | 高 | API-001 |
| API-003 | 撰寫 `paymentController` 整合測試（POST `/subscriptions/payments`, POST `/subscriptions/payments/manual`） | QA | 2 天 | 高 | PAY-004 |
| API-004 | 實現 `paymentController`，處理支付相關 API | BE | 2 天 | 高 | API-003 |
| API-005 | 實現 `jwtAuthGuard`，支援 JWT 認證 | BE | 1 天 | 高 | 無 |
| API-006 | 配置 Swagger 文件化，生成 `/api-docs` 端點 | BE | 1 天 | 中 | API-002, API-004 |
| API-007 | 撰寫整合測試（驗證 JWT 認證，無效 token 返回 `{ "code": 401, "message": "Unauthorized" }`） | QA | 1 天 | 中 | API-005 |

---

### 6. 錯誤處理
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| ERR-001 | 撰寫 `appExceptionFilter` 單元測試，驗證錯誤響應 `{ "code": number, "message": string }` | QA | 1 天 | 高 | 無 |
| ERR-002 | 實現 `appExceptionFilter`，處理 `invalidCouponException`, `invalidPlanChangeException`, `unauthorizedException`, `notFoundException` | BE | 1 天 | 高 | ERR-001 |
| ERR-003 | 撰寫整合測試，驗證所有 API 錯誤響應格式 | QA | 2 天 | 中 | ERR-002, API-001, API-003 |

---

### 7. 效能優化與資料清理
| 任務 ID | 任務描述 | 負責角色 | 預估時間 | 優先級 | 依賴 |
|---------|----------|----------|----------|--------|------|
| PERF-001 | 在 `subscriptions`, `products`, `coupons` 集合建立索引（`userId`, `subscriptionId`） | BE | 1 天 | 中 | SUB-002, COUPON-002 |
| PERF-002 | 配置 Redis 快取，支援產品列表與熱門優惠查詢 | BE | 2 天 | 中 | COUPON-006 |
| PERF-003 | 撰寫 `dataCleanupJob` 單元測試（清理 1 年以上資料） | QA | 1 天 | 低 | 無 |
| PERF-004 | 實現 `dataCleanupJob`，刪除過期 `paymentHistory` 和 `operationLogs` | BE | 1 天 | 低 | PERF-003 |
| PERF-005 | 撰寫效能測試，驗證 1000 並發訂閱查詢 | QA | 2 天 | 低 | PERF-001, PERF-002 |

---

## 任務執行計劃
- **總時程**：8-9 週，假設 3 名後端工程師（BE）、1 名測試工程師（QA）、1 名 DevOps 工程師（DevOps）。
- **迭代計劃**：
  - **Week 1**：基礎設施準備（INFRA-*）、優惠模組核心（COUPON-001 to COUPON-006）。
  - **Week 2-3**：訂閱管理模組（SUB-*）、支付模組（PAY-001 to PAY-008）。
  - **Week 4-5**：API 模組（API-*）、錯誤處理（ERR-*）、日誌模組（LOG-*）。
  - **Week 6**：效能優化（PERF-*）、品質保障（QA-*）。
  - **Week 7**：文檔更新（DOC-*）、CI/CD 配置（CI-*）。
  - **Week 8-9**：整合測試、效能測試、安全審查、最終部署準備。
- **每週審查**：
  - 檢查測試覆蓋率（目標 > 80%）。
  - 驗證錯誤響應格式 `{ "code": number, "message": string }`。
  - 安全掃描通過率 100%。
- **持續整合**：
  - 使用 GitHub Actions 配置，確保提交前所有測試、安全掃描通過。
  - 驗證 API 與資料庫互動的整合測試。
  - 效能回歸測試確保不下降。

---

## 結語
本任務清單為 **Auto Billing Bot V1** 提供了詳細的開發計劃，遵循 TDD 模式，確保每個功能點先撰寫測試案例。任務按模組分解，涵蓋優惠、訂閱、支付、API、日誌、錯誤處理、效能優化、基礎設施配置、文檔部署、品質保障、安全性、持續整合等完整開發流程。變數命名遵循駝峰式（camelCase），錯誤處理使用 `{ "code": number, "message": string }` 格式。開發團隊應按優先級執行任務，定期審查進度，確保穩定性和可維護性。

**補充說明**：本次更新補充了4個重要任務模組（基礎設施、文檔部署、品質保障、持續整合），使任務清單更加完整和實用，涵蓋從開發到生產部署的完整生命周期。

**開發團隊**：xxxhand  
**項目倉庫**：https://github.com/xxxhand/auto-billing-bot  
**任務清單日期**：2025年9月29日