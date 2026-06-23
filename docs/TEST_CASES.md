# 测试用例

## 1. Apple ID 平均成本计算

### 用例 1：首次充值

前置：

- Apple ID 当前余额 0 USD
- 当前人民币总成本 0 RMB

操作：

- 充值 50 USD
- 本次平均成本 5.4
- 人民币总成本 270 RMB

期望：

- 当前余额 = 50 USD
- 当前人民币总成本 = 270 RMB
- 当前平均成本 = 5.4

### 用例 2：二次充值

前置：

- 当前余额 50 USD
- 当前人民币总成本 270 RMB
- 当前平均成本 5.4

操作：

- 充值 100 USD
- 本次平均成本 5.7
- 人民币总成本 570 RMB

期望：

- 当前余额 = 150 USD
- 当前人民币总成本 = 840 RMB
- 当前平均成本 = 5.6

### 用例 4：礼品卡代码重复检测

前置条件：

- 已存在一条 Apple ID 充值记录，礼品卡代码为 `ABCD-1234`

操作：

- 再次使用 `ABCD-1234` 录入 Apple ID 充值

预期：

- 系统拒绝录入
- 不新增充值记录
- 不更新 Apple ID 余额
- 列表只显示礼品卡代码尾号 `1234`

### 用例 5：消费金额超过余额

前置条件：

- Apple ID 当前余额 10 USD

操作：

- 录入消费 20 USD

预期：

- 系统拒绝录入
- 不生成消费记录
- 不更新 Apple ID 余额和成本

### 用例 3：消费

前置：

- 当前余额 150 USD
- 当前成本 840 RMB
- 当前平均成本 5.6

操作：

- 消费 20 USD

期望：

- 本次消费成本 = 112 RMB
- 消费后余额 = 130 USD
- 消费后成本 = 728 RMB
- 平均成本仍为 5.6

## 2. Apple ID 锁定规则

### 用例 1：规则1按业务锁定

前置：

- Apple ID A 已开通 GPT
- GPT 未到期
- 业务规则为 by_service

操作：

- 再次创建 GPT 订单

期望：

- Apple ID A 不可用
- 原因：同业务未到期

操作：

- 创建 Gemini 订单

期望：

- Apple ID A 可用

### 用例 2：规则2全局锁定

前置：

- Apple ID A 已开通 GPT
- GPT 未到期
- 业务规则为 global

操作：

- 创建 Gemini 订单

期望：

- Apple ID A 不可用
- 原因：该 Apple ID 存在未到期业务

## 3. Apple ID 自动匹配

### 用例 1：余额不足

前置：

- 业务需要 20 USD
- Apple ID A 余额 10 USD

期望：

- Apple ID A 显示不可用
- 原因：余额不足，需要20 USD，当前10 USD

### 用例 2：地区不匹配

前置：

- 业务要求美区
- Apple ID A 是港区

期望：

- Apple ID A 显示不可用
- 原因：地区不匹配

### 用例 3：状态过期需确认

前置：

- Apple ID A 状态正常
- 最近检测超过配置有效期

期望：

- Apple ID A 显示需确认

## 4. Apple ID 订单创建

前置：

- 客户存在
- 业务存在
- Apple ID 余额足够
- Apple ID 不违反锁定规则

操作：

- 创建 Apple ID 订单

期望：

- 订单创建成功
- 生成开通记录
- 生成余额消费记录
- 生成 Apple ID 锁定记录
- 余额扣减
- 成本扣减
- 利润计算正确
- 写 audit log

### 用例 2：订单利润计算

前置：

- 客户实收 188
- 平台手续费 3
- 退款/补发损耗 0
- Apple 消耗 20 USD
- 当前平均成本 5.6

期望：

- Apple 成本 = 112
- 利润 = 73

### 用例 3：按业务锁定

前置：

- 业务锁定规则为 `by_service`
- Apple ID 已存在同业务 active 锁定记录

期望：

- 自动匹配显示不可用
- 原因：该业务已占用此 Apple ID

### 用例 4：全局锁定

前置：

- 业务锁定规则为 `global`
- Apple ID 已存在任意 active 锁定记录

期望：

