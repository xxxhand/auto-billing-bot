# 自動扣款機器人開發狀態總結

**最後更新**：2025年10月22日
**當前階段**：已完成Rules實體實現，準備實現rulesEngineService
**負責人**：GitHub Copilot

## 工作指南

- 每完成一個任務（如 DB-/DDD-/API- 等編號），需立即更新本狀態文件並暫停後續實作，待產品負責人審閱與指示。
- 開始任何任務前，務必對照 `docs/docs_0_7/billingBot_v0.7.1_system_design.markdown` 與現有程式碼，確認實作方向與設計一致；若發現差異需先回報後再繼續。
- 完成任務時同步更新 `docs/docs_0_7/billingBot_v0.7.2_tasks.markdown` 的狀態欄位，保持任務清單與進度一致。

## 📋 當前任務狀態

### 進行中任務
- 無

### 已完成任務 (最近)
- ✅ **DDD-013**：實現Rules實體，處理動態業務規則（含TDD測試）（2025年10月22日）
- ✅ **DDD-012**：實現Config實體，處理全域與產品級設定（含TDD測試）（2025年10月22日）
- ✅ **PaymentAttempt 實體完善**：為 PaymentAttempt 實體添加 amount 字段，記錄每次支付嘗試的金額，並同步更新設計文件、模型接口和相關測試（2025年10月21日）
- ✅ API-014：實現POST /promoCodes/applyPromo，應用優惠碼到訂單或訂閱，支援一次性折扣與長期訂閱折扣（2025年10月21日）
- ✅ API-008：實現GET /userPromoCodes，返回用戶可用優惠碼列表（包含 minimumAmount 與 applicableProducts）（2025年10月21日）
- ✅ API-007：實現POST /discounts/{id}/apply，應用優惠到訂閱並修復折扣計算邏輯錯誤（2025年10月21日）
- ✅ API-006：實現GET /discounts，返回適用優惠列表（2025年10月20日）
- ✅ QUEUE-003：實現寬限期邏輯（7天），支援手動補款（2025年10月20日）
- ✅ API-010：實現POST /payments/retry，手動補款（2025年10月20日）
- ✅ API-005：實現POST /subscriptions/cancel，取消訂閱與退款（2025年10月19日）
- ✅ QUEUE-002：實現retry機制，最多3次重試，間隔1小時（2025年10月18日）
- ✅ CRON-002：調整daily billing cron，跳過有pendingConversion的訂閱（2025年10月18日）
- ✅ DDD-010：調整billingService.processBilling，添加CheckSubscriptionStatus、CheckPendingConversion、LoadProduct、CalculateAmount、ApplyDiscounts，符合6.3流程（2025年10月18日）
- ✅ QUEUE-001：實現RabbitMQ retryQueue，處理扣款任務（2025年10月18日）
- ✅ CRON-001：實現Cron job（每小時，0 * * * *），掃描nextBillingDate <= now的訂閱並推送BillingTask到任務佇列（2025年10月17日）
- ✅ API-004：實現POST /subscriptions/convert，記錄方案轉換請求，處理費用調整（升級立即補收差額），但實際生效等到當前週期結束後的下個週期開始（2025年10月16日）
- ✅ API-003：實現GET /subscriptions/{id}，查詢訂閱狀態（2025年10月13日）
- ✅ API-002：實現POST /subscriptions，處理用戶訂閱創建（含完整業務邏輯測試與DDD架構優化）（2025年10月13日）
- ✅ API-001：實現GET /products，查詢產品列表與即時優惠價（含完整折扣功能測試）（2025年10月8日）
- ✅ API-001：實現GET /products，查詢產品列表與即時優惠價（含完整折扣功能測試）（2025年10月8日）
- ✅ DB-012：為所有集合添加索引，優化nextBillingDate與status查詢（2025年10月8日）
- ✅ DDD-010：實現billingService領域服務，整合mock支付網關與RabbitMQ（含TDD測試）（2025年10月7日）
- ✅ PAY-004：實現訊息佇列抽象層（taskQueue介面）（2025年10月7日）
- ✅ PAY-002：實現mock支付網關，模擬成功與失敗（含網路錯誤、餘額不足等）（2025年10月7日）
- ✅ PAY-001：實現支付網關抽象層（paymentGateway介面）（2025年10月7日）
- ✅ DDD-009：實現promoCodeDomainService領域服務，處理優惠碼業務邏輯（用戶重複使用檢查、消費門檻驗證，含TDD測試）（2025年10月7日）
- ✅ DDD-008：定義PaymentAttempt實體，實現shouldRetry方法（含TDD測試）（2025年10月4日）
- ✅ DB-011：建立 `promoCodeUsages` 集合模型（實現usageId／promoCode／userId／usedAt／orderAmount欄位）（2025年10月4日）
- ✅ DDD-007：定義PromoCode值物件，實現canBeUsed方法（含TDD測試）（2025年10月4日）
- ✅ DDD-005：實現Subscription.renew方法（含TDD測試）（2025年10月4日）
- ✅ DDD-004：實現Subscription.handlePaymentFailure方法（含TDD測試）（2025年10月4日）
- ✅ DDD-003：實現Subscription.convertToNewCycle與applyPendingConversion方法（含TDD測試）（2025年10月4日）
- ✅ DB-003：建立 `subscriptions` 集合模型（實現pendingConversion欄位）（2025年10月4日）
- ✅ DDD-002：實現Subscription.applyDiscount方法（含TDD測試）（2025年10月3日）
- ✅ DDD-006：定義Discount實體，實現isApplicable與calculateDiscountedPrice方法（含TDD測試）（2025年10月3日）
- ✅ DDD-001：定義Subscription聚合根，實現calculateNextBillingDate方法（含TDD測試）（2025年10月3日）
- ✅ DB-010：建立 `rules` 集合模型（2025年10月3日）
- ✅ DB-009：建立 `config` 集合模型（2025年10月3日）
- ✅ DB-008：建立 `billingLogs` 集合模型（2025年10月3日）
- ✅ DB-007：建立 `refunds` 集合模型（2025年10月2日）
- ✅ DB-006：建立 `paymentAttempts` 集合模型（2025年10月2日）
- ✅ DB-005：建立 `promoCodes` 集合模型（2025年10月2日）
- ✅ DB-004：建立 `discounts` 集合模型（2025年10月2日）
- ✅ DB-002：建立 `products` 集合模型（2025年10月1日）
- ✅ DB-001：建立 `users` 集合模型（2025年10月1日）
- ✅ `docs/implementation-guide.md`：更新為 v0.7 實作指南（2025年10月1日）


