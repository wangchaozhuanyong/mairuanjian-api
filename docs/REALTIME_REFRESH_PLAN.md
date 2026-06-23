# 实时刷新与高级加载重构方案

## 1. 文档定位

本文档用于规划后台管理系统的高级数据刷新能力。

目标不是把页面改成频繁轮询，也不是用实时通道替代现有业务接口，而是建立一套稳定的“有变化才刷新、没变化不打扰”的加载体系。

本方案适用于：

- 左侧导航切换后页面数据刷新慢的问题
- 页面进入后先空白、过一会才显示数据的问题
- 已有数据时希望先展示旧数据，再后台静默刷新
- 订单、库存、任务、通知、监控状态变化后希望自动刷新
- 没有新数据时不希望页面闪动、不希望重复刷新

本文档只规划重构方案，不要求立刻修改数据库或重写业务流程。

## 2. 当前问题

### 2.1 典型体验问题

- 切换左侧导航后，页面先加载壳子，再过一段时间才开始显示数据。
- 部分页面需要先加载保存视图、筛选项或基础配置，之后才请求主列表。
- 已经访问过的页面再次切回来时，没有统一的缓存和静默刷新策略。
- 多个页面各自写 `loadData`，刷新时机和错误处理不统一。
- 页面不知道接口返回的数据是否真的变化，只要请求完成就可能覆盖页面状态。

### 2.2 不能采用的错误方案

- 不要全站高频轮询，例如每 3 秒刷新所有列表。
- 不要用 SSE 或 WebSocket 直接推送完整业务数据。
- 不要让前端收到实时事件后直接修改订单、余额、库存等核心数据。
- 不要把 Apple ID 业务事件刷新到兑换码业务页面。
- 不要把兑换码业务事件刷新到 Apple ID 业务页面。
- 不要把敏感字段通过实时通道推给前端。

## 3. 推荐技术路线

第一阶段推荐使用：

```text
REST API + Smart Query Cache + SSE
```

后期需要双向控制时再补：

```text
WebSocket
```

### 3.1 REST API 的职责

REST API 继续作为最终数据来源。

所有列表、详情、创建、修改、删除、审批、发货、充值、扣费、导入、导出仍然走现有 API。

实时能力不能绕开现有接口、权限、审计和业务校验。

### 3.2 Smart Query Cache 的职责

前端查询缓存负责：

- 缓存页面列表和详情数据
- 进入页面时立即展示旧数据
- 后台静默刷新
- 请求去重，避免同一个接口被同时重复请求
- 比较新旧数据
- 数据没变化时不刷新 UI
- 数据变化时再更新表格、指标卡和状态标签

实时事件进入前端后，默认只把相关 query 标记为 stale，不直接删除旧缓存。这样用户切换页面时仍能先看到上次数据，再由当前页面在后台静默刷新。

### 3.3 SSE 的职责

SSE 只负责告诉前端：

```text
哪个模块的哪类资源发生了变化
```

SSE 不负责返回完整业务数据。

前端收到 SSE 事件后，只做缓存标记过期和后台刷新，不直接删除旧页面数据。

### 3.4 WebSocket 的职责

WebSocket 暂不作为第一阶段主方案。

后续以下场景再使用 WebSocket：

- 自动化任务实时控制
- 人工验证流程
- 批量导入/导出进度双向确认
- 平台扫码授权
- 客服工单实时对话
- 需要前端向后端持续发送操作指令的场景

## 4. 总体架构

```text
业务操作成功
  ↓
后端写数据库、写审计日志、提交事务
  ↓
后端发布轻量实时事件
  ↓
SSE 通道推给有权限的前端用户
  ↓
前端 RealtimeProvider 接收事件
  ↓
Event Router 判断事件影响哪些 query
  ↓
Smart Query Cache 标记 stale，但保留旧缓存
  ↓
当前页面相关：后台刷新
当前页面不相关：只标记，下次进入再刷新
  ↓
REST API 返回最新数据
  ↓
新旧数据一致：不更新 UI
新旧数据不同：更新 UI
```

