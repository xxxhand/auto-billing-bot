# 自動扣款機器人系統設計書 (v0.7.1)

## 1. 概述
本系統設計書基於「自動扣款機器人規格書 (v0.7.1)」編寫，詳細描述自動扣款機器人（billingBot）的系統架構、模組設計、資料流、技術選型及部署方案。系統旨在提供高效、靈活的訂閱管理、扣款處理、優惠應用及狀態追蹤，採用駝峰式命名（字首小寫），並確保未來擴充性。本版整合自動化扣款的Cron job細節，確保定期檢查與觸發扣款。

開發採用**Domain-Driven Design (DDD)** + **Test-Driven Development (TDD)** 模式：
- **DDD**：聚焦核心領域模型（如Subscription、Discount、Payment），定義聚合根（Aggregate Roots）、實體（Entities）、值物件（Value Objects）及領域服務（Domain Services），確保業務邏輯封裝在領域層。
- **TDD**：先寫單元測試，涵蓋領域模型方法、服務邏輯及邊緣案例，後續實作代碼以通過測試。

---

## 2. 系統架構

### 2.1 總體架構
系統採用微服務架構，模組化設計，確保高可用性與可擴充性。主要組成部分包括：
- **後端服務**：Node.js + NestJS，負責業務邏輯處理。
- **資料庫**：MongoDB，儲存訂閱、產品、優惠等資料。
- **任務佇列**：RabbitMQ，處理扣款重試與非同步任務。
- **支付網關**：模組化整合綠界、Stripe、PayPal。
- **自動化排程**：NestJS Schedule模組實現Cron job，定時檢查到期訂閱並觸發扣款。
- **監控與日誌**：Prometheus + Grafana，監控系統性能與扣款成功率。
- **部署**：Docker容器化，運行於AWS ECS或Kubernetes。

```mermaid
graph TD
    A[用戶] -->|REST API| B[API Gateway]
    B --> C[NestJS Service]
    C -->|MongoDB| D[資料庫]
    C -->|RabbitMQ| E[任務佇列]
    C -->|HTTP| F[支付網關: 綠界/Stripe/PayPal]
    C -->|Metrics| G[Prometheus]
    G --> H[Grafana]
    C -->|Cron Job| C
```

### 2.2 模組分解
- **訂閱管理模組**：處理訂閱週期、狀態流轉與方案轉換。
- **優惠管理模組**：管理優惠方案、優惠碼及優先級邏輯。
- **支付處理模組**：處理扣款、重試與退款。
- **日誌與監控模組**：記錄扣款歷史、異常與系統性能。
- **自動化模組**：使用Cron job定時掃描到期訂閱，推送至RabbitMQ觸發扣款。

多租戶模組及Webhook模組定義為未來擴展方向，詳見第9節。

---

## 3. 技術選型

- **後端框架**：Node.js + NestJS
  - 原因：NestJS提供模組化結構，支援TypeScript，適合DDD實現領域層與TDD測試。
- **資料庫**：MongoDB
  - 原因：靈活的NoSQL結構，適合動態領域模型。
- **任務佇列**：RabbitMQ
  - 原因：高效的訊息佇列，支援非同步任務與重試邏輯。
- **支付網關**：綠界、Stripe、PayPal
  - 原因：模組化設計，支援多種支付方式，符合在地與國際需求。
- **自動化排程**：NestJS Schedule (@nestjs/schedule)
  - 原因：輕量整合Cron job，支援定時任務如每小時檢查到期訂閱。
- **監控**：Prometheus + Grafana
  - 原因：提供實時監控與視覺化報表，追蹤扣款成功率與系統健康。
- **容器化**：Docker
  - 原因：簡化部署與環境一致性。
- **部署平台**：AWS ECS / Kubernetes
  - 原因：高可用性、自動擴展與負載平衡。

---

## 4. 資料模型設計

### 4.1 資料表設計
以下為MongoDB集合的詳細設計，包含欄位名稱、類型、是否必填、預設值及描述。

#### users 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| userId | string | Yes | - | 用戶唯一識別碼，主鍵 |
| tenantId | string | Yes | - | 租戶識別碼（未來擴充） |
| encryptedData | string | Yes | - | 加密後的用戶敏感資料（如支付資訊） |

#### products 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| productId | string | Yes | - | 產品唯一識別碼，主鍵 |
| name | string | Yes | - | 產品名稱 |
| price | number | Yes | - | 產品原價 |
| cycleType | enum["monthly", "quarterly", "yearly", "weekly", "fixedDays"] | Yes | - | 扣款週期類型 |
| cycleValue | number | No | null | 固定天數週期（如30天），僅fixedDays時有效 |
| gracePeriodDays | number | No | 7 | 寬限期天數 |

