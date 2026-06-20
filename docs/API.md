# API 设计规范

## 1. 统一返回格式

成功：

```json
{
  "success": true,
  "data": {},
  "message": "ok",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

失败：

```json
{
  "success": false,
  "errorCode": "APPLE_ACCOUNT_BALANCE_NOT_ENOUGH",
  "message": "Apple ID余额不足",
  "details": {},
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

## 2. 分页参数

列表接口统一支持：

```text
page
pageSize
keyword
sortBy
sortOrder
filters
```

响应：

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "message": "ok",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

## 3. 通用接口分组

### 3.1 认证

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh
```

### 3.2 用户权限

```text
GET   /api/users
POST  /api/users
GET   /api/users/:id
PATCH /api/users/:id

GET   /api/roles
GET   /api/permissions
PUT   /api/roles/:id/permissions
```

### 3.3 操作日志

```text
GET /api/audit-logs
```

### 3.4 附件

```text
POST /api/attachments
GET  /api/attachments/:id
GET  /api/attachments/:id/download
```

上传字段：

```text
file
businessModule
objectType
objectId
purpose
remark
```

响应核心字段：

```json
{
  "id": "uuid",
  "originalName": "voucher.png",
  "storageKey": "generated-storage-key",
  "mimeType": "image/png",
  "sizeBytes": "1024",
  "businessModule": "apple",
  "objectType": "renewal_task",
  "objectId": "uuid",
  "purpose": "evidence",
  "remark": "续费凭证",
  "createdByUserId": "uuid",
  "createdAt": "2026-06-17T00:00:00.000Z"
}
```

说明：

- 列表和详情只返回附件元数据，不直接公开文件系统路径。
- 下载必须调用 `GET /api/attachments/:id/download`，需要 `attachment.download` 权限。
- 上传和下载动作都写入 `audit_logs`。

## 4. 公共模块接口

### 4.1 客户

```text
GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id
GET    /api/customers/:id/orders
GET    /api/customers/:id/activations
GET    /api/customers/:id/tasks
```

### 4.2 来源平台

```text
GET    /api/source-platforms
POST   /api/source-platforms
GET    /api/source-platforms/:id
PATCH  /api/source-platforms/:id
DELETE /api/source-platforms/:id
```

### 4.3 发货模板

说明：这里复用 `/api/message-templates` 接口，但前台入口只作为兑换码发货模板使用。兑换码业务只绑定 `type=delivery`、`channel=customer_service` 的启用模板。

```text
GET    /api/message-templates
POST   /api/message-templates
PATCH  /api/message-templates/:id
DELETE /api/message-templates/:id
POST   /api/message-templates/:id/render
```

## 5. Apple ID 模块接口

### 5.1 Apple ID 账号

```text
GET    /api/apple/accounts
POST   /api/apple/accounts
POST   /api/apple/accounts/import
GET    /api/apple/accounts/:id
PATCH  /api/apple/accounts/:id
DELETE /api/apple/accounts/:id
POST   /api/apple/accounts/:id/lock
POST   /api/apple/accounts/:id/unlock
GET    /api/apple/accounts/:id/summary
GET    /api/apple/accounts/:id/activations
GET    /api/apple/accounts/:id/tasks
```

### 5.2 敏感字段

```text
POST /api/apple/accounts/:id/reveal-password
POST /api/apple/accounts/:id/reveal-security
```

要求：

- 需要权限
- 需要写 audit log
- 返回前端后不缓存

### 5.3 余额

```text
GET  /api/apple/accounts/:id/balance-summary
GET  /api/apple/accounts/:id/topups
POST /api/apple/accounts/:id/topups
GET  /api/apple/accounts/:id/consumptions
POST /api/apple/accounts/:id/balance-adjustments
GET  /api/apple/accounts/:id/balance-adjustments
```

充值请求示例：

```json
{
  "faceValue": "100",
  "currency": "USD",
  "averageCost": "5.7",
  "costRmb": "570",
  "balanceBefore": "50",
  "balanceAfter": "150",
  "source": "supplier-a",
  "voucherRemark": "尾号1234",
  "remark": "100美元充值"
}
```

### 5.4 Apple ID 业务设置

```text
GET    /api/apple/services
POST   /api/apple/services
GET    /api/apple/services/:id
PATCH  /api/apple/services/:id
DELETE /api/apple/services/:id

GET    /api/apple/services/:id/platform-mappings
POST   /api/apple/services/:id/platform-mappings
PATCH  /api/apple/service-platform-mappings/:id
DELETE /api/apple/service-platform-mappings/:id
```

### 5.5 Apple ID 自动匹配

```text
GET /api/apple/matching/available-accounts
```

参数：

```text
serviceId
customerId
startTime
expireTime
amountRequired
currency
keyword
showUnavailable
```

当前已实现：

- `serviceId` 必填。
- `amountRequired` 不传时使用业务 `officialCostValue`。
- `currency` 不传时使用业务币种。
- `showUnavailable=true` 时返回不可用账号及原因。
- 可用性判断覆盖账号状态、手动锁定、币种、允许地区、余额、按业务锁定、全局锁定。

响应示例：

```json
{
  "items": [
    {
      "appleAccountId": "uuid",
      "accountMasked": "abc***@gmail.com",
      "region": "US",
      "currency": "USD",
      "balance": "38.00",
      "avgUnitCost": "5.600000",
      "status": "normal",
      "availability": "available",
      "reason": null
    },
    {
      "appleAccountId": "uuid",
      "accountMasked": "test***@gmail.com",
      "region": "US",
      "currency": "USD",
      "balance": "10.00",
      "avgUnitCost": "5.700000",
      "status": "normal",
      "availability": "unavailable",
      "reason": "余额不足，需要20 USD，当前10 USD"
    }
  ]
}
```

### 5.6 Apple ID 订单

```text
GET    /api/apple/orders
POST   /api/apple/orders
GET    /api/apple/orders/:id
```

创建订单时要：

- 校验客户
- 校验业务
- 校验 Apple ID 是否可用
- 校验余额
- 应用锁定规则
- 生成开通记录
- 生成 Apple ID 消费记录
- 扣减 Apple ID 余额和余额成本
- 计算 `appleCostRmb` 和 `profitAmount`
- 生成 Apple ID 锁定记录
- 写 audit log

后续待实现：

- `PATCH /api/apple/orders/:id`
- `POST /api/apple/orders/:id/confirm`
- `POST /api/apple/orders/:id/cancel`
- 生成余额消费记录
- 生成锁定记录
- 计算利润
- 写 audit log

### 5.7 开通记录

```text
GET   /api/apple/activations
GET   /api/apple/activations/:id
PATCH /api/apple/activations/:id
POST  /api/apple/activations/:id/mark-expired
POST  /api/apple/activations/:id/mark-cancelled
```

当前已实现：

- `GET /api/apple/activations`
- `GET /api/apple/activations/:id`

列表查询参数：

```text
page
pageSize
keyword
status
customerId
appleAccountId
serviceId
sourcePlatformId
autoRenewStatus
renewalDecision
expireFrom
expireTo
```

返回字段包括客户、订单、Apple ID 脱敏账号、业务、开通/到期时间、到期天数、消耗金额、成本、利润、自动续费状态和续费决定。

后续待实现：

- `PATCH /api/apple/activations/:id`
- `POST /api/apple/activations/:id/mark-expired`
- `POST /api/apple/activations/:id/mark-cancelled`

### 5.8 续费任务

```text
GET   /api/apple/renewal-tasks
POST  /api/apple/renewal-tasks
GET   /api/apple/renewal-tasks/:id
PATCH /api/apple/renewal-tasks/:id
POST  /api/apple/renewal-tasks/:id/complete
POST  /api/apple/renewal-tasks/:id/cancel
POST  /api/apple/renewal-tasks/:id/postpone
POST  /api/apple/renewal-tasks/generate-due-tasks
```

当前已实现第一版续费任务中心，接口权限：

- 查看：`apple.renewal_task.view`
- 创建、更新、完成、取消、延期、生成：`apple.renewal_task.update`

列表查询参数：

| 参数             | 说明                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page/pageSize    | 分页                                                                                                                                                                            |
| keyword          | 搜索标题、动作、备注、客户、业务、订单号、Apple ID                                                                                                                              |
| status           | pending/processing/waiting_customer/waiting_payment/waiting_auto_renewal/completed/cancelled/failed/abnormal/postponed                                                          |
| taskType         | contact_customer/remind_customer_reply/confirm_payment/check_balance/topup_apple_balance/cancel_subscription/change_plan/wait_auto_renewal/check_renewal_result/handle_abnormal |
| priority         | low/medium/high/urgent                                                                                                                                                          |
| customerDecision | not_contacted/contacted_waiting_reply/confirmed_renewal/confirmed_no_renewal/change_plan/considering/paid/unpaid/cancelled/renewed_success/abnormal                             |
| customerId       | 客户 ID                                                                                                                                                                         |
| appleAccountId   | Apple ID ID                                                                                                                                                                     |
| serviceId        | Apple ID 业务 ID                                                                                                                                                                |
| activationId     | 开通记录 ID                                                                                                                                                                     |
| assignedToUserId | 负责人 ID                                                                                                                                                                       |
| dueFrom/dueTo    | 截止时间范围                                                                                                                                                                    |

`POST /api/apple/renewal-tasks/generate-due-tasks`

请求：

```json
{
  "daysAhead": 3,
  "now": "2026-07-07T00:00:00.000Z"
}
```

说明：

- 默认扫描未来 3 天内到期的 active 开通记录。
- 客户未确认时生成联系客户任务，临近到期可生成催回复和人工验证风险任务。
- 客户确认不续费时生成取消订阅任务。
- 客户确认续费或换套餐时生成收款确认、检查余额、待充值续费或等待自动续费、检查续费结果任务。
- 生成逻辑幂等：同一开通记录、同一任务类型、未完成状态下不会重复创建。

返回：

```json
{
  "scannedActivations": 12,
  "createdCount": 8,
  "updatedCount": 4,
  "daysAhead": 3,
  "rangeEnd": "2026-07-10T00:00:00.000Z"
}
```

任务响应主要字段：

| 字段                 | 说明                                              |
| -------------------- | ------------------------------------------------- |
| id                   | 任务 ID                                           |
| taskType             | 任务类型                                          |
| title                | 任务标题                                          |
| status               | 任务状态                                          |
| priority             | 优先级                                            |
| customerDecision     | 客户续费决定                                      |
| customer             | 客户摘要                                          |
| appleAccount         | Apple ID 脱敏摘要                                 |
| service              | 业务摘要                                          |
| activation           | 开通记录摘要和 daysUntilExpire                    |
| order                | 订单摘要                                          |
| currentBalance       | 当前余额，Decimal 字符串                          |
| expectedChargeAmount | 预计扣费，Decimal 字符串                          |
| suggestedTopupAmount | 建议充值，Decimal 字符串                          |
| dueAt/remindAt       | 截止和提醒时间                                    |
| note/resultNote      | 任务备注和处理结果                                |
| evidenceAttachmentId | 凭证附件 ID，通过附件上传接口创建后关联到续费任务 |

### 5.9 Apple ID 操作计划

```text
GET  /api/apple/action-plans
POST /api/apple/action-plans/generate
GET  /api/apple/action-plans/:id
GET  /api/apple/action-plans/:id/items
POST /api/apple/action-plans/:id/complete
```

当前已实现第一版 Apple ID 操作计划，接口权限：

- 查看：`apple.action_plan.view`
- 生成、完成：`apple.action_plan.update`

列表查询参数：

| 参数                    | 说明                                  |
| ----------------------- | ------------------------------------- |
| page/pageSize           | 分页                                  |
| keyword                 | 搜索 Apple ID、客户、业务、计划备注   |
| status                  | pending/processing/completed/abnormal |
| appleAccountId          | Apple ID ID                           |
| hasWrongChargeRisk      | true/false                            |
| planDateFrom/planDateTo | 计划日期范围                          |

`POST /api/apple/action-plans/generate`

请求：

```json
{
  "daysAhead": 7,
  "now": "2026-07-07T00:00:00.000Z"
}
```

说明：

- 默认扫描未来 7 天内到期的 active 开通记录。
- 按 `apple_account_id + plan_date` 幂等生成，每个 Apple ID 每天最多一个主计划。
- 重新生成会刷新主计划并重建明细项，不重复堆积历史明细。
- 明细动作类型：renew、cancel、change_plan、wait_customer。
- 建议充值 = max(0, 预计续费金额 - Apple ID 当前余额)。

误扣费风险判定：

- 客户确认不续费，且 autoRenewStatus 不是 disabled。
- 客户未确认，autoRenewStatus 为 enabled，且距离到期小于等于 1 天。

返回：

```json
{
  "scannedActivations": 12,
  "accountCount": 3,
  "createdCount": 2,
  "updatedCount": 1,
  "itemCount": 9,
  "daysAhead": 7,
  "planDate": "2026-07-07T00:00:00.000Z",
  "rangeEnd": "2026-07-14T00:00:00.000Z"
}
```

计划响应主要字段：

| 字段                  | 说明                         |
| --------------------- | ---------------------------- |
| appleAccount          | Apple ID 脱敏摘要            |
| currentBalance        | 当前余额，Decimal 字符串     |
| avgUnitCost           | 当前平均成本，Decimal 字符串 |
| activeServiceCount    | 当前账号开通中业务数         |
| renewServicesCount    | 需要续费或换套餐的业务数     |
| cancelServicesCount   | 需要取消订阅的业务数         |
| pendingCustomerCount  | 等待客户确认的业务数         |
| requiredRenewalAmount | 预计续费金额，Decimal 字符串 |
| suggestedTopupAmount  | 建议充值金额，Decimal 字符串 |
| hasWrongChargeRisk    | 是否存在误扣费风险           |
| items                 | 详情接口返回操作计划明细     |

### 5.10 Apple ID 自动化任务

```text
GET  /api/apple/automation-tasks
POST /api/apple/automation-tasks
GET  /api/apple/automation-tasks/:id
GET  /api/apple/automation-tasks/:id/logs
POST /api/apple/automation-tasks/:id/run-placeholder
POST /api/apple/automation-tasks/:id/cancel
POST /api/apple/automation-tasks/:id/retry
POST /api/apple/automation-tasks/:id/mark-manual
POST /api/apple/automation-tasks/:id/result
```

说明：

- 查询余额、检测状态第一版使用系统当前快照完成占位执行。
- 自动充值、取消订阅、修改手机号、修改密保、检查续费在真实 Worker 接入前返回 `waiting_manual_verify`。
- `inputPayloadEncrypted` 仅服务端加密保存，不在列表和详情接口返回明文。
- `resultPayload` 用于记录自动化或人工回写结果。

### 5.11 Apple ID 报表

```text
GET /api/apple/reports/accounts
GET /api/apple/reports/balances
GET /api/apple/reports/topups
GET /api/apple/reports/consumptions
GET /api/apple/reports/activations
GET /api/apple/reports/expiring
GET /api/apple/reports/renewal-pending
GET /api/apple/reports/cancel-pending
GET /api/apple/reports/waiting-auto-renewal
GET /api/apple/reports/profit
GET /api/apple/reports/abnormal
```

## 6. 兑换码模块接口

### 6.1 兑换码业务

```text
GET    /api/codes/services
POST   /api/codes/services
GET    /api/codes/services/:id
PATCH  /api/codes/services/:id
DELETE /api/codes/services/:id
```

### 6.2 平台商品映射

```text
GET    /api/codes/platform-mappings
POST   /api/codes/platform-mappings
PATCH  /api/codes/platform-mappings/:id
DELETE /api/codes/platform-mappings/:id
```

### 6.3 批量导入

```text
POST /api/codes/batches/import
GET  /api/codes/batches
GET  /api/codes/batches/:id
GET  /api/codes/batches/:id/errors
```

### 6.4 库存

```text
GET  /api/codes/inventory
GET  /api/codes/inventory/:id
POST /api/codes/inventory/:id/reveal
POST /api/codes/inventory/:id/void
```

查看完整兑换码需要权限并写 audit log。

### 6.5 平台订单

```text
GET  /api/codes/orders
POST /api/codes/orders/manual
GET  /api/codes/orders/:id
POST /api/codes/orders/:id/match-code
POST /api/codes/orders/:id/deliver
POST /api/codes/orders/:id/mark-manual
```

### 6.6 发货记录

```text
GET /api/codes/deliveries
GET /api/codes/deliveries/:id
```

### 6.7 售后补发

```text
GET  /api/codes/after-sales
POST /api/codes/after-sales
POST /api/codes/after-sales/:id/reissue
POST /api/codes/after-sales/:id/complete
```

### 6.8 报表

```text
GET /api/codes/reports/inventory
GET /api/codes/reports/batches
GET /api/codes/reports/taobao-deliveries
GET /api/codes/reports/xianyu-deliveries
GET /api/codes/reports/delivery-failed
GET /api/codes/reports/after-sales
GET /api/codes/reports/profit
GET /api/codes/reports/platform-profit
```

## 7. 平台适配接口

### 7.1 淘宝

```text
POST /api/platforms/taobao/sync-orders
GET  /api/platforms/taobao/orders/:externalOrderNo
POST /api/platforms/taobao/orders/:id/deliver
POST /api/platforms/taobao/sync-refunds
POST /api/platforms/taobao/poll
```

### 7.2 闲鱼

```text
POST /api/platforms/xianyu/sync-orders
GET  /api/platforms/xianyu/orders/:externalOrderNo
POST /api/platforms/xianyu/orders/:id/deliver
POST /api/platforms/xianyu/sync-refunds
POST /api/platforms/xianyu/poll
POST /api/platforms/poll-all
```

### 7.3 手工发货

```text
POST /api/platforms/manual/orders/:id/deliver
```

### 7.4 平台轮询任务

`POST /api/platforms/:platform/poll` 和 `POST /api/platforms/poll-all` 用于触发平台订单/退款轮询任务。

请求参数：

```json
{
  "includeOrders": true,
  "includeRefunds": true,
  "trigger": "manual"
}
```

说明：

- `trigger` 支持 `manual`、`cron`、`worker`、`system`。
- 轮询执行会写入 `cron_job_logs`、`platform_sync_logs` 和 `audit_logs`。
- 后台 Worker 默认关闭；生产环境可通过 `PLATFORM_POLL_ENABLED=true`、`PLATFORM_POLL_INTERVAL_MS=300000` 启用。
- 当前淘宝/闲鱼真实开放平台适配器尚未接入，轮询会明确记录失败/不支持状态；真实 OAuth、签名、同步和发货逻辑接入后复用同一套日志链路。

## 8. 错误码建议

### Apple ID

- APPLE_ACCOUNT_NOT_FOUND
- APPLE_ACCOUNT_LOCKED
- APPLE_ACCOUNT_STATUS_NOT_NORMAL
- APPLE_ACCOUNT_REGION_NOT_MATCH
- APPLE_ACCOUNT_CURRENCY_NOT_MATCH
- APPLE_ACCOUNT_BALANCE_NOT_ENOUGH
- APPLE_ACCOUNT_LOCK_RULE_CONFLICT
- APPLE_BALANCE_SUMMARY_NOT_FOUND
- APPLE_AVG_COST_CALCULATION_ERROR

### 续费任务

- RENEWAL_TASK_NOT_FOUND
- RENEWAL_TASK_STATUS_INVALID
- ACTION_PLAN_NOT_FOUND
- ACTION_PLAN_HAS_UNFINISHED_ITEMS

### 兑换码

- REDEEM_CODE_NOT_FOUND
- REDEEM_CODE_DUPLICATED
- REDEEM_CODE_NOT_ENOUGH
- REDEEM_CODE_ALREADY_DELIVERED
- CODE_ORDER_ALREADY_DELIVERED
- CODE_ORDER_NOT_PAID
- CODE_ORDER_REFUNDING
- CODE_DELIVERY_FAILED

### 权限

- AUTH_INVALID_TOKEN
- AUTH_NO_PERMISSION
- SENSITIVE_FIELD_PERMISSION_DENIED

## 9. Apple ID 充值礼品卡代码接口补充

Apple ID 充值接口需要支持礼品卡代码字段。

### 9.1 创建充值记录

```text
POST /api/apple/accounts/:id/topups
```

请求体补充字段：

```json
{
  "giftCardCode": "完整礼品卡代码，可选"
}
```

规则：

- 后端计算 `gift_card_code_hash`。
- 后端检测重复。
- 完整礼品卡代码加密保存。
- 默认响应只返回 `giftCardCodeTail`。
- 不返回完整礼品卡代码。

### 9.2 查看完整礼品卡代码

```text
POST /api/apple/topups/:id/reveal-gift-card-code
```

请求体：

```json
{
  "reason": "售后核对充值代码"
}
```

响应：

```json
{
  "topupId": "uuid",
  "appleAccountId": "uuid",
  "giftCardCode": "完整礼品卡代码",
  "giftCardCodeTail": "1234",
  "revealedAt": "2026-06-17T00:00:00.000Z"
}
```

要求：

- 需要 `apple.topup.gift_code.view_full` 权限。
- 必须写审计日志。
- 请求必须填写查看原因。
- 审计日志 action 为 `apple_topup.gift_card_code.reveal`。
- 审计日志只记录字段名、尾号、原因、充值记录 ID，不记录完整代码和 hash。
- 返回结果不得缓存。
- 该接口只读取 Apple ID 充值记录 `apple_balance_topups`，不得读取或消耗兑换码库存。

错误码：

- APPLE_TOPUP_GIFT_CODE_DUPLICATED
- APPLE_TOPUP_GIFT_CODE_NOT_FOUND
- APPLE_TOPUP_GIFT_CODE_PERMISSION_DENIED

## 10. 通知设置接口

### 10.1 通知总览

```text
GET /api/notifications/overview
GET /api/notifications
GET /api/notifications/:id
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
POST /api/notifications/system
```

### 10.2 通知规则

```text
GET    /api/notifications/rules
POST   /api/notifications/rules
GET    /api/notifications/rules/:id
PATCH  /api/notifications/rules/:id
DELETE /api/notifications/rules/:id
PATCH  /api/notifications/rules/:id/enable
PATCH  /api/notifications/rules/:id/disable
```

### 10.3 通知模板

```text
GET    /api/notifications/templates
POST   /api/notifications/templates
GET    /api/notifications/templates/:id
PATCH  /api/notifications/templates/:id
DELETE /api/notifications/templates/:id
POST   /api/notifications/templates/:id/render
```

### 10.4 通知日志

```text
GET /api/notifications/logs
GET /api/notifications/logs/:id
POST /api/notifications/logs/:id/retry
```

### 10.5 Telegram 配置和测试

```text
GET    /api/notifications/telegram
POST   /api/notifications/telegram
PATCH  /api/notifications/telegram/:id
DELETE /api/notifications/telegram/:id
POST   /api/notifications/telegram/test
```

### 10.6 内部通知事件触发

业务模块通过后端内部服务方法 `NotificationsService.triggerEvent` 触发通知事件，不对外开放公网 API。

当前已接入的第一批触发源：

- Apple ID 续费任务生成：到期前 3 天、到期仍未处理、余额不足、余额足够但不续费未取消、确认续费待收款。
- Apple ID 状态检测：非 normal 状态触发状态异常通知。
- 兑换码导入：重复导入、导入失败、低库存、缺货。
- 兑换码发货：锁码库存不足、锁码后低库存、自动发货失败转人工。
- 平台接口：淘宝/闲鱼订单或退款同步失败、平台发货接口异常、平台授权即将过期、平台授权已失效。
- 系统安全：登录失败事件。

说明：

- 默认 seed 会创建通知渠道、通知规则和站内通知模板。
- 默认规则仅启用站内通知；Telegram 需要在通知规则中开启渠道，并配置启用状态的 Telegram Bot。
- 平台授权即将过期/已失效由平台接口状态页基于 `authorizationStatus` 和可选 `tokenExpiresAt` 触发；真实 OAuth 接入后替换 Token 来源。
- 数据库异常、队列积压、磁盘不足等事件已由运维监控健康快照触发。
- 备份失败事件已由数据中心备份任务状态流转触发 `ops.backup.failed`。

## 11. 安全中心接口

```text
GET /api/security/overview
GET /api/security/login-logs
GET /api/security/active-sessions
DELETE /api/security/active-sessions/:id
GET /api/security/mfa-settings
PATCH /api/security/mfa-settings
GET /api/security/mfa/me
POST /api/security/mfa/me/setup
POST /api/security/mfa/me/enable
POST /api/security/mfa/me/recovery-codes
POST /api/security/mfa/me/disable
POST /api/security/mfa/users/:userId/reset
GET /api/security/ip-whitelists
POST /api/security/ip-whitelists
PATCH /api/security/ip-whitelists/:id
DELETE /api/security/ip-whitelists/:id
GET /api/security/password-policy
PATCH /api/security/password-policy
GET /api/security/sensitive-access-logs
GET /api/security/sensitive-access-approvals
POST /api/security/sensitive-access-approvals
PATCH /api/security/sensitive-access-approvals/:id/approve
PATCH /api/security/sensitive-access-approvals/:id/reject
GET /api/security/abnormal-logins
GET /api/security/sensitive-operations
```

登录风险识别规则：

- 单次登录失败只写入 `login_logs`，不直接触发连续失败通知，避免通知刷屏。
- 同一账号或同一 IP 在 15 分钟内累计 5 次 `failed` / `blocked` 登录记录时，本次登录日志写入 `abnormal = true`，并触发通知事件 `security.login.failed_many`。
- 外部设备指纹、异地登录或人工风控传入 `abnormal = true` 时，写入异常登录日志并触发通知事件 `security.login.abnormal`。
- `GET /api/security/abnormal-logins` 只返回 `abnormal = true` 的登录日志，用于安全中心异常登录列表。

MFA 规则：

- `POST /api/security/mfa/me/setup` 生成当前用户的 TOTP 密钥和 `otpauthUrl`，密钥使用字段加密服务保存。
- `POST /api/security/mfa/me/enable` 使用动态验证码启用 MFA，并一次性返回恢复码；恢复码只保存 hash。
- `POST /api/security/mfa/me/recovery-codes` 使用动态验证码或恢复码重新生成恢复码，旧恢复码立即失效。
- `POST /api/security/mfa/me/disable` 使用动态验证码或恢复码停用当前用户 MFA。
- `POST /api/security/mfa/users/:userId/reset` 需要 `security.mfa.manage` 权限，用于管理员重置指定用户 MFA。
- 登录接口 `POST /api/auth/login` 支持可选字段 `mfaCode`；已绑定 MFA 的账号必须提供动态验证码或恢复码，否则拒绝签发 JWT 并写入 blocked 登录日志。

## 12. 数据中心接口

```text
GET /api/data/overview
GET /api/data/backup-jobs
POST /api/data/backup-jobs
PATCH /api/data/backup-jobs/:id/status
POST /api/data/backup-jobs/:id/execute
GET /api/data/restore-jobs
POST /api/data/restore-jobs
PATCH /api/data/restore-jobs/:id/status
POST /api/data/restore-jobs/:id/execute
GET /api/data/import-jobs
POST /api/data/import-jobs
PATCH /api/data/import-jobs/:id/status
POST /api/data/import-jobs/:id/execute
GET /api/data/import-jobs/:id/error-report
GET /api/data/export-jobs
POST /api/data/export-jobs
PATCH /api/data/export-jobs/:id/status
POST /api/data/export-jobs/:id/execute
GET /api/data/export-jobs/:id/download
GET /api/data/recycle-bin
POST /api/data/recycle-bin/:id/restore
DELETE /api/data/recycle-bin/:id
GET /api/data/cleanup-jobs
POST /api/data/cleanup-jobs
PATCH /api/data/cleanup-jobs/:id/status
GET /api/data/duplicate-merge-jobs
POST /api/data/duplicate-merge-jobs
PATCH /api/data/duplicate-merge-jobs/:id/status
GET /api/data/dictionaries
POST /api/data/dictionaries
PATCH /api/data/dictionaries/:id
GET /api/data/system-parameters
PATCH /api/data/system-parameters/:key
```

说明：第一版数据中心接口处理任务记录、状态流转、数据库备份脚本执行、恢复到临时库演练、数据导入/导出文件生成、下载有效期、回收站标记恢复、字典和系统参数。数据清理和重复合并真实执行器将在队列/运维阶段接入。

数据备份/恢复说明：

- `POST /api/data/backup-jobs/:id/execute` 会调用 `scripts/backup-postgres.sh` 执行 PostgreSQL 备份，仅支持 `jobType = database`。
- 备份文件默认写入 `DATA_BACKUP_DIR`，默认值本地为 `backups/postgres/local`，生产建议配置为 `backups/postgres` 或挂载的持久化目录。
- 备份成功后写入 `storagePath`、`fileSize`、`finishedAt`，并写 `data.backup.execute.success` 审计日志；失败时写 `data.backup.execute.failed` 并触发备份失败通知。
- `POST /api/data/restore-jobs/:id/execute` 第一版执行“恢复演练”：调用 `scripts/verify-postgres-restore.sh` 将备份恢复到临时数据库验证，不覆盖当前业务库。
- 恢复演练必须提交确认文本 `CONFIRM_RESTORE_DRILL {restoreJobId前8位}`，确认文本不匹配时拒绝执行。
- 恢复任务必须关联存在 `storagePath` 的备份任务，且备份文件必须位于 `DATA_BACKUP_DIR` 目录内，禁止读取任意系统路径。
- `DATA_JOB_COMMAND_TIMEOUT_MS` 控制备份/恢复脚本超时时间，默认 600000 毫秒。

数据导入说明：

- `POST /api/data/import-jobs/:id/execute` 会执行真实 CSV 导入任务，读取 `DATA_IMPORT_DIR` 目录内的文件名，不允许读取任意系统路径。
- 第一版支持导入模块：`customers`、`source_platforms`。
- 单次导入最多 5000 行，CSV 第一行必须是表头。
- 客户导入最少需要 `name`；可选字段包括 `phone`、`wechat`、`sourcePlatformId`、`sourcePlatformName`、`tags`、`status`、`remark`。
- 来源平台导入最少需要 `name`；可选字段包括 `feeRate`、`feeFixed`、`status`、`remark`。
- 部分成功、部分失败时任务状态为 `success`，并保留 `failedCount` 和错误报告；全部失败时任务状态为 `failed`。
- `GET /api/data/import-jobs/:id/error-report` 返回 CSV 错误报告文件流，并写 `data.import.error_report.download` 审计日志。
- 导入错误报告默认保存到 `DATA_IMPORT_ERROR_DIR`，默认值为 `uploads/data-import-errors`。

数据导出说明：

- `POST /api/data/export-jobs/:id/execute` 会执行真实导出任务，生成 CSV 文件，任务成功后写入 `filePath` 和 24 小时 `downloadExpiresAt`。
- 第一版支持导出模块：`customers`、`source_platforms`、`apple_accounts`、`apple_orders`、`redeem_codes`、`code_orders`。
- 单次导出最多 5000 行，超大范围后续接队列和分片导出。
- 导出文件默认保存到 `DATA_EXPORT_DIR`，默认值为 `uploads/data-exports`，生产 Docker Compose 已持久化 `uploads` 卷。
- `GET /api/data/export-jobs/:id/download` 返回 CSV 文件流，不再返回统一 JSON；下载会写 `data.export.download` 审计日志。
- Apple ID、手机号、兑换码等敏感字段只导出脱敏值或尾号，不导出密码、完整兑换码、完整礼品卡代码、完整手机号等敏感原文。

## 13. 运维监控接口

```text
GET /api/ops/overview
GET /api/ops/api-status
GET /api/ops/database-status
GET /api/ops/redis-status
GET /api/ops/queue-status
GET /api/ops/cron-jobs
GET /api/ops/platform-sync-status
GET /api/ops/automation-workers
GET /api/ops/file-storage-status
GET /api/ops/disk-space
GET /api/ops/error-logs
POST /api/ops/error-logs
GET /api/ops/health-snapshots
POST /api/ops/health-snapshots
POST /api/ops/platforms/:platform/test-connection
```

说明：第一版运维监控会实时检查 API、数据库、Redis、本地文件存储、磁盘空间和自动化任务队列；`POST /api/ops/health-snapshots` 会记录当前快照和队列状态，并在数据库异常、队列积压、磁盘不足时触发系统通知事件。淘宝、闲鱼真实授权检测和重新授权入口将在平台接口状态阶段继续完善。

## 14. 网站维护接口

```text
GET /api/maintenance/overview
GET /api/maintenance/announcements
POST /api/maintenance/announcements
PATCH /api/maintenance/announcements/:id
DELETE /api/maintenance/announcements/:id
GET /api/maintenance/mode
PATCH /api/maintenance/mode
GET /api/maintenance/app-versions
POST /api/maintenance/app-versions
GET /api/maintenance/changelogs
GET /api/maintenance/feature-flags
POST /api/maintenance/feature-flags
PATCH /api/maintenance/feature-flags/:id
GET /api/maintenance/menu-config
PATCH /api/maintenance/menu-config
GET /api/maintenance/theme-config
PATCH /api/maintenance/theme-config
GET /api/maintenance/system-parameters
POST /api/maintenance/system-parameters
PATCH /api/maintenance/system-parameters/:id
```

说明：

- `GET /api/maintenance/overview` 返回启用公告数、维护模式状态、启用功能开关数、最新版本、最近公告和最近版本。
- 公告列表支持 `page`、`pageSize`、`keyword`、`level`、`enabled`。
- 功能开关列表支持 `page`、`pageSize`、`keyword`、`enabled`。
- 版本和更新日志列表支持 `page`、`pageSize`、`keyword`、`status`。
- 菜单配置、主题配置和维护系统参数使用 `system_parameters` 表保存，`group` 固定为 `maintenance`。
- 创建、修改、删除公告，修改维护模式，创建版本，创建/修改功能开关，修改配置和系统参数都会写入 `audit_logs`。
- 第一版不直接控制部署发布或全局网关拦截，只保存维护配置并提供后台管理入口。

## 15. 审计日志中心接口补充

```text
GET /api/audit-logs/operation
GET /api/audit-logs/sensitive-access
GET /api/audit-logs/login
GET /api/audit-logs/export
GET /api/audit-logs/permission-changes
GET /api/audit-logs/automation-tasks
GET /api/audit-logs/platform-interfaces
```

说明：

- `operation` 查询 `audit_logs`，支持 `page`、`pageSize`、`keyword`、`module`、`action`、`userId`。
- `sensitive-access` 查询 `sensitive_access_logs`，支持 `keyword`、`module`、`fieldName`、`approved`。
- `login` 查询 `login_logs`，支持 `keyword`、`status`、`abnormal`。
- `export` 查询 `data_export_jobs`，支持 `keyword`、`module`、`status`、`containsSensitive`。
- `permission-changes` 查询权限/角色相关 `audit_logs`。
- `automation-tasks` 查询 `automation_task_logs`，支持 `keyword`、`level`、`taskId`。
- `platform-interfaces` 查询 `platform_sync_logs`，支持 `keyword`、`platform`、`status`。

## 16. 平台接口状态接口

```text
GET /api/ops/platforms
GET /api/ops/platforms/taobao
GET /api/ops/platforms/xianyu
GET /api/ops/platforms/telegram
GET /api/ops/platforms/file-storage
GET /api/ops/platforms/automation-service
GET /api/ops/platforms/:platform/authorization
POST /api/ops/platforms/:platform/authorization
POST /api/ops/platforms/:platform/oauth/start
GET /api/ops/platforms/:platform/oauth/callback
POST /api/ops/platforms/:platform/test-connection
POST /api/ops/platforms/:platform/reauthorize
```

显示字段：

- 授权状态
- Token 有效期
- 最近同步时间
- 最近失败原因
- 接口调用次数
- 失败请求数
- 失败日志数
- 最近失败时间
- 重试记录数
- 最近重试时间
- 错误率
- 重新授权入口
- 测试连接结果
- 授权配置脱敏状态

说明：

- 运维接口标识支持 `taobao`、`xianyu`、`telegram`、`file-storage`、`automation-service`。
- `GET /api/ops/platforms` 聚合授权状态、最近同步、最近失败、调用次数、失败请求数、失败日志数、重试记录数、错误率和最新日志。
- 平台接口统计默认基于最近 30 天 `platform_sync_logs`；错误率按失败请求数 / 总请求数计算，避免简单平均导致少量大批次调用被低估。
- 授权状态支持 `configured`、`expiring`、`expired`、`not_configured`、`not_required`、`unknown`。
- 平台状态读取会对授权未配置/已过期触发 `platform.auth.invalid`，对 7 天内过期触发 `platform.auth.expiring`，并做事件级小时限流。
- `GET /api/ops/platforms/:platform/authorization` 返回授权配置脱敏状态，只包含 `hasAppKey`、`appKeyTail`、`hasAccessToken`、`tokenExpiresAt` 等，不返回密文或明文。
- `POST /api/ops/platforms/:platform/authorization` 保存 `appKey`、`appSecret`、`accessToken`、`refreshToken`、`tokenExpiresAt`、`shopName`、`scopes`、`authorizationUrl`、`tokenUrl`、`redirectUri`、`clientIdParam`，敏感字段加密写入 `system_parameters` 的 `platform_auth` 分组，审计日志只记录脱敏摘要。
- `POST /api/ops/platforms/:platform/oauth/start` 基于已保存的 `appKey`、授权地址和回调地址生成 OAuth 授权链接，创建 10 分钟有效的 state 记录，并写入 `platform_sync_logs` 与 `audit_logs`。
- `GET /api/ops/platforms/:platform/oauth/callback` 接收平台回调，校验 state 是否存在、未过期且未使用；第一版只加密保存授权码并记录日志，真实 token exchange、签名验签、刷新 token 要等淘宝/闲鱼真实开放平台 Adapter 接入后完成。
- `POST /api/ops/platforms/:platform/test-connection` 会写入 `platform_sync_logs` 并写入 `audit_logs`。
- `POST /api/ops/platforms/:platform/reauthorize` 保留兼容入口，第一版记录重新授权请求和审计日志；新版页面优先使用 `/oauth/start` 生成授权跳转。

## 17. 通用列表查询参数补充

所有列表接口统一支持：

```text
keyword
filters
sortBy
sortOrder
page
pageSize
dateRangeShortcut
startDate
endDate
columns
density
savedViewId
```

`dateRangeShortcut` 支持：

- today
- yesterday
- last_7_days
- last_30_days
- this_month
- last_month
- custom

表格视图接口：

```text
GET    /api/user-table-views
POST   /api/user-table-views
PATCH  /api/user-table-views/:id
DELETE /api/user-table-views/:id
POST   /api/user-table-views/:id/set-default
```

查询参数：

```text
tableKey
keyword
page
pageSize
```

保存字段：

```json
{
  "tableKey": "customers",
  "viewName": "我的常用视图",
  "filters": {
    "keyword": "",
    "status": "active",
    "dateShortcut": "last_7_days"
  },
  "sortConfig": {
    "prop": "updatedAt",
    "order": "descending"
  },
  "columns": ["name", "status", "updatedAt"],
  "density": "default",
  "pageSize": 20,
  "isDefault": true
}
```

规则：

- 表格视图按当前登录用户隔离。
- `tableKey + viewName` 在同一用户下唯一。
- 同一用户同一个 `tableKey` 只能有一个默认视图。
- `density` 仅支持 `compact`、`default`、`loose`。
- 创建、更新、删除和设为默认都会写入 `audit_logs`。

## 18. 已实现公共模块接口

### 18.1 客户管理

```text
GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PATCH  /api/customers/:id
POST   /api/customers/:id/reveal-phone
DELETE /api/customers/:id
```

说明：

- 列表支持 `page`、`pageSize`、`keyword`、`status`、`sourcePlatformId`。
- 手机号列表默认返回 `maskedPhone` 和 `phoneTail`，不直接返回完整手机号。
- 查看完整手机号必须调用 `reveal-phone`，填写查看原因，并拥有 `customer.view_phone` 权限。
- `reveal-phone` 会写入 `sensitive_access_logs` 和 `audit_logs`，日志只记录手机号尾号，不记录完整手机号。
- 创建、更新、删除写入 `audit_logs`。
- 前端客户详情页路由为 `/system/customers/detail?id=:id`，第一版聚合客户详情、Apple ID 订单、开通记录和续费任务，兑换码订单和客服工单为后续接入区域。

### 18.2 来源平台设置

```text
GET    /api/source-platforms
GET    /api/source-platforms/:id
POST   /api/source-platforms
PATCH  /api/source-platforms/:id
DELETE /api/source-platforms/:id
```

说明：

- 列表支持 `page`、`pageSize`、`keyword`、`type`、`status`、`sortBy`、`sortOrder`。
- `sortBy` 仅支持 `name`、`code`、`type`、`feeRate`、`feeFixed`、`status`、`createdAt`、`updatedAt`。
- `sortOrder` 支持 `asc`、`desc`。
- `feeRate`、`feeFixed` 使用 Decimal 字段。
- 查询需要 `source_platform.view`，新增、修改、删除需要 `source_platform.manage`。

### 18.3 发货模板

```text
GET    /api/message-templates
GET    /api/message-templates/:id
POST   /api/message-templates
PATCH  /api/message-templates/:id
DELETE /api/message-templates/:id
```

说明：

- 列表支持 `page`、`pageSize`、`keyword`、`type`、`channel`、`status`。
- 后台发货模板页固定查询 `type=delivery`、`channel=customer_service`，用于淘宝/闲鱼付款后的自动回复内容。
- 兑换码业务设置绑定发货模板时，后端也会校验模板必须是启用的发货客服话术。
- 模板内容支持 `{{ variable }}` 变量写法，服务端会提取并合并变量。
- 创建、更新、删除需要 `message_template.manage`。

### 18.4 附件中心

```text
GET  /api/attachments
GET  /api/attachments/:id
GET  /api/attachments/:id/download
POST /api/attachments
```

说明：

- 列表支持 `page`、`pageSize`、`keyword`、`businessModule`、`objectType`、`objectId`、`purpose`。
- 上传字段名为 `file`，可选业务归属字段为 `businessModule`、`objectType`、`objectId`、`purpose`、`remark`。
- 查询需要 `attachment.view`，上传需要 `attachment.upload`，下载需要 `attachment.download`。

## 19. 已实现 Apple ID 管理接口

### 19.1 Apple ID 管理

```text
GET    /api/apple/accounts
GET    /api/apple/accounts/:id
POST   /api/apple/accounts
POST   /api/apple/accounts/import
PATCH  /api/apple/accounts/:id
POST   /api/apple/accounts/:id/reveal-secret
DELETE /api/apple/accounts/:id
```

说明：

- 列表支持 `page`、`pageSize`、`keyword`、`status`、`currency`、`region`、`locked`、`sortBy`、`sortOrder`。
- `sortBy` 支持 `appleId`、`region`、`currency`、`currentBalance`、`balanceCostAmount`、`averageCost`、`status`、`isManuallyLocked`、`createdAt`、`updatedAt`；`sortOrder` 支持 `asc` / `desc`。
- 列表和详情默认只返回 `appleIdMasked` 和 `appleIdTail`，不返回完整 Apple ID 密码、密保、手机号、备用邮箱。
- `password`、`securityInfo`、`phone`、`recoveryEmail` 写入时加密保存。
- `currentBalance`、`balanceCostAmount`、`averageCost` 使用 Decimal。
- API 字段 `balanceCostAmount` 表示当前余额对应的人民币总成本，不是平均成本。
- 后台页面给用户填写“平均成本”时，会先换算成 `currentBalance × 平均成本` 再提交给 `balanceCostAmount`。
- `averageCost = balanceCostAmount / currentBalance`，余额为 0 时总成本必须为 0。
- 创建、更新、删除写入 `audit_logs`，审计日志中敏感字段只记录 `[encrypted]`。
- 查看完整 Apple ID、密码、密保、手机号、备用邮箱必须调用 `reveal-secret`，并填写查看原因。
- `reveal-secret` 会写入 `sensitive_access_logs` 和 `audit_logs`，日志不记录完整明文。
- `reveal-secret` 响应头禁止缓存。
- 批量导入每批最多 500 行，支持逗号或制表符分隔文本，支持首行表头。
- 批量导入字段顺序：`appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark`。
- 批量导入走 API 原始字段，`balanceCostAmount` 需要填人民币总成本；如果只知道平均成本，需要先用余额乘以平均成本。
- 批量导入会逐行返回成功/失败结果；已存在账号和本批次重复账号不会导入。
- 批量导入会加密保存敏感字段，并写入 `audit_logs`，审计日志不记录敏感明文。

批量导入请求：

```json
{
  "accounts": [
    "appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark",
    "demo@example.com,Aa123456,US,USD,100,650,18800000000,backup@example.com,主账号"
  ]
}
```

批量导入响应：

```json
{
  "totalCount": 1,
  "successCount": 1,
  "failedCount": 0,
  "accounts": [],
  "errors": []
}
```

查看敏感字段请求：

```json
{
  "field": "password",
  "reason": "售后登录核对"
}
```

`field` 支持：

- `appleId`
- `password`
- `securityInfo`
- `phone`
- `recoveryEmail`

查看敏感字段响应：

```json
{
  "accountId": "uuid",
  "field": "password",
  "label": "密码",
  "value": "完整明文，只在本次响应返回",
  "revealedAt": "2026-06-18T00:00:00.000Z"
}
```

权限：

- `apple.account.view`
- `apple.account.view_full`
- `apple.account.create`
- `apple.account.update`
- `apple.account.delete`
- `apple.secret.view_password`
- `apple.secret.view_security`
- `apple.secret.view_phone`
- `apple.secret.view_email`

### 19.2 Apple ID 余额流水

```text
GET  /api/apple/accounts/:accountId/topups
POST /api/apple/accounts/:accountId/topups
GET  /api/apple/accounts/:accountId/consumptions
POST /api/apple/accounts/:accountId/consumptions
```

充值请求字段：

| 字段         | 类型    | 说明                                |
| ------------ | ------- | ----------------------------------- |
| faceValue    | Decimal | 充值面值                            |
| costAmount   | Decimal | 本次充值的人民币总成本              |
| giftCardCode | string  | 礼品卡代码/充值代码，选填，加密保存 |
| remark       | string  | 备注                                |

消费请求字段：

| 字段   | 类型    | 说明     |
| ------ | ------- | -------- |
| amount | Decimal | 消费金额 |
| reason | string  | 消费原因 |
| remark | string  | 备注     |

规则：

- 充值后：`新余额 = 原余额 + faceValue`。
- 充值后：`新余额人民币成本 = 原余额人民币成本 + costAmount`。
- 充值后：`新平均成本 = 新余额人民币成本 / 新余额`。
- 后台充值弹窗给用户填写的是“本次平均成本”，保存前会换算成 `faceValue × 本次平均成本` 再提交给 `costAmount`。
- 消费时：`本次消费成本 = 消费金额 × 消费时平均成本`。
- 消费后：`余额 = 消费前余额 - 消费金额`。
- 消费后：`余额人民币成本 = 消费前成本 - 本次消费成本`。
- 消费金额不得超过当前余额。
- 礼品卡代码只属于 Apple ID 充值记录，不属于兑换码库存。
- 礼品卡完整代码加密保存，列表只返回 `giftCardCodeTail`。
- `giftCardCodeHash` 唯一，用于防重复录入。

权限：

- 查询流水需要 `apple.balance.view`。
- 录入充值需要 `apple.balance.topup`。
- 录入消费第一版使用 `apple.balance.adjust`。