- 自动匹配显示不可用
- 原因：全局锁定规则要求账号未被占用

## 4.1 Apple ID 开通记录列表和详情

### 用例 1：订单创建后能查到开通记录

前置：

- 已创建 Apple ID 订单
- 订单已生成 `service_activations`

操作：

- 调用 `GET /api/apple/activations`
- 调用 `GET /api/apple/activations/:id`

期望：

- 列表返回开通记录
- 详情返回订单、客户、Apple ID 脱敏账号、业务、成本、利润、到期时间
- 不返回 Apple ID 明文账号和敏感字段

### 用例 2：到期时间筛选

前置：

- 存在 7 天内到期和 30 天后到期的开通记录

操作：

- 使用 `expireFrom` 和 `expireTo` 查询 7 天内到期

期望：

- 只返回指定日期范围内的开通记录

### 用例 3：到期天数计算

前置：

- 当前时间为 2026-07-01 12:00
- 到期时间为 2026-07-04 00:00

期望：

- `daysUntilExpire = 3`

## 5. 续费任务生成

### 用例 1：提前3天提醒

前置：

- 业务设置提前3天提醒
- 开通记录到期时间为 2026-07-10

操作：

- 系统任务生成日期为 2026-07-07

期望：

- 生成联系客户任务
- 任务状态为 pending
- 任务关联客户、Apple ID、业务、开通记录

### 用例 2：客户确认续费

操作：

- 将续费状态改为客户确认续费

期望：

- 生成或更新以下任务：
  - 收款确认
  - 检查余额
  - Apple ID充值，如果余额不足
  - 等待自动续费
  - 检查续费结果

### 用例 3：客户确认不续费

操作：

- 将续费状态改为客户确认不续费

期望：

- 生成取消订阅任务
- 出现在待取消订阅页面

### 用例 4：生成任务幂等

前置：

- 同一开通记录已有未完成的 contact_customer 任务

操作：

- 再次执行 `POST /api/apple/renewal-tasks/generate-due-tasks`

期望：

- 不重复创建第二条未完成 contact_customer 任务
- 已有任务的优先级、余额快照、截止时间可以被更新
- 返回 updatedCount 增加，createdCount 不因重复任务增加

### 用例 5：余额不足生成待充值续费

前置：

- 客户确认续费
- 预计扣费 20 USD
- Apple ID 当前余额 12 USD

操作：

- 执行到期任务生成

期望：

- 生成 check_balance 任务
- 生成 topup_apple_balance 任务
- suggested_topup_amount = 8
- 不生成 wait_auto_renewal 任务
- 任务出现在待充值续费页面

### 用例 6：余额足够生成等待自动续费

前置：

- 客户确认续费
- 预计扣费 20 USD
- Apple ID 当前余额 30 USD

操作：

- 执行到期任务生成

期望：

- 生成 check_balance 任务
- 生成 wait_auto_renewal 任务
- 不生成 topup_apple_balance 任务
- 任务出现在等待自动续费页面

### 用例 7：客户决定流转回写开通记录

操作：

- 在续费任务中将 customerDecision 更新为 confirmed_no_renewal

期望：

- 对应开通记录 renewal_decision 更新为 no_renew
- 自动生成或更新 cancel_subscription 任务
- 写入 apple_renewal_task.update 审计日志

### 用例 8：任务完成、取消和延期

操作：

- 完成任务并填写处理结果
- 取消任务并填写原因
- 将任务延期 1 天

期望：

- 完成任务状态为 completed，记录 completed_by 和 completed_at
- 取消任务状态为 cancelled，不再作为待办展示
- 延期任务状态为 postponed，due_at 和 remind_at 更新
- 三种操作都写审计日志

### 用例 9：续费任务凭证上传和下载

前置：

- 存在一条未完成续费任务
- 当前用户拥有附件上传和下载权限

操作：

- 打开续费任务详情
- 选择一份处理凭证附件
- 保存任务或标记完成
- 重新打开任务详情并下载凭证

期望：

- 附件上传时写入 business_module = apple、object_type = renewal_task、purpose = evidence
- 续费任务保存 evidence_attachment_id
- 任务详情返回 evidenceAttachment 摘要
- 下载接口返回原始附件内容
- 上传、保存和下载均写入对应审计日志