## 5. 后端设计

### 5.1 新增模块

建议新增：

```text
apps/api/src/realtime/
├── realtime.module.ts
├── realtime.controller.ts
├── realtime.service.ts
├── realtime-event.types.ts
├── realtime-event-bus.ts
└── realtime-permission.filter.ts
```

### 5.2 SSE 接口

```text
GET /api/realtime/events
```

要求：

- 必须登录后才能连接。
- 使用现有 JWT 身份。
- 支持心跳。
- 支持断线重连。
- 支持按用户权限过滤事件。
- 不返回敏感字段。
- 不参与业务事务。
- 连接失败不能影响主业务接口。

### 5.3 心跳事件

建议每 25 秒发送一次心跳：

```json
{
  "type": "system.heartbeat",
  "occurredAt": "2026-06-20T00:00:00.000Z"
}
```

前端用于判断连接是否存活。

### 5.4 实时事件结构

```json
{
  "id": "evt_01HZZZ",
  "type": "apple.renewal_task.updated",
  "module": "apple",
  "entity": "renewal_task",
  "action": "updated",
  "resourceId": "uuid",
  "scope": {
    "appleAccountId": "uuid",
    "customerId": "uuid"
  },
  "occurredAt": "2026-06-20T00:00:00.000Z"
}
```

字段说明：

| 字段       | 说明         |
| ---------- | ------------ |
| id         | 事件唯一 ID  |
| type       | 事件类型     |
| module     | 所属模块     |
| entity     | 资源类型     |
| action     | 操作类型     |
| resourceId | 资源 ID      |
| scope      | 可选影响范围 |
| occurredAt | 事件发生时间 |

### 5.5 禁止出现在事件里的数据

以下内容不得放进 SSE 事件：

- Apple ID 密码
- 密保答案
- 完整手机号
- 完整兑换码
- 礼品卡完整代码
- 平台 token
- API Key
- 客户隐私信息
- 订单完整备注
- 任何可直接造成敏感泄露的业务内容

## 6. 事件命名规范

事件类型统一使用：

```text
业务区.资源.动作
```

示例：

```text
apple.account.created
apple.account.updated
apple.account.locked
apple.topup.created
apple.consumption.created
apple.renewal_task.created
apple.renewal_task.updated
apple.action_plan.generated
apple.action_plan.completed
apple.automation_task.result_written

codes.inventory.updated
codes.order.synced
codes.delivery.failed
codes.after_sale.reissued

notification.message.created
security.login.abnormal
ops.health.updated
platform.connection.failed
```

## 7. 业务边界

### 7.1 Apple ID 事件

只影响 Apple ID 业务相关缓存：

- Apple ID 管理
- Apple ID 详情
- Apple ID 余额流水
- Apple ID 订单
- Apple ID 开通记录
- 续费工作台
- 待取消订阅
- 待充值续费
- 等待自动续费
- Apple ID 操作计划
- Apple ID 自动化任务
- Apple ID 报表

不得影响：

- 兑换码库存
- 兑换码订单
- 兑换码发货
- 兑换码利润报表

### 7.2 兑换码事件

只影响兑换码业务相关缓存：

- 兑换码库存
- 兑换码批次
- 兑换码订单
- 发货异常
- 售后补发
- 兑换码报表
- 发货模板

不得影响：

- Apple ID 账号
- Apple ID 余额
- Apple ID 续费任务
- Apple ID 操作计划

### 7.3 公共模块事件

可以影响公共页面：

- 客户管理
- 来源平台设置
- 用户管理
- 角色权限
- 审计日志
- 通知中心
- 安全中心
- 数据中心
- 运维监控
- 平台接口状态

公共模块不得主动改写 Apple ID 或兑换码业务数据。

## 8. 前端设计