### 待處理任務 (優先順序)
1. **DDD-014**：實現 rulesEngineService 領域服務
2. **DDD-015**：實現 configService 領域服務
3. **DDD-016**：重構 ProductsService 使用規則引擎
4. **DDD-017**：重構 BillingService 使用規則引擎
5. **API-015~API-018**：實現配置與規則管理API
6. 實作剩餘API端點（API-009~API-013）
7. 實作整合測試與文件（TEST-001~TEST-004, DOC-001~DOC-002）
8. 實現JWT認證機制

## 🔧 技術狀態

### 當前架構
- **DDD 分層**：`domain/`、`application/`、`infra/` 架構已存在，正在依 v0.7 任務逐步補齊。已實現 Subscription 聚合根（含 calculateNextBillingDate、applyDiscount、convertToNewCycle、handlePaymentFailure、renew、isGracePeriodExpired、expireGracePeriod 方法）、Discount 實體（isApplicable、isApplicableToProduct、calculateDiscountedPrice）、PromoCode 值物件（canBeUsed、incrementUsage、isApplicableToProduct）、PaymentAttempt 實體（shouldRetry，含 amount 字段記錄支付金額）、promoCodeDomainService 領域服務（優惠碼業務邏輯）、billingService 領域服務（扣款流程整合支付網關與任務隊列）、discountPriorityService 領域服務（多重優惠優先級選擇與產品適用性檢查）、paymentGateway 抽象層接口（支付網關契約）、taskQueue 抽象層接口（訊息隊列契約），並通過 TDD 測試驗證。Repository層已優化，PromoCodeUsageRepository.create方法現接收完整的PromoCodeUsage value object，符合DDD原則。**新增Config實體**：實現Config實體（處理全域與產品級設定，含寬限期管理、退款政策配置、產品適用性檢查與有效配置合併邏輯），通過TDD測試驗證。**新增Rules實體**：實現Rules實體（處理動態業務規則，含條件評估、動作執行、規則驗證、描述生成與複製功能），支援複雜的業務邏輯表達式，通過TDD測試驗證。**修復關鍵錯誤**：在Subscription實體與ISubscriptionModel介面中添加appliedDiscountId欄位，修復BillingService.processBilling邏輯錯誤（原先remainingDiscountPeriods > 0時錯誤設為amount = 0，現正確使用appliedDiscountId計算折扣價格）。**規劃中**：準備實現rulesEngineService與configService，重構ProductsService和BillingService中的硬編碼first-time subscription discount邏輯。
- **資料模型**：新增 `users` 模型（userId／tenantId／encryptedData）、`products` 模型（productId／name／price／cycleType／cycleValue／gracePeriodDays）、`subscriptions` 模型（subscriptionId／userId／productId／status／cycleType／startDate／nextBillingDate／renewalCount／remainingDiscountPeriods／appliedDiscountId／pendingConversion／gracePeriodEndDate）、`discounts` 模型（discountId／type／value／priority／startDate／endDate）、`promoCodes` 模型（code／discountId／usageLimit／isSingleUse／usedCount）、`promoCodeUsages` 模型（usageId／promoCode／userId／usedAt／orderAmount）、`paymentAttempts` 模型（attemptId／subscriptionId／status／failureReason／retryCount／amount）、`refunds` 模型（refundId／subscriptionId／amount／status）、`billingLogs` 模型（logId／subscriptionId／eventType／details）、`config` 模型（configId／type／productId／gracePeriodDays／refundPolicy）、`rules` 模型（ruleId／type／conditions／actions），並完成所有集合的索引優化（nextBillingDate、status、subscriptionId 等關鍵欄位）
- **文件**：v0.7 實作指南完成，提供模組拆解與開發順序；系統設計文檔已更新，包含寬限期邏輯流程圖與GracePeriodCheckerJob描述