## 6. Apple ID 操作计划生成

前置：

同一个 Apple ID 有三个业务：

- GPT：客户不续费
- Gemini：客户续费
- Claude：客户未回复

操作：

- 生成 Apple ID 操作计划

期望：

- 计划中显示当前余额
- 计划中显示需要取消业务 GPT
- 计划中显示需要续费业务 Gemini
- 计划中显示等待客户回复业务 Claude
- 如果余额不足，显示建议充值
- 如果存在不续费但未取消业务，显示误扣费风险

### 用例 2：操作计划幂等生成

前置：

- 同一个 Apple ID 今天已经生成过操作计划

操作：

- 再次执行 `POST /api/apple/action-plans/generate`

期望：

- 不创建第二个相同 Apple ID、相同 plan_date 的主计划
- 原计划主表被更新
- 原计划明细先清理再按当前开通记录重建
- 返回 updatedCount 增加

### 用例 3：建议充值计算

前置：

- Apple ID 当前余额 15 USD
- 两个客户确认续费业务预计扣费分别为 20 USD、10 USD

操作：

- 生成操作计划

期望：

- required_renewal_amount = 30
- suggested_topup_amount = 15
- renew_services_count = 2

### 用例 4：误扣费风险

前置：

- 客户确认不续费
- 开通记录 auto_renew_status = enabled 或 unknown

操作：

- 生成操作计划

期望：

- has_wrong_charge_risk = true
- 生成 cancel 明细
- 主计划状态为 abnormal
- 明细 note 提示误扣费风险

### 用例 5：完成操作计划

操作：

- 执行 `POST /api/apple/action-plans/:id/complete`

期望：

- 主计划状态为 completed
- pending 明细更新为 completed
- 记录 completed_by、completed_at
- 写入 apple_action_plan.complete 审计日志

## 6.1 Apple ID 自动化任务中心

### 用例 1：创建自动化任务

前置：

- 存在一个 Apple ID
- 操作人拥有 `apple.automation_task.manage` 权限

操作：

- 创建 `check_balance` 自动化任务
- 输入参数包含验证码或其他上下文

期望：

- 任务状态为 `queued`
- 生成 `queue_job_id`
- 输入参数加密保存，不在响应中返回明文
- 写入自动化任务日志
- 写入操作审计日志，审计日志不包含敏感输入明文

### 用例 2：查询余额占位执行

前置：

- Apple ID 当前系统余额为 50 USD
- 存在 `check_balance` 队列任务

操作：

- 执行占位 Worker 接口

期望：

- 任务状态变为 `success`
- `result_payload.balanceSnapshot = 50`
- `manual_required = false`
- 写入 success 级别任务日志

### 用例 3：真实 Worker 未接入任务转人工

前置：

- 存在 `topup`、`cancel_subscription`、`change_phone` 或 `change_security` 任务
- 真实 Apple ID 自动化 Worker 尚未接入

操作：

- 执行占位 Worker 接口

期望：

- 任务状态变为 `waiting_manual_verify`
- `manual_required = true`
- `error_code = worker_not_configured`
- 写入 warning 级别任务日志

### 用例 4：人工结果回写

前置：

- 存在等待人工验证的自动化任务

操作：

- 人工回写成功结果或失败原因

期望：

- 成功时任务状态变为 `success`
- 失败时任务状态变为 `failed`
- 写入结果 payload 或错误原因
- 写入自动化任务日志
- `check_status` 成功回写时同步生成 Apple ID 状态检测记录

### 用例 5：重试任务

前置：

- 存在 `failed` 或 `waiting_manual_verify` 状态任务

操作：

- 点击重新入队

期望：

- 任务状态变为 `queued`
- `retry_count` 增加 1
- 清空错误码和错误说明
- 重新生成 `queue_job_id`

## 7. 兑换码导入去重

前置：

- 系统中已有兑换码 ABC123

操作：

- 批量导入包含 ABC123 的文件

期望：

- ABC123 导入失败
- 错误原因：兑换码重复
- 其他不重复兑换码正常导入
- 生成导入批次
- 可导出错误行