### 8.1 新增前端能力

建议新增：

```text
apps/admin/src/realtime/
├── realtimeClient.ts
├── realtimeEvents.ts
├── realtimeEventRouter.ts
├── realtimeQueryMap.ts
└── useRealtime.ts
```

职责：

- 登录后建立 SSE 连接
- 退出登录后断开连接
- 自动重连
- 接收心跳
- 接收业务事件
- 分发到 query cache
- 不在业务页面里重复写连接代码

### 8.2 和 smartQuery 的关系

现有 `smartQuery` 继续负责缓存与刷新。

实时事件只负责触发：

```text
markQueryStale
refreshQueryInBackground
```

不要让 SSE 事件直接改页面数组、表格行或表单字段。

原则：

- 业务页面手动新增、编辑、删除成功后，可以主动 `invalidateSmartQueries` 清掉本页旧缓存。
- SSE 推送、兜底轮询、跨页面事件默认只 `markSmartQueriesStale`，保留旧数据用于立即展示。
- 当前页面收到相关事件后再调用 `refreshSmartQuery` 静默刷新。
- 如果 REST API 返回内容没有变化，`smartQuery` 只更新时间戳，不替换 UI 数据。
- 如果请求正在进行时收到 SSE 变化事件，`smartQuery` 必须记录事件发生时间；早于变化事件发出的请求结果不能清除 stale 状态，避免旧请求把新事件吞掉。

### 8.3 页面加载体验规则

所有高频列表页统一为：

```text
1. 进入页面
2. 先读取缓存
3. 有缓存立即显示
4. 无缓存显示骨架屏
5. 同时后台请求最新数据
6. 数据没变化，不更新 UI
7. 数据有变化，刷新 UI
8. 请求失败时保留旧数据，只提示后台刷新失败
```

### 8.4 路由切换体验规则

- 左侧导航切换不得等待接口完成后才进入页面。
- 路由进入后立即显示页面框架。
- 当前页面有缓存时不显示整页加载。
- 只在首次无数据时显示骨架屏。
- 背景刷新不能挡住页面操作。
- 刷新失败不能清空已有表格。

## 9. 事件和页面映射

### 9.1 Apple ID 业务

| 事件                                  | 影响页面                                         | 刷新策略       |
| ------------------------------------- | ------------------------------------------------ | -------------- |
| apple.account.created                 | Apple ID 管理、首页仪表盘                        | 当前页静默刷新 |
| apple.account.updated                 | Apple ID 管理、Apple ID 详情                     | 当前页静默刷新 |
| apple.account.locked                  | Apple ID 管理、操作计划、续费工作台              | 当前页静默刷新 |
| apple.topup.created                   | Apple ID 详情、余额对账、财务对账                | 当前页静默刷新 |
| apple.consumption.created             | Apple ID 详情、余额对账、财务对账                | 当前页静默刷新 |
| apple.order.created                   | Apple ID 订单、开通记录、首页仪表盘              | 当前页静默刷新 |
| apple.renewal_task.created            | 续费工作台、待取消订阅、待充值续费、等待自动续费 | 当前页静默刷新 |
| apple.renewal_task.updated            | 续费工作台、续费子页面、操作计划                 | 当前页静默刷新 |
| apple.action_plan.generated           | Apple ID 操作计划、续费工作台                    | 当前页静默刷新 |
| apple.action_plan.completed           | Apple ID 操作计划、续费工作台                    | 当前页静默刷新 |
| apple.automation_task.created         | 自动化任务中心、运维监控                         | 当前页静默刷新 |
| apple.automation_task.ran             | 自动化任务中心、Apple ID 管理、运维监控          | 当前页静默刷新 |
| apple.automation_task.cancelled       | 自动化任务中心、运维监控                         | 当前页静默刷新 |
| apple.automation_task.retried         | 自动化任务中心、运维监控                         | 当前页静默刷新 |
| apple.automation_task.manual_required | 自动化任务中心、通知中心、运维监控               | 当前页静默刷新 |
| apple.automation_task.result_written  | 自动化任务中心、Apple ID 管理、运维监控          | 当前页静默刷新 |