### 遇到的問題與解決方案
- **PaymentAttempt 缺少 amount 字段**：在實現 BDD 測試時發現 PaymentAttempt 實體缺少 amount 字段，無法記錄每次支付嘗試的金額。解決方案：為 PaymentAttempt 實體、模型接口和 repository 添加 amount 字段，並同步更新設計文件和相關測試（2025年10月21日）
- **硬編碼的first-time subscription discount邏輯**：目前ProductsService和BillingService中存在重複的硬編碼折扣邏輯（yearly產品$1000，截止到2026/12/31），難以維護和擴展。解決方案：實現Rules和Config模型，使用規則引擎來處理動態折扣邏輯，並重構現有服務以使用規則引擎替代硬編碼邏輯（DDD-012~DDD-017，2025年10月22日）
- 尚無其他新問題，待後續任務展開時再記錄

### 環境配置
- **Node.js**：建議 v18.x（依 `package.json` 與 NestJS 相容版本）
- **MongoDB / RabbitMQ / Redis**：尚需依 `docker-compose.yml` 或環境設定啟動並驗證，未執行

## 📊 進度指標
- **總任務數**：60 項
- **已完成**：42 項（DB-001、DB-002、DB-003、DB-004、DB-005、DB-006、DB-007、DB-008、DB-009、DB-010、DB-011、DB-012、DDD-001、DDD-002、DDD-003、DDD-004、DDD-005、DDD-006、DDD-007、DDD-008、DDD-009、DDD-010、DDD-011、DDD-012、DDD-013、PAY-001、PAY-002、PAY-003、PAY-004、API-001、API-002、API-003、API-004、API-005、API-006、API-007、API-008、API-014、CRON-001、CRON-002、QUEUE-001、QUEUE-002、QUEUE-003、PaymentAttempt完善）
- **進行中**：0 項
- **待處理**：18 項

## 🎯 下一步計劃
1. **DDD-014**：實現 rulesEngineService 領域服務
   - 負責規則評估和執行邏輯
   - 整合 Rules 實體進行條件匹配和動作執行
   - 提供統一的規則引擎介面

2. **DDD-015**：實現 configService 領域服務
   - 負責配置管理邏輯
   - 整合 Config 實體進行配置驗證和應用

3. **DDD-016**：重構 ProductsService 使用規則引擎
   - 替換硬編碼的折扣邏輯
   - 使用 rulesEngineService 進行動態折扣計算

4. **DDD-017**：重構 BillingService 使用規則引擎
   - 替換硬編碼的折扣邏輯
   - 使用 rulesEngineService 進行動態折扣計算

5. **API-015~API-018**：實現配置和規則管理 API
   - 提供規則和配置的 CRUD 操作介面