## 8. 兑换码自动匹配

前置：

- 订单面值 100
- 库存存在未售 100 面值兑换码

操作：

- 自动匹配兑换码

期望：

- 锁定一个 100 面值兑换码
- 兑换码状态变成 locked
- 订单状态变成待发货或处理中

## 9. 兑换码防重复发货

### 用例 1：同一兑换码不能发给两个订单

前置：

- 兑换码 A 已发送给订单1

操作：

- 尝试把兑换码 A 发给订单2

期望：

- 操作失败
- 错误：兑换码已发送

### 用例 2：同一订单不能重复发货

前置：

- 订单1 已发货

操作：

- 再次点击自动发货

期望：

- 操作失败
- 错误：订单已发货

### 用例 3：退款订单不能自动发货

前置：

- 订单1 状态为退款中

操作：

- 点击自动发货

期望：

- 操作失败
- 错误：订单退款中，不能自动发货

## 10. 权限测试

### 用例 1：客服不能查看 Apple ID 密码

用户：

- 客服角色

操作：

- 调用查看 Apple ID 密码接口

期望：

- 返回无权限

### 用例 2：管理员查看密码写日志

用户：

- 管理员角色

操作：

- 查看 Apple ID 密码

期望：

- 返回密码
- audit_logs 生成记录

### 用例 3：发货员查看完整兑换码

用户：

- 发货员，但无 code.inventory.view_full 权限

操作：

- 查看完整兑换码

期望：

- 返回无权限

## 11. Apple ID 批量导入测试

### 用例 1：批量导入成功

前置：

- 管理员拥有 `apple.account.import` 权限
- 导入内容包含表头和 2 行新 Apple ID

操作：

- 调用 `POST /api/apple/accounts/import`
- 字段顺序：`appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark`

期望：

- 返回 `successCount = 2`
- 返回 `failedCount = 0`
- 创建 Apple ID 记录
- 密码、手机号、备用邮箱加密保存
- 列表只显示脱敏 Apple ID 和敏感字段状态
- 写入 `audit_logs`
- 审计日志不记录密码、手机号、备用邮箱明文

### 用例 2：批量导入重复检测

前置：

- 系统中已有 `exists@example.com`
- 导入内容包含 `exists@example.com`
- 导入内容中还有两行相同的新账号

操作：

- 执行批量导入

期望：

- 已存在账号返回失败行
- 本批次重复账号返回失败行
- 其他合法账号正常导入
- 失败行不影响成功行

### 用例 3：批量导入人民币总成本校验

前置：

- 导入行余额为 `0`
- 人民币总成本大于 `0`

操作：

- 执行批量导入

期望：

- 该行失败
- 返回失败原因：余额为 0 时成本必须为 0
- 不创建该 Apple ID

## 12. Apple ID 充值礼品卡代码测试

### 用例 1：礼品卡代码加密保存

前置：

- 管理员或财务录入 Apple ID 充值记录
- 填写礼品卡代码 `ABCD-EFGH-IJKL-1234`

操作：

- 提交充值记录

期望：

- 数据库不保存明文礼品卡代码
- 保存 `gift_card_code_encrypted`
- 保存 `gift_card_code_hash`
- 保存 `gift_card_code_tail = 1234`
- 列表只显示后 4 位
- 充值成本和移动加权平均成本计算不受影响

### 用例 2：礼品卡代码重复检测

前置：

- 系统中已有礼品卡代码 `ABCD-EFGH-IJKL-1234` 的 hash

操作：

- 再次录入相同礼品卡代码

期望：

- 保存失败
- 返回错误：礼品卡代码已使用
- 不新增充值记录
- 不更新 Apple ID 余额和平均成本

### 用例 3：无权限不能查看完整礼品卡代码

用户：

- 客服角色，无 `apple.topup.gift_code.view_full` 权限

操作：

- 调用查看完整礼品卡代码接口

期望：

- 返回无权限
- 不返回完整礼品卡代码
- 不泄露加密字段、hash 字段

### 用例 4：查看完整礼品卡代码写审计日志

用户：

- 管理员角色，拥有 `apple.topup.gift_code.view_full` 权限

操作：