### 9.2 兑换码业务

| 事件                       | 影响页面                         | 刷新策略       |
| -------------------------- | -------------------------------- | -------------- |
| codes.inventory.updated    | 兑换码库存、首页仪表盘           | 当前页静默刷新 |
| codes.batch.imported       | 兑换码库存、数据中心             | 当前页静默刷新 |
| codes.order.synced         | 兑换码订单、兑换码报表           | 当前页静默刷新 |
| codes.delivery.failed      | 发货异常、通知中心、首页仪表盘   | 当前页静默刷新 |
| codes.delivery.completed   | 兑换码订单、兑换码报表           | 当前页静默刷新 |
| codes.after_sale.created   | 售后补发、兑换码报表             | 当前页静默刷新 |
| codes.after_sale.reissued  | 售后补发、兑换码库存、兑换码报表 | 当前页静默刷新 |
| codes.after_sale.completed | 售后补发、兑换码报表             | 当前页静默刷新 |

### 9.3 系统和平台

| 事件                                        | 影响页面                   | 刷新策略         |
| ------------------------------------------- | -------------------------- | ---------------- |
| notification.message.created                | 通知中心、顶部通知入口     | 立即刷新通知计数 |
| security.login.abnormal                     | 安全中心、通知中心         | 当前页静默刷新   |
| security.session.revoked                    | 安全中心、审计日志         | 当前页静默刷新   |
| security.mfa.enabled                        | 安全中心                   | 当前页静默刷新   |
| security.mfa.disabled                       | 安全中心                   | 当前页静默刷新   |
| security.mfa_settings.updated               | 安全中心                   | 当前页静默刷新   |
| security.password_policy.updated            | 安全中心                   | 当前页静默刷新   |
| security.ip_whitelist.updated               | 安全中心                   | 当前页静默刷新   |
| security.sensitive_access_approval.created  | 安全中心、审计日志         | 当前页静默刷新   |
| security.sensitive_access_approval.approved | 安全中心、审计日志         | 当前页静默刷新   |
| security.sensitive_access_approval.rejected | 安全中心、审计日志         | 当前页静默刷新   |
| security.permission.changed                 | 权限管理、审计日志         | 标记 stale       |
| data.backup_job.created                     | 数据中心、通知中心         | 当前页静默刷新   |
| data.backup_job.updated                     | 数据中心、通知中心         | 当前页静默刷新   |
| data.import_job.updated                     | 数据中心                   | 当前页静默刷新   |
| data.export_job.updated                     | 数据中心                   | 当前页静默刷新   |
| data.dictionary.updated                     | 数据中心                   | 当前页静默刷新   |
| maintenance.announcement.updated            | 网站维护、通知中心         | 当前页静默刷新   |
| maintenance.mode.updated                    | 网站维护                   | 当前页静默刷新   |
| maintenance.feature_flag.updated            | 网站维护                   | 当前页静默刷新   |
| maintenance.app_version.created             | 网站维护                   | 当前页静默刷新   |
| common.attachment.created                   | 附件管理                   | 当前页静默刷新   |
| ops.health.updated                          | 运维监控、平台接口状态     | 当前页静默刷新   |
| platform.connection.tested                  | 平台接口状态、平台接口日志 | 当前页静默刷新   |
| platform.authorization.updated              | 平台接口状态               | 当前页静默刷新   |
| platform.connection.failed                  | 平台接口状态、通知中心     | 当前页静默刷新   |

## 10. 权限和安全

### 10.1 连接权限

建议新增权限：

```text
realtime.connect
```

没有该权限不能建立 SSE 连接。

### 10.2 事件过滤

事件推送前必须按权限过滤：