#### subscriptions 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| subscriptionId | string | Yes | - | 訂閱唯一識別碼，主鍵 |
| userId | string | Yes | - | 關聯用戶ID，外鍵 |
| productId | string | Yes | - | 關聯產品ID，外鍵 |
| status | enum["pending", "active", "grace", "cancelled", "refunding"] | Yes | "pending" | 訂閱狀態 |
| cycleType | string | Yes | - | 扣款週期類型，與產品一致 |
| startDate | date | Yes | - | 訂閱開始日期 |
| nextBillingDate | date | Yes | - | 下次扣款日期 |
| renewalCount | number | Yes | 0 | 續訂次數 |
| remainingDiscountPeriods | number | Yes | 0 | 剩餘優惠期數 |

#### discounts 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| discountId | string | Yes | - | 優惠唯一識別碼，主鍵 |
| type | enum["fixed", "percentage"] | Yes | - | 優惠類型（固定金額或百分比） |
| value | number | Yes | - | 優惠值（如100元或30%） |
| priority | number | Yes | 0 | 優惠優先級，數字越大優先 |
| startDate | date | Yes | - | 優惠開始日期 |
| endDate | date | Yes | - | 優惠結束日期 |

#### promoCodes 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| code | string | Yes | - | 優惠碼，主鍵 |
| discountId | string | Yes | - | 關聯優惠ID，外鍵 |
| usageLimit | number | No | null | 總使用次數上限（多人共用時有效） |
| isSingleUse | boolean | Yes | false | 是否僅限單人使用 |
| usedCount | number | Yes | 0 | 已使用次數 |

#### paymentAttempts 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| attemptId | string | Yes | - | 扣款嘗試唯一識別碼，主鍵 |
| subscriptionId | string | Yes | - | 關聯訂閱ID，外鍵 |
| status | enum["success", "failed", "pending"] | Yes | "pending" | 扣款狀態 |
| failureReason | string | No | null | 失敗原因（如"network_error"） |
| retryCount | number | Yes | 0 | 重試次數 |
| createdAt | date | Yes | - | 創建時間 |

#### refunds 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| refundId | string | Yes | - | 退款唯一識別碼，主鍵 |
| subscriptionId | string | Yes | - | 關聯訂閱ID，外鍵 |
| amount | number | Yes | - | 退款金額 |
| status | enum["pending", "completed", "failed"] | Yes | "pending" | 退款狀態 |
| createdAt | date | Yes | - | 創建時間 |

#### billingLogs 集合
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| logId | string | Yes | - | 日誌唯一識別碼，主鍵 |
| subscriptionId | string | Yes | - | 關聯訂閱ID，外鍵 |
| eventType | string | Yes | - | 事件類型（如"payment_attempt"） |
| details | object | Yes | {} | 事件詳細資料 |
| createdAt | date | Yes | - | 創建時間 |

#### config 集合（全域與產品級設定）
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| configId | string | Yes | - | 設定唯一識別碼，主鍵 |
| type | enum["global", "product"] | Yes | - | 設定類型 |
| productId | string | No | null | 產品ID（產品級設定時有效） |
| gracePeriodDays | number | No | 7 | 寬限期天數 |
| refundPolicy | object | No | {} | 退款政策細節 |

#### rules 集合（規則引擎）
| Name | Type | Required | Default Value | Description |
|------|------|----------|---------------|-------------|
| ruleId | string | Yes | - | 規則唯一識別碼，主鍵 |
| type | string | Yes | - | 規則類型（如"billing", "discount"） |
| conditions | object | Yes | {} | 條件邏輯 |
| actions | object | Yes | {} | 動作邏輯 |

### 4.2 ERD (Entity-Relationship Diagram)
使用Mermaid呈現核心資料集合的關係。MongoDB為NoSQL，但模擬ERD以展示聚合與參照關係。

```mermaid
erDiagram
    USERS ||--o{ SUBSCRIPTIONS : has
    PRODUCTS ||--o{ SUBSCRIPTIONS : provides
    DISCOUNTS ||--o{ PROMO_CODES : applies
    SUBSCRIPTIONS ||--o{ PAYMENT_ATTEMPTS : records
    SUBSCRIPTIONS ||--o{ REFUNDS : processes
    SUBSCRIPTIONS ||--o{ BILLING_LOGS : logs
    PRODUCTS ||--o| CONFIG : has
    CONFIG ||--o| RULES : uses

    USERS {
        string userId PK
        string tenantId
        string encryptedData
    }

    PRODUCTS {
        string productId PK
        string name
        number price
        enum cycleType
        number cycleValue
        number gracePeriodDays
    }

    SUBSCRIPTIONS {
        string subscriptionId PK
        string userId FK
        string productId FK
        enum status
        string cycleType
        date startDate
        date nextBillingDate
        number renewalCount
        number remainingDiscountPeriods
    }

    DISCOUNTS {
        string discountId PK
        enum type
        number value
        number priority
        date startDate
        date endDate
    }

    PROMO_CODES {
        string code PK
        string discountId FK
        number usageLimit
        boolean isSingleUse
        number usedCount
    }

    PAYMENT_ATTEMPTS {
        string attemptId PK
        string subscriptionId FK
        enum status
        string failureReason
        number retryCount
        date createdAt
    }

    REFUNDS {
        string refundId PK
        string subscriptionId FK
        number amount
        enum status
        date createdAt
    }

    BILLING_LOGS {
        string logId PK
        string subscriptionId FK
        string eventType
        object details
        date createdAt
    }

    CONFIG {
        string configId PK
        enum type
        string productId FK
        number gracePeriodDays
        object refundPolicy
    }

    RULES {
        string ruleId PK
        string type
        object conditions
        object actions
    }
```