- 查看完整礼品卡代码

期望：

- 返回完整礼品卡代码
- 生成敏感字段查看日志
- 日志记录用户、时间、IP、对象类型、充值记录 ID、字段名
- 日志记录查看原因和礼品卡尾号
- 日志不记录完整礼品卡代码
- 响应头禁止缓存
- 普通应用日志不打印完整礼品卡代码

### 用例 5：Apple ID账号敏感字段查看权限

用户：

- 客服角色，仅拥有 `apple.account.view`

操作：

- 调用 `POST /api/apple/accounts/:id/reveal-secret`
- 请求查看 `password`

期望：

- 返回无权限
- 不返回密码明文
- 不写入成功敏感访问日志

### 用例 6：Apple ID账号敏感字段查看写审计和敏感访问日志

用户：

- 管理员或拥有对应字段权限的角色

操作：

- 调用 `POST /api/apple/accounts/:id/reveal-secret`
- `field = password`
- 填写查看原因

期望：

- 返回本次请求字段的完整明文
- 生成 `sensitive_access_logs`
- 生成 `audit_logs`
- 日志记录用户、时间、IP、对象类型、账号 ID、字段名和查看原因
- 日志不记录密码、密保、手机号、备用邮箱等完整明文
- 响应头禁止缓存

## 13. 通知中心测试

当前自动化覆盖：

- `NotificationsService.triggerEvent` 能按通知规则生成站内通知日志。
- 通知模板能渲染 `title`、`summary`、`detail` 变量。
- 通知规则关闭时，事件触发结果为 skipped，并写入 skipped 通知日志。
- Telegram Bot Token 加密保存，审计日志不记录明文。
- 系统站内通知创建和重试逻辑可用。

### 用例 1：Telegram 通知规则开关

前置：

- 存在 Apple ID 余额不足通知规则
- 通知渠道包含 Telegram

操作：

1. 关闭规则
2. 触发 Apple ID 余额不足事件
3. 打开规则
4. 再次触发 Apple ID 余额不足事件

期望：

- 规则关闭时不发送 Telegram 通知
- 规则开启后发送 Telegram 通知
- 两次触发都写 notification_logs，关闭时状态为 skipped

### 用例 2：Telegram 测试发送

前置：

- Telegram 配置已启用
- Bot Token 和 Chat ID 已配置

操作：

- 点击测试发送

期望：

- 调用 Telegram 测试发送接口
- 成功时记录 last_test_status = success
- 失败时记录 last_test_status = failed 和失败原因
- Bot Token 不在响应和日志中明文出现

### 用例 3：到期任务通知

前置：

- Apple ID 业务设置到期前 3 天提醒
- 业务将在 3 天后到期
- 通知规则“业务到期前3天”已启用

操作：

- 执行续费任务生成

期望：

- 生成续费任务
- 生成通知日志
- Telegram 或站内通知按规则发送

### 用例 4：兑换码低库存通知

前置：

- 某面值兑换码库存低于规则阈值
- 低库存通知规则已启用

操作：

- 执行库存检查

期望：

- 生成低库存通知
- 通知内容包含业务、面值、当前库存、阈值
- 频率限制生效，短时间内不重复刷屏

### 用例 5：自动发货失败通知

前置：

- 兑换码订单自动发货失败
- 自动发货失败通知规则已启用

操作：

- 标记发货失败

期望：

- 通知发货员或配置的通知对象
- 通知日志记录失败订单、平台、失败原因
- 订单转入人工处理状态

### 用例 6：平台接口异常通知

前置：

- Telegram 或文件存储连接失败
- 平台接口异常通知规则已启用

操作：

- 执行平台连接测试或读取平台接口状态

期望：

- 写 platform_sync_logs
- 生成平台接口异常通知
- 通知包含平台、接口类型、失败原因、最近同步时间

### 用例 7：平台授权过期通知

前置：

- 平台授权状态为 not_configured、expired 或 tokenExpiresAt 在 7 天内
- 平台授权通知规则已启用

操作：

- 打开平台接口状态页或调用 `GET /api/ops/platforms`

期望：