- 没有 Apple ID 查看权限，不推送 Apple ID 业务事件。
- 没有兑换码查看权限，不推送兑换码业务事件。
- 没有安全中心权限，不推送安全事件。
- 没有运维权限，不推送运维事件。
- 管理员可以收到全量非敏感事件。

### 10.3 审计规则

建立 SSE 连接本身不需要每条事件写审计日志。

以下动作仍然必须走原审计：

- 查看敏感字段
- 导出数据
- 修改权限
- 强制下线
- 手动锁定 Apple ID
- 手动补发兑换码
- 修改平台授权配置

## 11. 后端发布事件时机

### 11.1 正确时机

必须在业务操作成功后发布事件。

推荐顺序：

```text
校验权限
校验业务规则
写数据库
写审计日志
事务成功提交
发布实时事件
返回 API 响应
```

### 11.2 不能提前发布

禁止在以下阶段发布事件：

- 参数校验前
- 权限校验前
- 数据库事务提交前
- 业务失败时
- 敏感字段解密时

### 11.3 事件发布失败处理

事件发布失败不能导致主业务失败。

正确处理：

- 主业务正常返回成功。
- 后端记录错误日志。
- 通知中心可触发 `ops.realtime.publish_failed`。
- 前端下次进入页面仍然会通过 REST API 获取最终数据。

## 12. 多标签页策略

如果用户在浏览器打开多个后台标签页，第一版可以允许每个标签页都连接 SSE。

后期可优化为：

- 使用 BroadcastChannel 在标签页之间共享事件。
- 只让一个标签页保持 SSE 连接。
- 其他标签页接收主标签页广播。

第一版不强制做这个优化，避免复杂度过高。

## 13. 断线和降级

### 13.1 断线重连

前端需要支持：

- 自动重连
- 指数退避
- 页面隐藏时降低重连频率
- 登录过期时停止重连并跳转登录

### 13.2 降级策略

SSE 不可用时：

- 页面仍然可以正常使用 REST API。
- 用户手动刷新仍然可用。
- 当前页面保留低频兜底刷新，第一版为 24 秒一次。
- 兜底刷新只触发当前路由对应的 query scope，不做全站刷新。
- 页面隐藏时不触发兜底刷新。
- REST API 返回数据未变化时，`smartQuery` 不更新 UI，避免表格闪动。
- 不影响创建、修改、删除、发货、充值等核心操作。

## 14. 分阶段实施计划

### Phase R1 - 文档和事件规范

- 定义实时事件结构。
- 定义事件命名规则。
- 定义业务区边界。
- 定义事件和页面映射。
- 定义权限和安全规则。

验收：

- 文档完成。
- 不改业务代码。
- 不改数据库。

### Phase R2 - 前端查询缓存标准化

- 将 `smartQuery` 扩展为统一查询缓存。
- 支持 `invalidate`、`markStale`、`refreshInBackground`。
- 支持按 query scope 批量失效。
- 先接入高频页面。

优先页面：

1. 续费工作台
2. Apple ID 管理
3. 兑换码库存
4. 兑换码订单
5. 通知中心
6. 运维监控

### Phase R3 - 后端 SSE 基础通道

- 新增 `RealtimeModule`。
- 新增 `GET /api/realtime/events`。
- 接入 JWT 鉴权。
- 接入心跳。
- 接入断线重连支持。
- 第一版先发布测试事件和系统心跳。

### Phase R4 - 前端 RealtimeProvider

- 登录后连接 SSE。
- 退出登录断开 SSE。
- 显示连接状态。
- 收到事件后进入统一事件分发器。
- 不在业务页面里单独创建 SSE 连接。

### Phase R5 - Apple ID 事件接入

- Apple ID 新增、编辑、锁定、充值、消费后发布事件。
- 续费任务生成、更新、完成后发布事件。
- 操作计划更新后发布事件。
- 自动化任务状态变化后发布事件。