### 4.3 核心領域模型設計與方法
基於DDD，定義核心聚合根（Subscription為主要聚合根），並提供領域方法。以下為TypeScript-like偽碼示例，TDD將先測試這些方法。

- **Subscription (聚合根)**：
  - 屬性：subscriptionId, userId, productId, status, cycleType, startDate, nextBillingDate, renewalCount, remainingDiscountPeriods
  - 方法：
    - `calculateNextBillingDate()`: 基於cycleType計算下次扣款日，處理大小月/閏年。
    - `applyDiscount(discount: Discount)`: 應用優惠，更新remainingDiscountPeriods並計算折扣價。
    - `convertToNewCycle(newCycleType: string)`: 方案轉換，更新cycleType並承接剩餘優惠期數。
    - `handlePaymentFailure(failureReason: string)`: 根據原因決定重試或進入寬限期，更新status。
    - `renew()`: 增加renewalCount，檢查是否適用續訂優惠。

- **Discount (實體)**：
  - 屬性：discountId, type, value, priority, startDate, endDate
  - 方法：
    - `isApplicable(now: Date)`: 檢查優惠是否在有效期內。
    - `calculateDiscountedPrice(originalPrice: number)`: 計算折扣後價格（固定或百分比）。

- **PromoCode (值物件)**：
  - 屬性：code, discountId, usageLimit, isSingleUse, usedCount
  - 方法：
    - `canBeUsed(userId: string)`: 檢查是否可使用（次數上限或單人限制）。

- **PaymentAttempt (實體)**：
  - 屬性：attemptId, subscriptionId, status, failureReason, retryCount, createdAt
  - 方法：
    - `shouldRetry()`: 基於retryCount與failureReason決定是否重試。

領域服務（Domain Services）：
- `billingService`: 協調扣款流程，整合支付網關、RabbitMQ及Cron job觸發。
- `discountPriorityService`: 處理多重優惠優先級，選擇最佳優惠。

---

## 5. API 設計

### 5.1 RESTful API（遵循OpenAPI 3.0）
- **基礎路徑**：`/api/v1`
- **認證**：JWT，包含`userId`與`tenantId`（未來擴充）。
- **主要端點**：
  - **產品管理**：
    - `GET /products`：返回可訂閱產品列表，包含即時優惠價。
  - **訂閱管理**：
    - `POST /subscriptions`：創建訂閱。
    - `GET /subscriptions/{id}`：查詢訂閱狀態。
    - `POST /subscriptions/convert`：方案轉換。
    - `POST /subscriptions/cancel`：取消訂閱並申請退款。
  - **優惠管理**：
    - `GET /discounts`：返回適用優惠列表。
    - `POST /applyPromo`：應用優惠碼。
    - `GET /userPromoCodes`：返回用戶可用優惠碼。
  - **支付管理**：
    - `POST /payments/retry`：手動補款。
  - **日誌與管理**：
    - `GET /subscriptions/{id}/history`：查詢訂閱與扣款歷史。
    - `GET /admin/logs/export`：導出CSV日誌。
  - **租戶管理（未來）**：
    - `GET /tenants/{id}/configs`：返回租戶自定義設定。

### 5.2 API 資料格式示例
- **GET /products**：
  ```json
  [
    {
      "productId": "prod_123",
      "name": "Monthly Plan",
      "price": 100,
      "discountPrice": 70,
      "cycleType": "monthly"
    }
  ]
  ```
- **GET /userPromoCodes**：
  ```json
  [
    {
      "code": "SAVE30",
      "discountId": "disc_456",
      "isSingleUse": true,
      "remainingUses": 1
    }
  ]
  ```

---

## 6. 資料流與處理流程