- not_configured 或 expired 生成 `platform.auth.invalid` 通知
- tokenExpiresAt 在 7 天内生成 `platform.auth.expiring` 通知
- 通知内容包含平台、授权状态、Token 有效期和处理提示
- 同一事件 1 小时内重复读取平台状态不会重复刷屏

### 用例 7.1：平台接口统计增强

前置：

- `platform_sync_logs` 中存在同一平台最近 30 天的成功、失败和重试日志
- 日志包含 `requestCount`、`errorRate`、`errorMessage`、`metadata.retryCount` 或 `syncType` 包含 `retry`

操作：

- 调用 `GET /api/ops/platforms/:platform`
- 打开平台接口状态页

期望：

- 返回总调用次数、失败请求数、失败日志数、最近失败时间、重试记录数和最近重试时间
- 错误率按失败请求数 / 总请求数计算，而不是按日志条数简单平均
- 平台接口状态表格可以展示、排序和列配置这些字段
- 最近失败原因仍来自最近一条失败日志的 `errorMessage`

### 用例 7.2：通用平台状态刷新

前置：

- `platform_sync_logs` 中存在通用平台连接日志
- 平台接口状态页可访问

操作：

- 调用 `GET /api/ops/platforms`
- 打开平台接口状态页

期望：

- 返回 Telegram、文件存储、自动化服务等通用平台状态
- 统计最近同步时间、失败原因、失败请求数和错误率
- 连接异常时生成平台接口异常通知

### 用例 7.3：平台授权配置加密保存

前置：

- 操作人拥有 `ops.platform.reauthorize` 权限
- 平台为 `telegram` 或 `file-storage`

操作：

- 在平台接口状态页打开“授权配置”
- 填写 `appKey`、`appSecret`、`accessToken`、`refreshToken`、`tokenExpiresAt`
- 保存配置

期望：

- 敏感字段加密写入 `system_parameters` 的 `platform_auth` 分组
- API 只返回 `hasAppKey`、`appKeyTail`、`hasAccessToken`、`accessTokenTail`、`tokenExpiresAt` 等脱敏字段
- 审计日志不包含 appSecret、accessToken、refreshToken 明文
- 写入一条 `platform_sync_logs`，`syncType=authorization_config`
- 平台状态页授权状态可显示为 configured 或 expiring/expired
- 测试连接不能伪装真实成功，未配置时应提示授权或连接信息缺失

### 用例 7.4：平台 OAuth 发起和回调授权码托管

前置：

- 操作人拥有 `ops.platform.reauthorize` 权限
- 平台为 `telegram` 或 `file-storage`
- 已保存 `appKey` 和 `authorizationUrl`

操作：

- 在平台接口状态页打开“授权配置”
- 填写或确认 `authorizationUrl`、`redirectUri`、`clientIdParam` 和授权范围
- 点击“发起 OAuth”
- 平台回调 `GET /api/ops/platforms/:platform/oauth/callback?code=xxx&state=yyy`

期望：

- 发起 OAuth 时生成带 `client_id`、`redirect_uri`、`response_type=code`、`state`、`scope` 的授权链接
- state hash 写入 `system_parameters` 的 `platform_oauth_state` 分组，默认 10 分钟过期
- 回调时必须校验 state 存在、未过期且状态为 pending
- 授权码完整内容加密保存，不返回明文
- 写入 `platform_sync_logs`，`syncType` 分别为 `oauth_start` 和 `oauth_callback`
- 写入 `audit_logs`，记录发起授权和回调处理
- 当前不应伪装 token exchange 已完成，真实平台 token 换取和刷新仍等待 Adapter 接入

### 用例 8：异常登录通知

前置：

- 系统检测到异常 IP 或异常设备登录
- 异常登录通知规则已启用

操作：

- 用户登录成功但被识别为异常登录

期望：

- 写 login_logs，abnormal = true
- 生成异常登录通知
- 通知安全负责人或管理员

### 用例 9：连续登录失败通知

前置：

- 连续登录失败通知规则已启用
- 同一账号或同一 IP 在 15 分钟内已有 4 次 failed / blocked 登录记录

操作：

- 再次使用错误密码或被禁用账号登录

期望：