### Phase R6 - 兑换码事件接入

- 兑换码导入后发布事件。
- 库存锁定、发货、补发后发布事件。
- 兑换码订单创建、更新后发布事件。
- 发货失败后发布事件。

### Phase R7 - 系统事件接入

- 通知创建后发布事件。
- 异常登录后发布事件。
- 权限变更后发布事件。
- 备份失败、队列异常、平台接口异常后发布事件。

### Phase R8 - WebSocket 增强

仅在以下功能需要时再做：

- 自动化任务实时控制
- 批量任务进度双向控制
- 平台扫码授权
- 客服工单即时对话

WebSocket 不替代 SSE，只补充双向交互能力。

## 15. 测试用例

### 15.1 前端缓存

- 首次进入无缓存页面时显示骨架屏。
- 再次进入有缓存页面时立即显示旧数据。
- 后台刷新返回相同数据时页面不闪动。
- 后台刷新返回新数据时表格更新。
- 接口失败时保留旧数据。

### 15.2 SSE 连接

- 未登录不能连接 SSE。
- 登录后可以连接 SSE。
- 服务端心跳正常到达。
- 网络断开后自动重连。
- Token 失效后停止重连并进入登录流程。
- 本地验收可运行 `npm run acceptance:realtime` 验证登录和 `system.connected`。
- 需要验证发布链路时运行 `npm run acceptance:realtime -- --publish-check`，会创建一条运维健康快照并等待 `ops.health.updated`。

### 15.3 事件分发

- Apple ID 更新事件只刷新 Apple ID 页面。
- 兑换码库存事件只刷新兑换码页面。
- 通知事件刷新顶部通知入口。
- 运维事件刷新运维监控。
- 无权限用户收不到对应模块事件。

### 15.4 安全

- SSE 事件不包含敏感字段。
- 查看敏感字段仍然必须走原接口和审计日志。
- 权限变更后用户实时连接权限正确更新。
- 事件发布失败不影响业务接口成功返回。

## 16. 验收标准

完成后应达到：

- 左侧导航切换立即进入页面。
- 有缓存的页面不再整页等待。
- 数据刷新在后台静默进行。
- 无变化数据不触发 UI 更新。
- 有变化数据自动更新。
- SSE 断开时页面仍然可用。
- 业务边界清晰，Apple ID 和兑换码互不误刷新。
- 敏感数据不会通过实时通道泄露。
- 不改变现有业务流程。
- 不绕开现有权限和审计。

## 17. 暂不做事项

第一版不做：

- 全量 WebSocket 重构
- 实时推送完整业务数据
- 多人协作编辑
- 前端直接根据事件改核心业务实体
- 数据库 schema 大改
- 把所有页面一次性迁移

## 18. 推荐下一步

当前已落地的基础能力：

```text
1. smartQuery 已扩展为全局查询缓存。
2. Apple ID 管理、Apple ID 订单、开通记录、续费工作台、操作计划、自动化任务、兑换码业务设置、发货模板、兑换码订单总览、兑换码库存、发货异常、售后补发、兑换码报表、客户管理、来源平台、附件管理、用户管理、角色权限、安全中心、审计日志中心、通知中心、运维监控、数据中心、网站维护、平台接口状态已接入缓存优先和后台刷新。
3. 后端已新增 GET /api/realtime/events SSE 通道。
4. 前端已新增登录态自动连接的 RealtimeProvider。
5. 前端已支持 SSE 连接状态展示、断线自动重连和当前页低频兜底刷新。
6. 通知中心、运维监控、平台接口状态、平台订单/发货、Apple ID 账号、余额、订单、状态检测、续费任务、操作计划、自动化任务、兑换码业务设置、平台映射、发货模板、兑换码导入、售后补发、客户、来源平台、附件上传、用户、角色权限、安全中心、数据中心、网站维护相关操作已发布实时事件。
7. 前端已能将实时事件映射到 query scope，并通知当前页面静默刷新。
```