### 6.1 訂閱與扣款流程 (Sequence Diagram)
```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant API as NestJS API
    participant DB as MongoDB
    participant Queue as RabbitMQ
    participant Payment as Payment Gateway
    participant User

    Cron->>API: Trigger (every hour)
    API->>DB: Query active subscriptions with nextBillingDate <= now
    DB-->>API: List of subscriptions
    loop For each subscription
        API->>Queue: Enqueue Billing Task
    end
    Queue->>API: Process Task
    API->>Payment: Attempt Payment
    Payment-->>API: Success/Failure
    alt Success
        API->>DB: Update Status & Renewal Count
    else Failure
        API->>DB: Record PaymentAttempt
        alt Retryable
            API->>Queue: Enqueue Retry (1hr delay)
        else Non-Retryable
            API->>DB: Enter Grace Period (7 days)
        end
    end
    User->>API: POST /payments/retry (manual retry in grace)
    API->>Payment: Retry Payment
    Payment-->>API: Success
    API->>DB: Update Status
```

### 6.2 優惠應用流程 (Activity Diagram)
```mermaid
stateDiagram-v2
    [*] --> QueryProducts: GET /products
    QueryProducts --> CalculateDiscount: Fetch Discounts
    CalculateDiscount --> ApplyPriority: Multi-Discount? Yes
    ApplyPriority --> SelectHighest: Same Priority? Choose Highest Amount
    SelectHighest --> ReturnList: Return Discounted Prices
    QueryProducts --> ReturnList: No Discounts

    ReturnList --> ApplyPromo: POST /applyPromo
    ApplyPromo --> ValidateCode: Check PromoCode Validity
    ValidateCode --> UpdateUsed: Valid? Update usedCount
    UpdateUsed --> ApplyToSub: Apply to Subscription
    ApplyToSub --> [*]
    ValidateCode --> Invalid: Return Error
    Invalid --> [*]
```

### 6.3 退款流程 (Sequence Diagram)
```mermaid
sequenceDiagram
    participant User
    participant API as NestJS API
    participant DB as MongoDB
    participant Payment as Payment Gateway

    User->>API: POST /subscriptions/cancel
    API->>DB: Check Eligibility (Product/Global Config)
    DB-->>API: Eligible
    API->>DB: Update Status to Refunding
    API->>Payment: Request Refund
    Payment-->>API: Refund Processed
    API->>DB: Record Refund & Update Status
    API-->>User: Refund Initiated
```

---

## 7. 非功能性需求

### 7.1 性能
- **吞吐量**：支援每秒100次API請求。
- **延遲**：API回應時間<200ms（95th percentile）。
- **扣款成功率**：>99%，透過重試與寬限期實現。
- **Cron效能**：每小時掃描支援上萬筆訂閱，優化查詢索引。

### 7.2 可擴充性
- 水平擴展：NestJS服務與RabbitMQ支援多實例部署。
- 資料庫分片：MongoDB支援依業務分片。

### 7.3 可靠性
- **容錯**：支付失敗進入寬限期，RabbitMQ確保任務不丟失。
- **日誌**：所有操作記錄至`billingLogs`，支援異常追蹤。
- **備份**：MongoDB每日備份，保留7天。
- **Cron可靠性**：使用分布式鎖（如Redis）避免多實例重複執行。

---

## 8. 部署方案

### 8.1 部署架構
- **環境**：Docker容器化，運行於AWS ECS或Kubernetes。
- **負載平衡**：AWS ALB分發流量。
- **資料庫**：MongoDB Atlas，配置replica set確保高可用。
- **任務佇列**：RabbitMQ集群，支援多節點。
- **Cron job**：在NestJS服務中運行，Kubernetes確保單一實例執行。

### 8.2 CI/CD
- 使用GitHub Actions自動化建置與部署。
- 測試套件：Jest（單元測試，涵蓋TDD）+ Postman（API測試）。

### 8.3 監控與告警
- Prometheus收集NestJS服務、RabbitMQ及Cron執行指標。
- Grafana視覺化扣款成功率、API延遲與錯誤率。
- 告警：異常事件透過Slack通知，包括Cron失敗。

---

## 9. 未來擴充計劃
- **多租戶模組**：實現租戶資料隔離與自定義設定。
- **Webhook模組**：支援事件通知與外部串接。
- **通知系統**：整合email與SMS通知。
- **多語言支援**：產品描述與API回應支援多語言。
- **進階分析**：提供扣款成功率與用戶續訂行為報表。

---

## 10. 風險與緩解措施
- **風險**：支付網關失敗率高。
  - **緩解**：模組化支付網關，支援多平台備援。
- **風險**：MongoDB效能瓶頸。
  - **緩解**：索引優化與分片，定期監控查詢性能。
- **風險**：領域模型邏輯錯誤。
  - **緩解**：TDD確保方法正確性，DDD審核聚合邊界。
- **風險**：Cron job延遲或失敗。
  - **緩解**：監控Cron執行，設定重試機制，並使用分布式鎖避免重複。