- 本次写 login_logs，abnormal = true
- 触发 `security.login.failed_many`
- 通知 payload 包含 failureCount = 5、threshold = 5、windowMinutes = 15
- 单次失败未达到阈值时只记录登录日志，不触发连续失败通知

### 用例 10：数据备份失败通知

前置：

- 数据备份任务失败
- 备份失败通知规则已启用

操作：

- 备份任务结束并标记 failed

期望：

- 写 backup_jobs 失败原因
- 生成备份失败通知
- 通知包含任务 ID、备份类型、失败原因

## 13. 数据中心测试

### 用例 1：数据导入真实执行器

前置：

- 已创建 data_import_jobs，模块为 customers
- `DATA_IMPORT_DIR` 中存在 CSV 文件
- 用户拥有 data.import.create 权限

操作：

- 调用 `POST /api/data/import-jobs/:id/execute`

期望：

- 读取受控目录内 CSV 文件，不允许任意系统路径
- 有效客户行写入 customers
- 无效行不落库
- 任务写入 totalCount、successCount、failedCount
- 失败行生成 CSV 错误报告
- 写 data.import.execute.success 或 data.import.execute.failed 审计日志

### 用例 2：导入错误报告下载审计

前置：

- 导入任务存在 errorReport
- 错误报告文件存在

操作：

- 调用 `GET /api/data/import-jobs/:id/error-report`

期望：

- 返回 CSV 文件流
- 写 data.import.error_report.download 审计日志

### 用例 3：数据导出真实执行器

前置：

- 已创建 data_export_jobs，模块为 customers
- 用户拥有 data.export.create 权限

操作：

- 调用 `POST /api/data/export-jobs/:id/execute`

期望：

- 任务状态从 pending/running 变为 success
- 生成 CSV 文件
- 写入 filePath 和 downloadExpiresAt
- 不导出完整手机号、完整 Apple ID 密码、完整兑换码、完整礼品卡代码等敏感原文
- 写 data.export.execute.success 审计日志

### 用例 4：导出文件下载审计

前置：

- 导出任务状态为 success
- 文件存在且 downloadExpiresAt 未过期

操作：

- 调用 `GET /api/data/export-jobs/:id/download`

期望：

- 返回 CSV 文件流
- 写 data.export.download 审计日志
- downloadExpiresAt 过期时拒绝下载

## 14. 通用表格能力测试

### 用例 1：表格视图保存

前置：

- 用户打开任意列表页
- 修改列显示、表格密度、筛选条件、排序和每页条数

操作：

- 点击保存视图，命名为“我的常用视图”

期望：

- 保存到 user_table_views
- 该视图只属于当前用户
- 再次进入页面可选择该视图
- 不影响其他用户的表格配置

### 用例 2：日期快捷筛选

前置：

- 列表页存在创建时间或操作时间字段

操作：

- 分别选择今天、昨天、近 7 天、近 30 天、本月、上月、自定义

期望：

- 每个快捷项转换成正确的开始时间和结束时间
- 自定义日期优先使用用户选择的范围
- 筛选标签正确回显
- 清空筛选后恢复默认列表

## 14. 客户敏感字段测试

### 用例 1：无权限不能查看完整手机号

前置：

- 客户存在手机号
- 当前用户只有 `customer.view` 权限

操作：

- 调用 `POST /api/customers/:id/reveal-phone`

期望：

- 返回 403
- 不返回完整手机号
- 不写成功查看日志

### 用例 2：查看完整手机号必须填写原因

前置：

- 客户存在手机号
- 当前用户拥有 `customer.view_phone` 权限

操作：

- 查看原因为空时调用 `reveal-phone`

期望：

- 返回参数错误
- 不返回完整手机号

### 用例 3：查看完整手机号写日志且不泄露明文

前置：

- 客户存在手机号
- 当前用户拥有 `customer.view_phone` 权限

操作：

- 填写原因并调用 `reveal-phone`

期望：

- 返回完整手机号
- 写入 `sensitive_access_logs`
- 写入 `audit_logs`
- 审计日志只记录手机号尾号，不记录完整手机号

## 15. 数据中心备份和恢复执行器测试

### 用例 1：执行数据库备份任务

前置：