下一步建议执行：

```text
1. 做浏览器联调：登录后确认 EventSource 连接、心跳、事件触发、当前页面静默刷新。
2. 模拟 SSE 断线：确认左下角显示“实时重连中”，当前页面按路由 scope 低频静默刷新，连接恢复后停止兜底轮询。
3. 做一轮浏览器页面巡检：数据中心、网站维护、平台接口状态切换回来应立即显示缓存，后台静默刷新。
4. 客服工单、风控中心当前仍是规划/占位模块，待后端接口和真实业务表落地后再接入 smartQuery 与实时事件。
5. 联调通过后再考虑 WebSocket，只用于自动化任务实时控制和人工验证这类双向交互。
```

注意：SSE 第一版仍不推送完整业务数据，只推送“哪个模块发生变化”的轻量事件。最终数据仍以 REST API 返回为准。

## 19. 当前代码接入点

### 19.1 后端已发布的事件

Apple ID 业务：

- `apple.account.created`
- `apple.account.imported`
- `apple.account.updated`
- `apple.account.deleted`
- `apple.topup.created`
- `apple.consumption.created`
- `apple.balance_adjustment.created`
- `apple.account.status_checked`
- `apple.order.created`
- `apple.renewal_task.created`
- `apple.renewal_task.generated`
- `apple.renewal_task.updated`
- `apple.renewal_task.completed`
- `apple.renewal_task.cancelled`
- `apple.renewal_task.postponed`
- `apple.action_plan.generated`
- `apple.action_plan.completed`
- `apple.automation_task.created`
- `apple.automation_task.ran`
- `apple.automation_task.cancelled`
- `apple.automation_task.retried`
- `apple.automation_task.manual_required`
- `apple.automation_task.result_written`

兑换码业务：

- `code.service.created`
- `code.service.updated`
- `code.service.deleted`
- `code.platform_mapping.created`
- `code.platform_mapping.updated`
- `code.platform_mapping.deleted`
- `code.delivery_template.created`
- `code.delivery_template.updated`
- `code.delivery_template.deleted`
- `codes.batch.imported`
- `codes.after_sale.created`
- `codes.after_sale.reissued`
- `codes.after_sale.completed`

通知、运维、平台业务：

- 客户、来源平台相关公共数据事件；发货模板相关事件归兑换码业务。
- 用户、角色权限相关系统事件。
- 安全中心会话、MFA、IP 白名单、密码策略、敏感字段审批相关事件。
- 通知规则、通知模板、Telegram 配置、通知日志相关事件。
- 运维健康快照、错误日志、平台同步日志相关事件。
- 兑换码订单与发货相关事件。
- 数据中心备份、恢复、导入、导出、回收站、数据清理、重复合并、数据字典、系统参数相关事件。
- 网站维护公告、维护模式、版本、功能开关、菜单配置、主题配置、上线清单、系统参数相关事件。
- 附件上传事件。

### 19.2 前端已接入的 smart query 页面

- Apple ID 管理
- Apple ID 订单
- Apple ID 开通记录
- Apple ID 续费工作台
- Apple ID 操作计划
- Apple ID 自动化任务
- 兑换码业务设置
- 兑换码订单总览
- 兑换码库存
- 发货异常
- 售后补发
- 兑换码报表
- 客户管理
- 来源平台
- 发货模板
- 附件中心
- 用户管理
- 角色权限
- 安全中心
- 审计日志中心：操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志、平台接口日志
- 通知中心
- 运维监控
- 数据中心
- 网站维护
- 平台接口状态

### 19.3 安全边界

- SSE 事件只包含模块、资源、动作、资源 ID 和统计数量。
- 不推送 Apple ID 密码、密保、完整手机号、完整兑换码、完整礼品卡代码、平台 token。
- 查看敏感字段仍使用原敏感接口和审计日志，不通过实时通道广播。