- 存在 pending 状态的 database 备份任务
- `DATA_BACKUP_DIR` 已配置到受控备份目录

操作：

- 调用 `POST /api/data/backup-jobs/:id/execute`

期望：

- 任务状态先进入 running
- 后端调用 `scripts/backup-postgres.sh`
- 成功后状态变为 success
- 写入 `storagePath`、`fileSize`、`finishedAt`
- 写入 `data.backup.execute.success` 审计日志

### 用例 2：备份失败写失败状态和通知

前置：

- 备份脚本执行失败
- 备份失败通知规则已启用

操作：

- 调用 `POST /api/data/backup-jobs/:id/execute`

期望：

- 任务状态变为 failed
- 写入 `errorMessage`
- 写入 `data.backup.execute.failed` 审计日志
- 触发 `ops.backup.failed` 通知事件

### 用例 3：恢复演练必须强确认

前置：

- 存在 pending 状态恢复任务
- 恢复任务已关联成功备份任务

操作：

- 使用错误 `confirmText` 调用 `POST /api/data/restore-jobs/:id/execute`

期望：

- 返回参数错误
- 不执行恢复脚本
- 不修改任务为 running

### 用例 4：执行恢复演练

前置：

- 存在 pending 状态恢复任务
- 关联备份任务存在 `storagePath`
- 备份文件位于 `DATA_BACKUP_DIR`

操作：

- 使用 `CONFIRM_RESTORE_DRILL {restoreJobId前8位}` 调用 `POST /api/data/restore-jobs/:id/execute`

期望：

- 任务状态先进入 running
- 后端调用 `scripts/verify-postgres-restore.sh`
- 备份恢复到临时数据库验证，不覆盖当前业务库
- 成功后状态变为 success
- 写入 `data.restore.execute.success` 审计日志

### 用例 5：恢复文件路径越界拦截

前置：

- 恢复任务关联的备份任务 `storagePath` 指向 `DATA_BACKUP_DIR` 外部路径

操作：

- 调用 `POST /api/data/restore-jobs/:id/execute`

期望：

- 返回参数错误
- 不执行恢复脚本
- 不读取任意系统路径

## 16. MFA 登录安全测试

### 用例 1：MFA 密钥加密保存

前置：

- 用户已登录安全中心

操作：

- 调用 `POST /api/security/mfa/me/setup`

期望：

- 返回 TOTP 密钥和 `otpauthUrl`
- 数据库存储 `secretEncrypted`
- 不明文保存 TOTP 密钥
- 写入 `security.mfa.setup` 审计日志

### 用例 2：启用 MFA 生成恢复码

前置：

- 用户已生成 MFA 绑定密钥

操作：

- 使用正确动态验证码调用 `POST /api/security/mfa/me/enable`

期望：

- MFA 状态变为启用
- 一次性返回 10 个恢复码
- 恢复码只保存 hash
- 写入 `security.mfa.enable` 审计日志

### 用例 3：恢复码只能使用一次

前置：

- 用户已启用 MFA
- 用户持有恢复码

操作：

- 使用同一个恢复码连续两次登录或验证

期望：

- 第一次通过
- 第二次失败
- 剩余恢复码数量减少 1

### 用例 4：已绑定 MFA 但登录缺少验证码

前置：

- 用户已启用 MFA

操作：

- 只提交账号和密码登录

期望：

- 返回未授权错误
- 不签发 JWT
- 写入 `login_logs`，状态为 `blocked`，失败原因为 `mfa_required`

### 用例 5：已绑定 MFA 但验证码错误

前置：

- 用户已启用 MFA

操作：

- 提交错误动态验证码登录

期望：

- 返回未授权错误
- 不签发 JWT
- 写入 `login_logs`，状态为 `blocked`，失败原因为 `mfa_invalid`

### 用例 6：管理员重置用户 MFA

前置：

- 操作人拥有 `security.mfa.manage` 权限
- 目标用户已启用 MFA

操作：

- 调用 `POST /api/security/mfa/users/:userId/reset`

期望：

- 目标用户 MFA 状态变为未启用
- 清空密钥和恢复码
- 写入 `security.mfa.admin_reset` 审计日志
