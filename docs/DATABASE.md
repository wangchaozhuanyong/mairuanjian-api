# 数据库设计

## 1. 通用规则

- 数据库：PostgreSQL
- ORM：Prisma
- 所有金额字段使用 Decimal
- 所有时间字段使用 timestamptz
- 所有表建议包含 created_at、updated_at、deleted_at
- 重要业务表包含 created_by、updated_by
- 敏感字段必须加密保存
- 搜索和去重使用 hash 字段
- 软删除使用 deleted_at

## 2. 公共表

### 2.1 users

| 字段          | 类型        | 说明            |
| ------------- | ----------- | --------------- |
| id            | uuid        | 主键            |
| username      | varchar     | 登录名，唯一    |
| password_hash | varchar     | 密码哈希        |
| display_name  | varchar     | 显示名          |
| phone         | varchar     | 手机，脱敏展示  |
| email         | varchar     | 邮箱            |
| status        | varchar     | active/disabled |
| last_login_at | timestamptz | 最后登录时间    |
| created_at    | timestamptz | 创建时间        |
| updated_at    | timestamptz | 更新时间        |
| deleted_at    | timestamptz | 软删除          |

索引：

- unique(username)
- index(status)

### 2.2 roles

| 字段        | 类型        | 说明           |
| ----------- | ----------- | -------------- |
| id          | uuid        | 主键           |
| name        | varchar     | 角色名称       |
| code        | varchar     | 角色编码，唯一 |
| description | text        | 说明           |
| created_at  | timestamptz | 创建时间       |
| updated_at  | timestamptz | 更新时间       |

角色建议：

- admin
- customer_service
- delivery_staff
- finance
- operation
- technician
- auditor

### 2.3 permissions

| 字段       | 类型        | 说明           |
| ---------- | ----------- | -------------- |
| id         | uuid        | 主键           |
| name       | varchar     | 权限名称       |
| code       | varchar     | 权限编码，唯一 |
| module     | varchar     | 模块           |
| action     | varchar     | 动作           |
| created_at | timestamptz | 创建时间       |

### 2.4 user_roles

| 字段    | 类型 | 说明 |
| ------- | ---- | ---- |
| user_id | uuid | 用户 |
| role_id | uuid | 角色 |

唯一约束：

- unique(user_id, role_id)

### 2.5 role_permissions

| 字段          | 类型 | 说明 |
| ------------- | ---- | ---- |
| role_id       | uuid | 角色 |
| permission_id | uuid | 权限 |

唯一约束：

- unique(role_id, permission_id)

### 2.6 customers

| 字段                 | 类型          | 说明                   |
| -------------------- | ------------- | ---------------------- |
| id                   | uuid          | 主键                   |
| wechat_id            | varchar       | 微信号                 |
| wechat_nickname      | varchar       | 微信昵称               |
| phone_encrypted      | text          | 手机号加密             |
| phone_hash           | varchar       | 手机号 hash            |
| phone_tail           | varchar       | 手机尾号               |
| external_customer_id | varchar       | 外部来源客户 ID        |
| source_platform_id   | uuid          | 来源平台               |
| tags                 | text[]        | 标签                   |
| blacklist_status     | varchar       | normal/watch/blacklist |
| total_spent          | decimal(18,2) | 累计消费               |
| active_service_count | int           | 开通中业务数           |
| last_order_at        | timestamptz   | 最近下单时间           |
| remark               | text          | 备注                   |
| created_at           | timestamptz   | 创建时间               |
| updated_at           | timestamptz   | 更新时间               |
| deleted_at           | timestamptz   | 软删除                 |

索引：

- index(wechat_id)
- index(phone_hash)
- index(external_customer_id)
- index(source_platform_id)

### 2.7 source_platforms

| 字段        | 类型          | 说明                      |
| ----------- | ------------- | ------------------------- |
| id          | uuid          | 主键                      |
| name        | varchar       | 平台名称                  |
| fee_rate    | Decimal(8,4)  | 平台费率                  |
| fee_fixed   | Decimal(12,2) | 固定费用                  |
| status      | enum          | active/disabled           |
| remark      | text          | 备注                      |
| auth_status | varchar       | none/authorized/expired   |
| fee_type    | varchar       | none/fixed/percent/manual |
| fee_value   | decimal(18,4) | 手续费值                  |
| remark      | text          | 备注                      |
| created_at  | timestamptz   | 创建时间                  |
| updated_at  | timestamptz   | 更新时间                  |

### 2.8 message_templates

说明：当前表名沿用 `message_templates`，业务含义已经收敛为兑换码发货模板；系统通知模板走通知设置相关表，不和兑换码发货模板混用。

| 字段       | 类型        | 说明     |
| ---------- | ----------- | -------- |
| id         | uuid        | 主键     |
| name       | varchar     | 模板名称 |
| type       | varchar     | 模板类型 |
| content    | text        | 内容     |
| variables  | jsonb       | 变量说明 |
| enabled    | boolean     | 是否启用 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 2.9 audit_logs

| 字段        | 类型        | 说明     |
| ----------- | ----------- | -------- |
| id          | uuid        | 主键     |
| user_id     | uuid        | 操作人   |
| module      | varchar     | 模块     |
| action      | varchar     | 动作     |
| object_type | varchar     | 对象类型 |
| object_id   | uuid        | 对象 ID  |
| before_data | jsonb       | 修改前   |
| after_data  | jsonb       | 修改后   |
| ip          | varchar     | IP       |
| user_agent  | text        | 浏览器   |
| remark      | text        | 备注     |
| created_at  | timestamptz | 创建时间 |

索引：

- index(user_id)
- index(module, action)
- index(object_type, object_id)
- index(created_at)

### 2.10 attachments

| 字段               | 类型        | 说明         |
| ------------------ | ----------- | ------------ |
| id                 | uuid        | 主键         |
| original_name      | varchar     | 原始文件名   |
| storage_key        | varchar     | 存储键，唯一 |
| mime_type          | varchar     | 文件类型     |
| size_bytes         | bigint      | 文件大小     |
| business_module    | varchar     | 业务模块     |
| object_type        | varchar     | 关联对象类型 |
| object_id          | uuid        | 关联对象 ID  |
| purpose            | varchar     | 附件用途     |
| remark             | text        | 备注         |
| created_by_user_id | uuid        | 上传人       |
| created_at         | timestamptz | 创建时间     |

索引：

- unique(storage_key)
- index(created_by_user_id)
- index(business_module, object_type)
- index(object_id)
- index(purpose)
- index(created_at)

说明：

- 当前本地开发使用 `ATTACHMENT_STORAGE_DIR` 指定目录。
- 后续切换 MinIO 时保持 `storage_key` 对外语义不变。
- 附件详情和列表只返回元数据，不返回本地文件系统绝对路径。
- 文件下载必须通过受权限控制的下载接口，并写入审计日志。

## 3. Apple ID 业务表

### 3.1 apple_accounts

| 字段                  | 类型        | 说明                                                  |
| --------------------- | ----------- | ----------------------------------------------------- |
| id                    | uuid        | 主键                                                  |
| account               | varchar     | Apple ID 账号                                         |
| account_hash          | varchar     | Apple ID hash                                         |
| account_masked        | varchar     | 脱敏账号                                              |
| region                | varchar     | 地区                                                  |
| currency              | varchar     | 币种                                                  |
| status                | varchar     | normal/need_verify/locked/password_error/risk/unknown |
| phone_tail            | varchar     | 绑定手机尾号                                          |
| backup_email_masked   | varchar     | 备用邮箱脱敏                                          |
| tags                  | text[]      | 标签                                                  |
| remark                | text        | 备注                                                  |
| manual_locked         | boolean     | 是否手动锁定                                          |
| last_status_check_at  | timestamptz | 最近状态检测时间                                      |
| last_balance_check_at | timestamptz | 最近余额检测时间                                      |
| created_by            | uuid        | 创建人                                                |
| updated_by            | uuid        | 更新人                                                |
| created_at            | timestamptz | 创建时间                                              |
| updated_at            | timestamptz | 更新时间                                              |
| deleted_at            | timestamptz | 软删除                                                |

索引：

- unique(account_hash)
- index(region)
- index(currency)
- index(status)
- index(manual_locked)

### 3.2 apple_account_secrets

| 字段                         | 类型        | 说明           |
| ---------------------------- | ----------- | -------------- |
| id                           | uuid        | 主键           |
| apple_account_id             | uuid        | Apple ID       |
| password_encrypted           | text        | 密码加密       |
| security_questions_encrypted | text        | 密保问题加密   |
| security_answers_encrypted   | text        | 密保答案加密   |
| birth_date_encrypted         | text        | 出生日期加密   |
| trusted_phone_encrypted      | text        | 可信手机号加密 |
| backup_email_encrypted       | text        | 备用邮箱加密   |
| created_at                   | timestamptz | 创建时间       |
| updated_at                   | timestamptz | 更新时间       |

唯一约束：

- unique(apple_account_id)

### 3.3 apple_balance_summary

| 字段                    | 类型          | 说明               |
| ----------------------- | ------------- | ------------------ |
| id                      | uuid          | 主键               |
| apple_account_id        | uuid          | Apple ID           |
| currency                | varchar       | 币种               |
| current_balance         | decimal(18,4) | 当前余额           |
| current_cost_rmb        | decimal(18,2) | 当前余额人民币成本 |
| avg_unit_cost           | decimal(18,6) | 当前平均成本       |
| total_topup_value       | decimal(18,4) | 累计充值面值       |
| total_topup_cost_rmb    | decimal(18,2) | 累计充值成本       |
| total_consumed_value    | decimal(18,4) | 累计消费面值       |
| total_consumed_cost_rmb | decimal(18,2) | 累计消费成本       |
| last_topup_at           | timestamptz   | 最近充值时间       |
| last_consumed_at        | timestamptz   | 最近消费时间       |
| updated_at              | timestamptz   | 更新时间           |

唯一约束：

- unique(apple_account_id, currency)

### 3.4 apple_balance_topups

| 字段             | 类型          | 说明           |
| ---------------- | ------------- | -------------- |
| id               | uuid          | 主键           |
| apple_account_id | uuid          | Apple ID       |
| face_value       | decimal(18,4) | 充值面值       |
| currency         | varchar       | 币种           |
| unit_avg_cost    | decimal(18,6) | 本次平均成本   |
| cost_rmb         | decimal(18,2) | 人民币成本     |
| balance_before   | decimal(18,4) | 充值前余额     |
| balance_after    | decimal(18,4) | 充值后余额     |
| cost_before      | decimal(18,2) | 充值前余额成本 |
| cost_after       | decimal(18,2) | 充值后余额成本 |
| avg_cost_before  | decimal(18,6) | 充值前平均成本 |
| avg_cost_after   | decimal(18,6) | 充值后平均成本 |
| source           | varchar       | 来源           |
| voucher_remark   | text          | 凭证备注       |
| operator_id      | uuid          | 操作人         |
| remark           | text          | 备注           |
| created_at       | timestamptz   | 充值时间       |

索引：

- index(apple_account_id)
- index(created_at)

### 3.5 apple_balance_consumptions

| 字段             | 类型          | 说明           |
| ---------------- | ------------- | -------------- |
| id               | uuid          | 主键           |
| apple_account_id | uuid          | Apple ID       |
| order_id         | uuid          | 订单           |
| activation_id    | uuid          | 开通记录       |
| service_id       | uuid          | 业务           |
| consumed_value   | decimal(18,4) | 消耗金额       |
| currency         | varchar       | 币种           |
| avg_unit_cost    | decimal(18,6) | 消费时平均成本 |
| cost_rmb         | decimal(18,2) | 本次人民币成本 |
| balance_before   | decimal(18,4) | 消费前余额     |
| balance_after    | decimal(18,4) | 消费后余额     |
| cost_before      | decimal(18,2) | 消费前成本     |
| cost_after       | decimal(18,2) | 消费后成本     |
| created_at       | timestamptz   | 消费时间       |

索引：

- index(apple_account_id)
- index(order_id)
- index(activation_id)

### 3.6 apple_balance_adjustments

| 字段                   | 类型          | 说明                    |
| ---------------------- | ------------- | ----------------------- |
| id                     | uuid          | 主键                    |
| apple_account_id       | uuid          | Apple ID                |
| old_balance            | decimal(18,4) | 原余额                  |
| new_balance            | decimal(18,4) | 新余额                  |
| difference             | decimal(18,4) | 差额                    |
| old_cost_rmb           | decimal(18,2) | 原成本                  |
| new_cost_rmb           | decimal(18,2) | 新成本                  |
| cost_adjust_method     | varchar       | none/current_avg/manual |
| cost_rmb_change        | decimal(18,2) | 成本变化                |
| reason                 | text          | 原因                    |
| evidence_attachment_id | uuid          | 凭证                    |
| operator_id            | uuid          | 操作人                  |
| created_at             | timestamptz   | 时间                    |

### 3.7 apple_account_status_checks

| 字段                   | 类型          | 说明              |
| ---------------------- | ------------- | ----------------- |
| id                     | uuid          | 主键              |
| apple_account_id       | uuid          | Apple ID          |
| check_type             | varchar       | manual/automation |
| result_status          | varchar       | 结果              |
| balance_snapshot       | decimal(18,4) | 余额快照          |
| remark                 | text          | 备注              |
| evidence_attachment_id | uuid          | 凭证              |
| operator_id            | uuid          | 操作人            |
| created_at             | timestamptz   | 检测时间          |

### 3.8 apple_services

| 字段                           | 类型          | 说明                                   |
| ------------------------------ | ------------- | -------------------------------------- |
| id                             | uuid          | 主键                                   |
| name                           | varchar       | 业务名称                               |
| category                       | varchar       | 分类，例如 chatgpt/gemini/claude       |
| default_price                  | decimal(18,2) | 兼容旧字段；客户实际售价在订单录入填写 |
| official_base_price            | decimal(18,4) | 官网公开套餐价格                       |
| official_cost_value            | decimal(18,4) | Apple 余额实际开通/消耗金额            |
| apple_balance_price_rule_type  | enum          | inherit/percent/fixed_add/manual       |
| apple_balance_price_rule_value | decimal(18,4) | 单项规则数值，百分比倍数或固定加价     |
| currency                       | varchar       | 官网价和 Apple 余额价币种              |
| default_period_type            | varchar       | month/day/manual                       |
| default_period_value           | int           | 周期值                                 |
| expire_calc_type               | varchar       | by_month/by_day/manual                 |
| require_apple_id               | boolean       | 是否需要 Apple ID                      |
| require_service_account        | boolean       | 是否需要客户网站账号                   |
| auto_match_apple_id            | boolean       | 是否自动匹配                           |
| lock_rule                      | varchar       | by_service/global                      |
| allowed_regions                | text[]        | 允许地区                               |
| min_balance_required           | decimal(18,4) | 最低余额                               |
| status                         | varchar       | enabled/paused/disabled                |
| remark                         | text          | 备注                                   |
| created_at                     | timestamptz   | 创建时间                               |
| updated_at                     | timestamptz   | 更新时间                               |

### 3.9 apple_service_platform_mappings

| 字段               | 类型          | 说明             |
| ------------------ | ------------- | ---------------- |
| id                 | uuid          | 主键             |
| service_id         | uuid          | Apple ID 业务    |
| source_platform_id | uuid          | 来源平台         |
| shop_name          | varchar       | 店铺             |
| platform_item_id   | varchar       | 商品 ID          |
| platform_sku_id    | varchar       | SKU ID           |
| sku_keyword        | varchar       | SKU 关键词       |
| platform_price     | decimal(18,2) | 平台售价         |
| platform_fee_type  | varchar       | 手续费类型       |
| platform_fee_value | decimal(18,4) | 手续费           |
| allow_auto_order   | boolean       | 是否自动生成订单 |
| enabled            | boolean       | 是否启用         |
| created_at         | timestamptz   | 创建时间         |
| updated_at         | timestamptz   | 更新时间         |

### 3.10 apple_orders

| 字段                      | 类型          | 说明                                        |
| ------------------------- | ------------- | ------------------------------------------- |
| id                        | uuid          | 主键                                        |
| order_no                  | varchar       | 系统订单号，唯一                            |
| customer_id               | uuid          | 客户                                        |
| source_platform_id        | uuid          | 来源平台                                    |
| external_order_no         | varchar       | 平台订单号                                  |
| service_id                | uuid          | 业务                                        |
| apple_account_id          | uuid          | Apple ID                                    |
| service_account           | varchar       | 客户网站账号                                |
| current_plan              | varchar       | 当前套餐                                    |
| target_plan               | varchar       | 目标套餐                                    |
| start_time                | timestamptz   | 开通时间                                    |
| expire_time               | timestamptz   | 到期时间                                    |
| paid_amount               | decimal(18,2) | 客户实收原币种金额                          |
| paid_currency             | varchar       | 客户实收币种，CNY/MYR/USD/USDT              |
| paid_exchange_rate_to_rmb | decimal(18,8) | 客户实收币种折人民币汇率                    |
| paid_amount_rmb           | decimal(18,4) | 客户实收折人民币金额                        |
| platform_fee              | decimal(18,2) | 平台手续费                                  |
| platform_fee_rmb          | decimal(18,4) | 平台手续费折人民币金额                      |
| refund_loss               | decimal(18,2) | 退款/补发损耗                               |
| refund_loss_rmb           | decimal(18,4) | 退款/补发损耗折人民币金额                   |
| apple_cost_value          | decimal(18,4) | 消耗外币                                    |
| apple_cost_rmb            | decimal(18,4) | Apple 成本                                  |
| profit_amount             | decimal(18,4) | 利润                                        |
| status                    | varchar       | pending/active/completed/cancelled/abnormal |
| remark                    | text          | 备注                                        |
| created_by                | uuid          | 创建人                                      |
| created_at                | timestamptz   | 创建时间                                    |
| updated_at                | timestamptz   | 更新时间                                    |

索引：

- index(customer_id)
- index(apple_account_id)
- index(service_id)
- unique(order_no)
- unique(source_platform_id, external_order_no) where external_order_no is not null

当前实现补充：

- `apple_orders` 创建后立即生成一条 `service_activations`。
- 需要 Apple ID 的业务会生成 `apple_balance_consumptions`，扣减 Apple ID 余额和余额成本。
- 需要 Apple ID 的业务会生成 `apple_account_locks`，锁定范围由业务 `lock_rule` 决定。
- `profit_amount = paid_amount_rmb - platform_fee_rmb - refund_loss_rmb - apple_cost_rmb`。
- 第一版暂不实现订单取消后的余额回滚，取消流程后续必须单独设计反向流水。

### 3.11 service_activations

| 字段                      | 类型          | 说明                                   |
| ------------------------- | ------------- | -------------------------------------- |
| id                        | uuid          | 主键                                   |
| order_id                  | uuid          | 订单                                   |
| customer_id               | uuid          | 客户                                   |
| apple_account_id          | uuid          | Apple ID                               |
| service_id                | uuid          | 业务                                   |
| current_plan              | varchar       | 当前套餐                               |
| target_plan               | varchar       | 目标套餐                               |
| start_time                | timestamptz   | 开通时间                               |
| expire_time               | timestamptz   | 到期时间                               |
| consumed_value            | decimal(18,4) | 消耗金额                               |
| currency                  | varchar       | 币种                                   |
| avg_unit_cost             | decimal(18,6) | 消费时平均成本                         |
| cost_rmb                  | decimal(18,2) | 成本                                   |
| paid_amount               | decimal(18,2) | 实收原币种金额                         |
| paid_currency             | varchar       | 实收币种                               |
| paid_exchange_rate_to_rmb | decimal(18,8) | 实收币种折人民币汇率                   |
| paid_amount_rmb           | decimal(18,4) | 实收折人民币金额                       |
| platform_fee              | decimal(18,2) | 平台手续费                             |
| platform_fee_rmb          | decimal(18,4) | 平台手续费折人民币金额                 |
| refund_loss               | decimal(18,2) | 损耗                                   |
| refund_loss_rmb           | decimal(18,4) | 损耗折人民币金额                       |
| profit_amount             | decimal(18,2) | 利润                                   |
| source_platform_id        | uuid          | 来源平台                               |
| external_order_no         | varchar       | 平台订单号                             |
| status                    | varchar       | active/expired/cancelled/abnormal      |
| auto_renew_status         | varchar       | enabled/disabled/unknown               |
| renewal_decision          | varchar       | unconfirmed/renew/no_renew/change_plan |
| renewal_note              | text          | 续费备注                               |
| created_at                | timestamptz   | 创建时间                               |
| updated_at                | timestamptz   | 更新时间                               |

索引：

- index(apple_account_id, service_id, status)
- index(expire_time)
- index(customer_id)

### 3.12 apple_account_locks

| 字段             | 类型        | 说明                    |
| ---------------- | ----------- | ----------------------- |
| id               | uuid        | 主键                    |
| apple_account_id | uuid        | Apple ID                |
| service_id       | uuid        | 业务，可为空            |
| order_id         | uuid        | 订单，可为空            |
| lock_scope       | varchar     | by_service/global       |
| status           | varchar     | active/released/expired |
| reason           | text        | 原因                    |
| locked_at        | timestamptz | 锁定时间                |
| released_at      | timestamptz | 释放时间                |
| created_by       | uuid        | 创建人                  |
| created_at       | timestamptz | 创建时间                |
| updated_at       | timestamptz | 更新时间                |

索引：

- index(apple_account_id, status)
- index(service_id, status)
- index(order_id)
- index(lock_scope, status)

### 3.13 renewal_tasks

当前已在 `20260618034803_phase_5_renewal_tasks` 迁移中落库。第一版用于 Apple ID 续费任务中心，不属于兑换码业务，不和兑换码发货任务混用。

| 字段                   | 类型          | 说明                   |
| ---------------------- | ------------- | ---------------------- |
| id                     | uuid          | 主键                   |
| task_type              | enum          | 任务类型               |
| title                  | varchar       | 标题                   |
| status                 | enum          | 状态                   |
| priority               | enum          | low/medium/high/urgent |
| customer_id            | uuid          | 客户                   |
| apple_account_id       | uuid          | Apple ID               |
| service_id             | uuid          | 业务                   |
| activation_id          | uuid          | 开通记录               |
| order_id               | uuid          | 订单                   |
| current_plan           | varchar       | 当前套餐               |
| target_plan            | varchar       | 目标套餐               |
| customer_decision      | enum          | 客户决定               |
| required_action        | varchar       | 需要动作               |
| current_balance        | decimal(18,4) | 当前余额               |
| expected_charge_amount | decimal(18,4) | 预计扣费               |
| suggested_topup_amount | decimal(18,4) | 建议充值               |
| expected_charge_time   | timestamptz   | 预计扣费               |
| cancel_deadline        | timestamptz   | 最晚取消               |
| remind_at              | timestamptz   | 提醒时间               |
| due_at                 | timestamptz   | 截止时间               |
| assigned_to            | uuid          | 负责人                 |
| note                   | text          | 任务备注               |
| result_note            | text          | 处理结果               |
| evidence_attachment_id | uuid          | 凭证                   |
| created_by             | uuid          | 创建人                 |
| completed_by           | uuid          | 完成人                 |
| created_at             | timestamptz   | 创建时间               |
| updated_at             | timestamptz   | 更新时间               |
| completed_at           | timestamptz   | 完成时间               |

索引：

- index(status)
- index(task_type)
- index(priority)
- index(apple_account_id)
- index(customer_id)
- index(service_id)
- index(activation_id)
- index(order_id)
- index(due_at)
- index(assigned_to)
- index(customer_decision)

幂等规则：

- `generate-due-tasks` 生成任务时，按 `activation_id + task_type + 未完成状态` 检查已有任务。
- 如果存在未完成任务，只更新余额、预计扣费、建议充值、优先级、提醒时间、截止时间等快照。
- 如果任务已 completed/cancelled，后续重新生成可以创建新的任务。

### 3.14 apple_account_action_plans

当前已在 `20260618051239_phase_5_action_plans` 迁移中落库。该表只属于 Apple ID 业务，用于把同一个 Apple ID 下的临期续费、取消、等待客户和误扣费风险动作聚合为一个操作计划。

| 字段                    | 类型          | 说明                                  |
| ----------------------- | ------------- | ------------------------------------- |
| id                      | uuid          | 主键                                  |
| apple_account_id        | uuid          | Apple ID                              |
| plan_date               | date          | 计划日期                              |
| current_balance         | decimal(18,4) | 当前余额                              |
| avg_unit_cost           | decimal(18,6) | 平均成本                              |
| active_service_count    | int           | 开通业务数                            |
| renew_services_count    | int           | 需要续费数                            |
| cancel_services_count   | int           | 需要取消数                            |
| pending_customer_count  | int           | 等客户数                              |
| required_renewal_amount | decimal(18,4) | 预计续费金额                          |
| suggested_topup_amount  | decimal(18,4) | 建议充值                              |
| has_wrong_charge_risk   | boolean       | 是否有误扣费风险                      |
| status                  | enum          | pending/processing/completed/abnormal |
| main_note               | text          | 总备注                                |
| created_by_user_id      | uuid          | 创建人                                |
| completed_by_user_id    | uuid          | 完成人                                |
| created_at              | timestamptz   | 创建时间                              |
| updated_at              | timestamptz   | 更新时间                              |
| completed_at            | timestamptz   | 完成时间                              |

约束和索引：

- unique(apple_account_id, plan_date)
- index(plan_date)
- index(status)
- index(has_wrong_charge_risk)

### 3.15 apple_account_action_plan_items

计划明细每次重新生成会先删除旧明细再按当前开通记录重建，主计划 ID 保持稳定。

| 字段                   | 类型          | 说明                                   |
| ---------------------- | ------------- | -------------------------------------- |
| id                     | uuid          | 主键                                   |
| plan_id                | uuid          | 操作计划                               |
| activation_id          | uuid          | 开通记录                               |
| customer_id            | uuid          | 客户                                   |
| service_id             | uuid          | 业务                                   |
| current_plan           | varchar       | 当前套餐                               |
| target_plan            | varchar       | 目标套餐                               |
| expire_time            | timestamptz   | 到期时间                               |
| customer_decision      | enum          | unconfirmed/renew/no_renew/change_plan |
| action_type            | enum          | renew/cancel/change_plan/wait_customer |
| expected_charge_amount | decimal(18,4) | 预计扣费                               |
| cancel_deadline        | timestamptz   | 最晚取消                               |
| task_id                | uuid          | 关联任务                               |
| status                 | enum          | pending/completed/abnormal             |
| note                   | text          | 备注                                   |
| created_at             | timestamptz   | 创建时间                               |
| updated_at             | timestamptz   | 更新时间                               |

索引：

- index(plan_id)
- index(activation_id)
- index(customer_id)
- index(service_id)
- index(task_id)
- index(action_type)
- index(status)

误扣费风险规则：

- 客户确认不续费，且 `auto_renew_status != disabled`。
- 客户未确认，`auto_renew_status = enabled`，且距离到期小于等于 1 天。

### 3.16 automation_tasks

| 字段                     | 类型        | 说明                                                                                                                 |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| id                       | uuid        | 主键                                                                                                                 |
| task_type                | varchar     | check_status/check_balance/topup/cancel_subscription/change_phone/change_security/check_renewal/official_price_check |
| apple_account_id         | uuid        | Apple ID，可为空。官方价格巡检这类系统级任务不绑定账号                                                               |
| customer_id              | uuid        | 客户                                                                                                                 |
| service_id               | uuid        | 业务                                                                                                                 |
| activation_id            | uuid        | 开通记录                                                                                                             |
| priority                 | varchar     | 优先级                                                                                                               |
| status                   | varchar     | pending/queued/running/waiting_manual_verify/success/failed/skipped/cancelled/need_review                            |
| input_payload_encrypted  | text        | 输入参数加密                                                                                                         |
| result_payload           | jsonb       | 结果                                                                                                                 |
| screenshot_attachment_id | uuid        | 截图                                                                                                                 |
| error_code               | varchar     | 错误码                                                                                                               |
| error_message            | text        | 错误说明                                                                                                             |
| created_by               | uuid        | 创建人                                                                                                               |
| started_at               | timestamptz | 开始                                                                                                                 |
| finished_at              | timestamptz | 结束                                                                                                                 |
| retry_count              | int         | 重试次数                                                                                                             |
| manual_required          | boolean     | 是否需要人工                                                                                                         |
| queue_job_id             | varchar     | 队列任务号                                                                                                           |
| created_at               | timestamptz | 创建时间                                                                                                             |
| updated_at               | timestamptz | 更新时间                                                                                                             |

### 3.17 automation_task_logs

| 字段                     | 类型        | 说明                       |
| ------------------------ | ----------- | -------------------------- |
| id                       | uuid        | 主键                       |
| task_id                  | uuid        | 自动化任务                 |
| level                    | varchar     | info/warning/error/success |
| message                  | text        | 日志内容                   |
| payload                  | jsonb       | 日志上下文，不记录敏感明文 |
| screenshot_attachment_id | uuid        | 截图或凭证附件             |
| created_at               | timestamptz | 创建时间                   |

索引：

- index(task_id)
- index(level)
- index(created_at)

### 3.18 apple_official_price_sources

| 字段                 | 类型        | 说明                         |
| -------------------- | ----------- | ---------------------------- |
| id                   | uuid        | 主键                         |
| name                 | varchar     | 官方价格来源名称             |
| provider             | varchar     | chatgpt/gemini/claude/custom |
| price_source_type    | varchar     | official_web                 |
| region               | varchar     | 地区，例如 US                |
| currency             | varchar     | 币种，例如 USD               |
| source_url           | text        | 官方价格页面或接口地址       |
| collect_method       | varchar     | manual/webpage/api           |
| check_interval_hours | int         | 检查间隔小时数               |
| status               | varchar     | enabled/disabled             |
| last_checked_at      | timestamptz | 最近检查时间                 |
| remark               | text        | 备注                         |
| created_at           | timestamptz | 创建时间                     |
| updated_at           | timestamptz | 更新时间                     |
| deleted_at           | timestamptz | 软删除时间                   |

### 3.19 apple_official_price_snapshots

| 字段                | 类型          | 说明                          |
| ------------------- | ------------- | ----------------------------- |
| id                  | uuid          | 主键                          |
| source_id           | uuid          | 官方价格来源                  |
| apple_service_id    | uuid          | 匹配到的 Apple ID 业务        |
| provider            | varchar       | chatgpt/gemini/claude/custom  |
| plan_code           | varchar       | 官方套餐编码，可为空          |
| service_name        | varchar       | 官方套餐名称                  |
| category            | varchar       | 分类                          |
| region              | varchar       | 地区                          |
| currency            | varchar       | 币种                          |
| official_price      | decimal(18,4) | 官网公开价格                  |
| apple_balance_price | decimal(18,4) | 按当前规则预估的 Apple 余额价 |
| period_type         | varchar       | month/day/manual              |
| period_value        | int           | 周期值                        |
| raw_payload         | jsonb         | 原始采集内容                  |
| collected_at        | timestamptz   | 采集时间                      |

### 3.20 apple_price_change_reviews

| 字段                | 类型        | 说明                                                                |
| ------------------- | ----------- | ------------------------------------------------------------------- |
| id                  | uuid        | 主键                                                                |
| source_id           | uuid        | 官方价格来源                                                        |
| snapshot_id         | uuid        | 采集快照                                                            |
| apple_service_id    | uuid        | 匹配到的 Apple ID 业务                                              |
| change_type         | varchar     | price_changed/new_plan/removed_plan/period_changed/currency_changed |
| old_value           | jsonb       | 系统当前值                                                          |
| new_value           | jsonb       | 官方最新值                                                          |
| status              | varchar     | pending/approved/ignored                                            |
| reviewed_by_user_id | uuid        | 处理人                                                              |
| reviewed_at         | timestamptz | 处理时间                                                            |
| remark              | text        | 处理备注                                                            |
| created_at          | timestamptz | 创建时间                                                            |
| updated_at          | timestamptz | 更新时间                                                            |

## 4. 兑换码业务表

### 4.1 code_services

| 字段                  | 类型          | 说明                    |
| --------------------- | ------------- | ----------------------- |
| id                    | uuid          | 主键                    |
| name                  | varchar       | 业务名称                |
| face_value            | decimal(18,4) | 面值                    |
| default_price         | decimal(18,2) | 默认售价                |
| default_cost          | decimal(18,2) | 默认成本                |
| delivery_mode         | varchar       | auto/semi_auto/manual   |
| exact_face_value_only | boolean       | 是否精确面值            |
| allow_combination     | boolean       | 是否允许组合            |
| status                | varchar       | enabled/paused/disabled |
| remark                | text          | 备注                    |
| created_at            | timestamptz   | 创建时间                |
| updated_at            | timestamptz   | 更新时间                |

### 4.2 code_platform_mappings

| 字段                 | 类型          | 说明       |
| -------------------- | ------------- | ---------- |
| id                   | uuid          | 主键       |
| platform_id          | uuid          | 平台       |
| shop_id              | varchar       | 店铺/账号  |
| platform_item_id     | varchar       | 商品 ID    |
| platform_sku_id      | varchar       | SKU ID     |
| sku_keyword          | varchar       | SKU 关键词 |
| service_id           | uuid          | 兑换码业务 |
| face_value           | decimal(18,4) | 面值       |
| quantity             | int           | 发几个码   |
| delivery_template_id | uuid          | 模板       |
| enabled              | boolean       | 启用       |
| created_at           | timestamptz   | 创建时间   |
| updated_at           | timestamptz   | 更新时间   |

索引：

- index(platform_item_id)
- index(platform_sku_id)

### 4.3 redeem_code_batches

| 字段          | 类型          | 说明     |
| ------------- | ------------- | -------- |
| id            | uuid          | 主键     |
| batch_no      | varchar       | 批次号   |
| face_value    | decimal(18,4) | 面值     |
| total_count   | int           | 总数     |
| success_count | int           | 成功     |
| failed_count  | int           | 失败     |
| default_cost  | decimal(18,2) | 默认成本 |
| remark        | text          | 备注     |
| imported_by   | uuid          | 导入人   |
| created_at    | timestamptz   | 导入时间 |

### 4.4 redeem_codes

| 字段                  | 类型          | 说明                                                                        |
| --------------------- | ------------- | --------------------------------------------------------------------------- |
| id                    | uuid          | 主键                                                                        |
| code_encrypted        | text          | 完整码加密                                                                  |
| code_hash             | varchar       | 哈希，唯一                                                                  |
| code_tail             | varchar       | 后 4 位                                                                     |
| face_value            | decimal(18,4) | 面值                                                                        |
| cost                  | decimal(18,2) | 成本                                                                        |
| batch_id              | uuid          | 批次                                                                        |
| status                | varchar       | unsold/locked/delivered/delivery_failed/after_sale/reissued/voided/refunded |
| locked_order_id       | uuid          | 锁定订单                                                                    |
| delivered_order_id    | uuid          | 发货订单                                                                    |
| delivered_platform_id | uuid          | 平台                                                                        |
| delivered_at          | timestamptz   | 发货时间                                                                    |
| expire_at             | timestamptz   | 过期时间，可空                                                              |
| remark                | text          | 备注                                                                        |
| created_at            | timestamptz   | 创建时间                                                                    |
| updated_at            | timestamptz   | 更新时间                                                                    |

约束：

- unique(code_hash)

索引：

- index(face_value, status)
- index(batch_id)
- index(delivered_order_id)

### 4.5 code_platform_orders

| 字段              | 类型          | 说明                            |
| ----------------- | ------------- | ------------------------------- |
| id                | uuid          | 主键                            |
| platform_id       | uuid          | 平台                            |
| external_order_no | varchar       | 平台订单号                      |
| buyer_id          | varchar       | 买家 ID/脱敏 ID                 |
| buyer_name_masked | varchar       | 买家脱敏                        |
| item_id           | varchar       | 商品 ID                         |
| sku_id            | varchar       | SKU ID                          |
| item_title        | varchar       | 商品标题                        |
| sku_name          | varchar       | SKU 名称                        |
| service_id        | uuid          | 匹配业务                        |
| face_value        | decimal(18,4) | 识别面值                        |
| quantity          | int           | 数量                            |
| paid_amount       | decimal(18,2) | 实付金额                        |
| platform_fee      | decimal(18,2) | 平台手续费                      |
| cost_amount       | decimal(18,2) | 成本                            |
| profit_amount     | decimal(18,2) | 利润                            |
| order_status      | varchar       | 平台订单状态                    |
| delivery_status   | varchar       | pending/delivered/failed/manual |
| refund_status     | varchar       | none/refunding/refunded         |
| paid_at           | timestamptz   | 支付时间                        |
| delivered_at      | timestamptz   | 发货时间                        |
| created_at        | timestamptz   | 创建时间                        |
| updated_at        | timestamptz   | 更新时间                        |

约束：

- unique(platform_id, external_order_no)

### 4.6 code_delivery_logs

| 字段                      | 类型          | 说明                                   |
| ------------------------- | ------------- | -------------------------------------- |
| id                        | uuid          | 主键                                   |
| order_id                  | uuid          | 订单                                   |
| platform_id               | uuid          | 平台                                   |
| external_order_no         | varchar       | 平台订单号                             |
| code_id                   | uuid          | 兑换码                                 |
| face_value                | decimal(18,4) | 面值                                   |
| delivery_method           | varchar       | eticket/dummy_send/message_card/manual |
| delivery_content_snapshot | text          | 发货内容快照                           |
| delivery_status           | varchar       | success/failed/pending                 |
| error_message             | text          | 失败原因                               |
| cost                      | decimal(18,2) | 成本                                   |
| paid_amount               | decimal(18,2) | 售价                                   |
| profit                    | decimal(18,2) | 利润                                   |
| created_at                | timestamptz   | 发货时间                               |

### 4.7 code_after_sales

| 字段             | 类型        | 说明                       |
| ---------------- | ----------- | -------------------------- |
| id               | uuid        | 主键                       |
| order_id         | uuid        | 订单                       |
| original_code_id | uuid        | 原码                       |
| new_code_id      | uuid        | 补发码                     |
| reason           | text        | 原因                       |
| status           | varchar     | pending/completed/rejected |
| handled_by       | uuid        | 处理人                     |
| created_at       | timestamptz | 创建时间                   |
| completed_at     | timestamptz | 完成时间                   |

### 4.8 code_refund_records

| 字段               | 类型          | 说明                        |
| ------------------ | ------------- | --------------------------- |
| id                 | uuid          | 主键                        |
| order_id           | uuid          | 订单                        |
| platform_id        | uuid          | 平台                        |
| external_refund_no | varchar       | 平台退款号                  |
| refund_amount      | decimal(18,2) | 退款金额                    |
| status             | varchar       | refunding/refunded/rejected |
| reason             | text          | 原因                        |
| created_at         | timestamptz   | 创建时间                    |
| updated_at         | timestamptz   | 更新时间                    |

## 5. 重要唯一约束

### Apple ID

- apple_accounts.account_hash 唯一
- apple_balance_summary: apple_account_id + currency 唯一
- Apple ID 锁定判断由业务逻辑处理：
  - 规则1：apple_account_id + service_id + active 时间区间不允许重叠
  - 规则2：apple_account_id + active 时间区间不允许与任何未到期业务重叠

### 兑换码

- redeem_codes.code_hash 唯一
- code_platform_orders: platform_id + external_order_no 唯一
- 一个 redeem_code 只能 delivered_order_id 一次
- 已发货订单不能再次发货，除非走售后补发表

## 6. 枚举建议

### AppleAccountStatus

- normal
- need_verify
- locked
- password_error
- risk
- unknown

### AppleServiceLockRule

- by_service
- global

### AppleBalancePriceRuleType

- inherit：继承全局 Apple 余额价规则
- percent：官网价乘以倍数，例如 1.25
- fixed_add：官网价固定加价，例如 +2
- manual：手动填写 Apple 余额消耗金额

### RenewalTaskStatus

- pending
- processing
- waiting_customer
- waiting_payment
- waiting_auto_renewal
- waiting_manual_verify
- completed
- cancelled
- failed
- abnormal
- postponed

### RedeemCodeStatus

- unsold
- locked
- delivered
- delivery_failed
- after_sale
- reissued
- voided
- refunded

### DeliveryStatus

- pending
- delivered
- failed
- manual

## 7. Apple ID 充值礼品卡代码字段补充

`apple_balance_topups` 需要补充以下字段，用于记录 Apple ID 充值时使用的礼品卡代码或充值代码。

| 字段                     | 类型    | 说明                         |
| ------------------------ | ------- | ---------------------------- |
| gift_card_code_encrypted | text    | 礼品卡代码完整内容，加密保存 |
| gift_card_code_hash      | varchar | 礼品卡代码 hash，用于防重复  |
| gift_card_code_tail      | varchar | 礼品卡代码后 4 位，用于展示  |

约束和索引建议：

- `gift_card_code_hash` 建议唯一索引，但允许为空。
- 录入充值时，如果填写礼品卡代码，必须先计算 hash 并检查重复。
- 完整礼品卡代码不得明文存储。
- 完整礼品卡代码不得写入普通应用日志。
- 该字段只属于 Apple ID 充值记录，不属于 `redeem_codes` 兑换码库存。

## 8. 通知中心表

### 8.1 notification_channels

| 字段       | 类型        | 说明                        |
| ---------- | ----------- | --------------------------- |
| id         | uuid        | 主键                        |
| name       | varchar     | 渠道名称                    |
| code       | varchar     | telegram/system             |
| type       | varchar     | telegram/in_app             |
| enabled    | boolean     | 是否启用                    |
| level      | varchar     | info/warning/error/critical |
| config     | jsonb       | 非敏感配置                  |
| created_at | timestamptz | 创建时间                    |
| updated_at | timestamptz | 更新时间                    |
| deleted_at | timestamptz | 软删除                      |

索引建议：

- unique(code)
- index(type, enabled)

### 8.2 telegram_configs

| 字段                | 类型        | 说明                      |
| ------------------- | ----------- | ------------------------- |
| id                  | uuid        | 主键                      |
| notification_name   | varchar     | 通知名称                  |
| enabled             | boolean     | 是否启用                  |
| bot_token_encrypted | text        | Bot Token，加密保存       |
| bot_token_tail      | varchar     | Token 尾号或后 4 位       |
| chat_id             | varchar     | Chat ID / 群组 ID         |
| notification_level  | varchar     | 通知级别                  |
| silent_start_time   | varchar     | 静默开始时间，如 HH:mm    |
| silent_end_time     | varchar     | 静默结束时间，如 HH:mm    |
| retry_count         | int         | 失败重试次数              |
| last_test_status    | varchar     | success/failed/not_tested |
| last_test_error     | text        | 最近测试失败原因          |
| last_test_at        | timestamptz | 最近测试时间              |
| created_at          | timestamptz | 创建时间                  |
| updated_at          | timestamptz | 更新时间                  |
| deleted_at          | timestamptz | 软删除                    |

索引建议：

- index(enabled)
- index(notification_level)

### 8.3 notification_rules

| 字段              | 类型        | 说明                        |
| ----------------- | ----------- | --------------------------- |
| id                | uuid        | 主键                        |
| name              | varchar     | 规则名称                    |
| event_code        | varchar     | 通知事件编码                |
| module            | varchar     | 所属模块                    |
| level             | varchar     | info/warning/error/critical |
| enabled           | boolean     | 是否启用                    |
| channels          | text[]      | telegram/system             |
| recipients        | jsonb       | 通知对象配置                |
| trigger_condition | jsonb       | 触发条件                    |
| rate_limit        | jsonb       | 频率限制                    |
| last_triggered_at | timestamptz | 最后触发时间                |
| created_at        | timestamptz | 创建时间                    |
| updated_at        | timestamptz | 更新时间                    |
| deleted_at        | timestamptz | 软删除                      |

索引建议：

- unique(event_code)
- index(module, enabled)
- index(level)

### 8.4 notification_templates

| 字段       | 类型        | 说明            |
| ---------- | ----------- | --------------- |
| id         | uuid        | 主键            |
| name       | varchar     | 模板名称        |
| event_code | varchar     | 关联事件编码    |
| channel    | varchar     | telegram/system |
| title      | varchar     | 标题            |
| content    | text        | 模板内容        |
| variables  | jsonb       | 变量说明        |
| enabled    | boolean     | 是否启用        |
| created_at | timestamptz | 创建时间        |
| updated_at | timestamptz | 更新时间        |

索引建议：

- unique(event_code, channel)
- index(enabled)

### 8.5 notification_logs

| 字段              | 类型        | 说明                         |
| ----------------- | ----------- | ---------------------------- |
| id                | uuid        | 主键                         |
| rule_id           | uuid        | 通知规则                     |
| event_code        | varchar     | 通知事件                     |
| module            | varchar     | 所属模块                     |
| channel           | varchar     | telegram/system              |
| recipient         | varchar     | 接收对象                     |
| recipient_user_id | uuid        | 站内通知接收用户             |
| title             | varchar     | 标题                         |
| content_digest    | text        | 内容摘要，不保存敏感完整内容 |
| payload           | jsonb       | 通知上下文，不保存敏感明文   |
| status            | varchar     | pending/sent/failed/skipped  |
| error_message     | text        | 失败原因                     |
| retry_count       | int         | 重试次数                     |
| triggered_at      | timestamptz | 触发时间                     |
| sent_at           | timestamptz | 发送时间                     |
| read_at           | timestamptz | 站内通知读取时间             |
| read_by_user_id   | uuid        | 标记已读用户                 |
| created_at        | timestamptz | 创建时间                     |

索引建议：

- index(event_code)
- index(module, status)
- index(channel, status)
- index(created_at)

## 9. 安全中心表

### 9.1 login_logs

| 字段           | 类型        | 说明                   |
| -------------- | ----------- | ---------------------- |
| id             | uuid        | 主键                   |
| user_id        | uuid        | 用户                   |
| username       | varchar     | 登录名快照             |
| status         | varchar     | success/failed/blocked |
| failure_reason | text        | 失败原因               |
| ip             | varchar     | IP                     |
| user_agent     | text        | User-Agent             |
| location       | varchar     | 地理位置               |
| abnormal       | boolean     | 是否异常登录           |
| created_at     | timestamptz | 创建时间               |

索引建议：index(user_id)、index(username)、index(ip)、index(created_at)、index(abnormal)

### 9.2 active_sessions

| 字段           | 类型        | 说明         |
| -------------- | ----------- | ------------ |
| id             | uuid        | 主键         |
| user_id        | uuid        | 用户         |
| token_hash     | varchar     | Token hash   |
| ip             | varchar     | IP           |
| user_agent     | text        | User-Agent   |
| last_active_at | timestamptz | 最近活跃时间 |
| expires_at     | timestamptz | 过期时间     |
| revoked_at     | timestamptz | 注销时间     |
| created_at     | timestamptz | 创建时间     |

索引建议：unique(token_hash)、index(user_id)、index(expires_at)、index(revoked_at)

### 9.3 security_settings

| 字段       | 类型        | 说明         |
| ---------- | ----------- | ------------ |
| id         | uuid        | 主键         |
| key        | varchar     | 设置键，唯一 |
| value      | jsonb       | 设置值       |
| remark     | text        | 说明         |
| updated_by | uuid        | 更新人       |
| created_at | timestamptz | 创建时间     |
| updated_at | timestamptz | 更新时间     |

### 9.4 ip_whitelists

| 字段       | 类型        | 说明                 |
| ---------- | ----------- | -------------------- |
| id         | uuid        | 主键                 |
| ip_or_cidr | varchar     | IP 或 CIDR           |
| scope      | varchar     | admin/api/automation |
| enabled    | boolean     | 是否启用             |
| remark     | text        | 备注                 |
| created_by | uuid        | 创建人               |
| created_at | timestamptz | 创建时间             |
| updated_at | timestamptz | 更新时间             |

### 9.5 sensitive_access_logs

| 字段          | 类型        | 说明       |
| ------------- | ----------- | ---------- |
| id            | uuid        | 主键       |
| user_id       | uuid        | 查看人     |
| module        | varchar     | 模块       |
| field_name    | varchar     | 字段       |
| object_type   | varchar     | 对象类型   |
| object_id     | uuid        | 对象 ID    |
| access_reason | text        | 查看原因   |
| approved      | boolean     | 是否已审批 |
| ip            | varchar     | IP         |
| user_agent    | text        | User-Agent |
| created_at    | timestamptz | 创建时间   |

### 9.6 sensitive_access_approvals

| 字段         | 类型        | 说明                              |
| ------------ | ----------- | --------------------------------- |
| id           | uuid        | 主键                              |
| requester_id | uuid        | 申请人                            |
| approver_id  | uuid        | 审批人                            |
| module       | varchar     | 模块                              |
| field_name   | varchar     | 字段                              |
| object_type  | varchar     | 对象类型                          |
| object_id    | uuid        | 对象 ID                           |
| reason       | text        | 申请原因                          |
| status       | varchar     | pending/approved/rejected/expired |
| approved_at  | timestamptz | 审批时间                          |
| expires_at   | timestamptz | 过期时间                          |
| created_at   | timestamptz | 创建时间                          |
| updated_at   | timestamptz | 更新时间                          |

## 10. 数据中心表

### 10.1 backup_jobs

| 字段          | 类型        | 说明                                     |
| ------------- | ----------- | ---------------------------------------- |
| id            | uuid        | 主键                                     |
| job_type      | varchar     | database/files/config                    |
| status        | varchar     | pending/running/success/failed/cancelled |
| storage_path  | varchar     | 备份路径                                 |
| file_size     | bigint      | 文件大小                                 |
| started_at    | timestamptz | 开始时间                                 |
| finished_at   | timestamptz | 结束时间                                 |
| error_message | text        | 失败原因                                 |
| remark        | text        | 备注                                     |
| created_by    | uuid        | 创建人                                   |
| created_at    | timestamptz | 创建时间                                 |

### 10.2 restore_jobs

| 字段          | 类型        | 说明                                     |
| ------------- | ----------- | ---------------------------------------- |
| id            | uuid        | 主键                                     |
| backup_job_id | uuid        | 备份任务                                 |
| status        | varchar     | pending/running/success/failed/cancelled |
| restore_scope | varchar     | 恢复范围                                 |
| approval_note | text        | 审批说明                                 |
| started_at    | timestamptz | 开始时间                                 |
| finished_at   | timestamptz | 结束时间                                 |
| error_message | text        | 失败原因                                 |
| created_by    | uuid        | 创建人                                   |
| created_at    | timestamptz | 创建时间                                 |

### 10.3 data_import_jobs

| 字段          | 类型        | 说明                                     |
| ------------- | ----------- | ---------------------------------------- |
| id            | uuid        | 主键                                     |
| module        | varchar     | 模块                                     |
| file_path     | varchar     | 文件路径                                 |
| status        | varchar     | pending/running/success/failed/cancelled |
| total_count   | int         | 总行数                                   |
| success_count | int         | 成功数                                   |
| failed_count  | int         | 失败数                                   |
| error_report  | varchar     | 错误报告路径                             |
| remark        | text        | 备注                                     |
| created_by    | uuid        | 创建人                                   |
| created_at    | timestamptz | 创建时间                                 |
| finished_at   | timestamptz | 完成时间                                 |

### 10.4 data_export_jobs

| 字段                | 类型        | 说明                                     |
| ------------------- | ----------- | ---------------------------------------- |
| id                  | uuid        | 主键                                     |
| module              | varchar     | 模块                                     |
| export_scope        | jsonb       | 导出范围                                 |
| fields              | text[]      | 导出字段                                 |
| contains_sensitive  | boolean     | 是否包含敏感字段                         |
| status              | varchar     | pending/running/success/failed/cancelled |
| file_path           | varchar     | 导出文件路径                             |
| download_expires_at | timestamptz | 下载过期时间                             |
| error_message       | text        | 失败原因                                 |
| created_by          | uuid        | 创建人                                   |
| created_at          | timestamptz | 创建时间                                 |
| finished_at         | timestamptz | 完成时间                                 |

### 10.5 recycle_bin_records

| 字段          | 类型        | 说明         |
| ------------- | ----------- | ------------ |
| id            | uuid        | 主键         |
| module        | varchar     | 模块         |
| object_type   | varchar     | 对象类型     |
| object_id     | uuid        | 对象 ID      |
| object_label  | varchar     | 对象显示名称 |
| snapshot_data | jsonb       | 删除前快照   |
| deleted_by    | uuid        | 删除人       |
| deleted_at    | timestamptz | 删除时间     |
| restored_by   | uuid        | 恢复人       |
| restored_at   | timestamptz | 恢复时间     |

### 10.6 system_parameters

| 字段       | 类型        | 说明         |
| ---------- | ----------- | ------------ |
| id         | uuid        | 主键         |
| key        | varchar     | 参数键，唯一 |
| value      | jsonb       | 参数值       |
| group      | varchar     | 分组         |
| remark     | text        | 说明         |
| updated_by | uuid        | 更新人       |
| created_at | timestamptz | 创建时间     |
| updated_at | timestamptz | 更新时间     |

平台授权配置第一版复用 `system_parameters`：

- `group = platform_auth`
- `key = platform_auth_<platform>`
- `value` 保存 `authMode`、`tokenExpiresAt`、`shopName`、`scopes`、`authorizationUrl`、`tokenUrl`、`redirectUri`、`clientIdParam` 和敏感字段密文
- `appKey`、`appSecret`、`accessToken`、`refreshToken` 必须加密保存
- 列表和状态页只显示 `has*` 与尾号字段，不返回明文或密文

OAuth state 第一版也复用 `system_parameters`，只作为短期授权流程状态，不作为正式业务表：

- `group = platform_oauth_state`
- `key = platform_oauth_state_{platform}_{stateHash前64位}`
- `value` 保存 `platform`、`stateHash`、`redirectUri`、`scopes`、`status`、`expiresAt`、`receivedAt`
- 回调收到的授权码必须加密保存为 `authorizationCodeEncrypted`，列表和接口不得返回明文
- state 默认 10 分钟过期；真实 token exchange 接入后应消费授权码并更新正式平台授权配置

### 10.7 data_dictionaries

| 字段               | 类型        | 说明            |
| ------------------ | ----------- | --------------- |
| id                 | uuid        | 主键            |
| group              | varchar     | 字典分组        |
| code               | varchar     | 字典编码        |
| label              | varchar     | 显示名称        |
| value              | varchar     | 字典值          |
| sort_order         | int         | 排序            |
| status             | varchar     | active/disabled |
| remark             | text        | 说明            |
| created_by_user_id | uuid        | 创建人          |
| updated_by_user_id | uuid        | 更新人          |
| created_at         | timestamptz | 创建时间        |
| updated_at         | timestamptz | 更新时间        |

索引建议：

- unique(group, code)
- index(group, status)

### 10.8 data_cleanup_jobs

| 字段           | 类型        | 说明                                     |
| -------------- | ----------- | ---------------------------------------- |
| id             | uuid        | 主键                                     |
| module         | varchar     | 模块                                     |
| cleanup_scope  | jsonb       | 清理范围                                 |
| status         | varchar     | pending/running/success/failed/cancelled |
| affected_count | int         | 影响数量                                 |
| approval_note  | text        | 审批说明                                 |
| error_message  | text        | 失败原因                                 |
| created_by     | uuid        | 创建人                                   |
| created_at     | timestamptz | 创建时间                                 |
| finished_at    | timestamptz | 完成时间                                 |

索引建议：

- index(module)
- index(status)
- index(created_by)
- index(created_at)

### 10.9 duplicate_merge_jobs

| 字段                 | 类型        | 说明                                     |
| -------------------- | ----------- | ---------------------------------------- |
| id                   | uuid        | 主键                                     |
| module               | varchar     | 模块                                     |
| match_rule           | jsonb       | 匹配规则                                 |
| primary_object_id    | uuid        | 主对象 ID                                |
| duplicate_object_ids | text[]      | 重复对象 ID 列表                         |
| status               | varchar     | pending/running/success/failed/cancelled |
| affected_count       | int         | 影响数量                                 |
| approval_note        | text        | 审批说明                                 |
| error_message        | text        | 失败原因                                 |
| created_by           | uuid        | 创建人                                   |
| created_at           | timestamptz | 创建时间                                 |
| finished_at          | timestamptz | 完成时间                                 |

索引建议：

- index(module)
- index(status)
- index(created_by)
- index(created_at)

## 11. 运维监控表

### 11.1 system_health_snapshots

| 字段           | 类型          | 说明         |
| -------------- | ------------- | ------------ |
| id             | uuid          | 主键         |
| api_status     | varchar       | API 状态     |
| db_status      | varchar       | 数据库状态   |
| redis_status   | varchar       | Redis 状态   |
| storage_status | varchar       | 文件存储状态 |
| queue_status   | varchar       | 队列状态     |
| worker_status  | varchar       | Worker 状态  |
| disk_usage     | decimal(18,4) | 磁盘使用率   |
| metrics        | jsonb         | 其他指标     |
| checked_at     | timestamptz   | 检测时间     |

状态枚举：normal/warning/error/critical/unknown。

### 11.2 queue_status_logs

| 字段          | 类型        | 说明                                  |
| ------------- | ----------- | ------------------------------------- |
| id            | uuid        | 主键                                  |
| queue_name    | varchar     | 队列名称                              |
| waiting_count | int         | 等待数                                |
| active_count  | int         | 执行中数量                            |
| failed_count  | int         | 失败数量                              |
| delayed_count | int         | 延迟数量                              |
| status        | varchar     | normal/warning/error/critical/unknown |
| checked_at    | timestamptz | 检测时间                              |

### 11.3 cron_job_logs

| 字段          | 类型        | 说明                           |
| ------------- | ----------- | ------------------------------ |
| id            | uuid        | 主键                           |
| job_name      | varchar     | 定时任务名称                   |
| status        | varchar     | running/success/failed/skipped |
| started_at    | timestamptz | 开始时间                       |
| finished_at   | timestamptz | 结束时间                       |
| error_message | text        | 失败原因                       |
| metadata      | jsonb       | 任务元数据                     |
| created_at    | timestamptz | 创建时间                       |

### 11.4 platform_sync_logs

| 字段          | 类型          | 说明                              |
| ------------- | ------------- | --------------------------------- |
| id            | uuid          | 主键                              |
| platform      | varchar       | telegram/storage/automation/other |
| sync_type     | varchar       | orders/refunds/auth/test          |
| status        | varchar       | success/failed                    |
| request_count | int           | 请求次数                          |
| error_rate    | decimal(18,4) | 错误率                            |
| error_message | text          | 最近失败原因                      |
| started_at    | timestamptz   | 开始时间                          |
| finished_at   | timestamptz   | 结束时间                          |
| metadata      | jsonb         | 接口元数据                        |
| created_at    | timestamptz   | 创建时间                          |

### 11.5 error_logs

| 字段        | 类型        | 说明                  |
| ----------- | ----------- | --------------------- |
| id          | uuid        | 主键                  |
| level       | varchar     | info/warn/error/fatal |
| module      | varchar     | 模块                  |
| message     | text        | 错误信息              |
| stack       | text        | 堆栈                  |
| context     | jsonb       | 上下文                |
| occurred_at | timestamptz | 发生时间              |

## 12. 网站维护表

### 12.1 app_announcements

| 字段       | 类型        | 说明               |
| ---------- | ----------- | ------------------ |
| id         | uuid        | 主键               |
| title      | varchar     | 标题               |
| content    | text        | 内容               |
| level      | varchar     | info/warning/error |
| enabled    | boolean     | 是否启用           |
| start_at   | timestamptz | 开始时间           |
| end_at     | timestamptz | 结束时间           |
| created_by | uuid        | 创建人             |
| updated_by | uuid        | 更新人             |
| created_at | timestamptz | 创建时间           |
| updated_at | timestamptz | 更新时间           |
| deleted_at | timestamptz | 软删除时间         |

索引建议：`level`、`enabled`、`start_at`、`end_at`、`created_by`、`deleted_at`。

### 12.2 maintenance_windows

| 字段          | 类型        | 说明         |
| ------------- | ----------- | ------------ |
| id            | uuid        | 主键         |
| enabled       | boolean     | 是否启用     |
| reason        | text        | 维护原因     |
| allowed_roles | text[]      | 允许访问角色 |
| allowed_ips   | text[]      | 允许访问 IP  |
| start_at      | timestamptz | 开始时间     |
| end_at        | timestamptz | 结束时间     |
| created_by    | uuid        | 创建人       |
| updated_by    | uuid        | 更新人       |
| created_at    | timestamptz | 创建时间     |
| updated_at    | timestamptz | 更新时间     |
| deleted_at    | timestamptz | 软删除时间   |

索引建议：`enabled`、`start_at`、`end_at`、`created_by`、`deleted_at`。

### 12.3 feature_flags

| 字段       | 类型        | 说明         |
| ---------- | ----------- | ------------ |
| id         | uuid        | 主键         |
| key        | varchar     | 功能键，唯一 |
| name       | varchar     | 功能名称     |
| enabled    | boolean     | 是否启用     |
| config     | jsonb       | 配置         |
| remark     | text        | 备注         |
| updated_by | uuid        | 更新人       |
| created_at | timestamptz | 创建时间     |
| updated_at | timestamptz | 更新时间     |
| deleted_at | timestamptz | 软删除时间   |

约束：`key` 唯一。

索引建议：`enabled`、`updated_by`、`deleted_at`。

### 12.4 app_versions

| 字段           | 类型        | 说明                      |
| -------------- | ----------- | ------------------------- |
| id             | uuid        | 主键                      |
| version        | varchar     | 版本号                    |
| title          | varchar     | 版本标题                  |
| status         | varchar     | draft/released/deprecated |
| release_notes  | text        | 更新日志                  |
| impact_modules | text[]      | 影响模块                  |
| released_at    | timestamptz | 发布时间                  |
| created_by     | uuid        | 创建人                    |
| created_at     | timestamptz | 创建时间                  |

约束：`version` 唯一。

索引建议：`status`、`released_at`、`created_by`。

## 13. 用户表格视图表

### 13.1 user_table_views

| 字段        | 类型        | 说明                  |
| ----------- | ----------- | --------------------- |
| id          | uuid        | 主键                  |
| user_id     | uuid        | 用户                  |
| table_key   | varchar     | 表格唯一标识          |
| view_name   | varchar     | 视图名称              |
| filters     | jsonb       | 筛选条件              |
| sort_config | jsonb       | 排序配置              |
| columns     | jsonb       | 列显示配置            |
| density     | varchar     | compact/default/loose |
| page_size   | int         | 每页条数              |
| is_default  | boolean     | 是否默认              |
| created_at  | timestamptz | 创建时间              |
| updated_at  | timestamptz | 更新时间              |

索引建议：

- unique(user_id, table_key, view_name)
- partial unique(user_id, table_key) where is_default = true
- index(user_id, table_key)

## 14. 当前已实现公共模块表

### 14.1 customers

| 字段               | 类型        | 说明                 |
| ------------------ | ----------- | -------------------- |
| id                 | uuid        | 主键                 |
| name               | varchar     | 客户名称             |
| phone              | varchar     | 手机号，列表默认脱敏 |
| phone_tail         | varchar     | 手机号后 4 位        |
| wechat             | varchar     | 微信                 |
| source_platform_id | uuid        | 来源平台             |
| tags               | text[]      | 客户标签             |
| remark             | text        | 备注                 |
| status             | enum        | active/disabled      |
| created_by_user_id | uuid        | 创建人               |
| updated_by_user_id | uuid        | 更新人               |
| created_at         | timestamptz | 创建时间             |
| updated_at         | timestamptz | 更新时间             |
| deleted_at         | timestamptz | 软删除时间           |

索引：

- index(name)
- index(phone_tail)
- index(source_platform_id)
- index(status)
- index(deleted_at)

### 14.2 source_platforms

| 字段               | 类型          | 说明            |
| ------------------ | ------------- | --------------- |
| id                 | uuid          | 主键            |
| name               | varchar       | 平台名称        |
| fee_rate           | Decimal(8,4)  | 平台费率        |
| fee_fixed          | Decimal(12,2) | 固定费用        |
| status             | enum          | active/disabled |
| remark             | text          | 备注            |
| created_by_user_id | uuid          | 创建人          |
| updated_by_user_id | uuid          | 更新人          |
| created_at         | timestamptz   | 创建时间        |
| updated_at         | timestamptz   | 更新时间        |
| deleted_at         | timestamptz   | 软删除时间      |

约束和索引：

- index(status)
- index(deleted_at)

### 14.3 message_templates

说明：当前表名沿用 `message_templates`，业务含义已经收敛为兑换码发货模板；系统通知模板走通知设置相关表，不和兑换码发货模板混用。

| 字段               | 类型        | 说明                                            |
| ------------------ | ----------- | ----------------------------------------------- |
| id                 | uuid        | 主键                                            |
| name               | varchar     | 模板名称                                        |
| type               | enum        | renewal/delivery/after_sale/notification/custom |
| channel            | enum        | internal/telegram/customer_service              |
| content            | text        | 模板内容，支持 `{{ variable }}`                 |
| variables          | text[]      | 变量列表                                        |
| status             | enum        | active/disabled                                 |
| remark             | text        | 备注                                            |
| created_by_user_id | uuid        | 创建人                                          |
| updated_by_user_id | uuid        | 更新人                                          |
| created_at         | timestamptz | 创建时间                                        |
| updated_at         | timestamptz | 更新时间                                        |
| deleted_at         | timestamptz | 软删除时间                                      |

索引：

- index(type)
- index(channel)
- index(status)
- index(deleted_at)

## 15. 当前已实现 Apple ID 核心表

### 15.1 apple_accounts

| 字段                     | 类型          | 说明                                                  |
| ------------------------ | ------------- | ----------------------------------------------------- |
| id                       | uuid          | 主键                                                  |
| apple_id                 | varchar       | Apple ID 邮箱，接口默认脱敏返回                       |
| apple_id_normalized      | varchar       | 规范化 Apple ID，唯一，用于去重和搜索                 |
| region                   | varchar       | 地区，例如 US                                         |
| currency                 | varchar       | 币种，例如 USD                                        |
| current_balance          | Decimal(18,4) | 当前余额                                              |
| balance_cost_amount      | Decimal(18,4) | 当前余额对应人民币成本                                |
| average_cost             | Decimal(18,8) | 移动加权平均成本                                      |
| status                   | enum          | normal/need_verify/locked/password_error/risk/unknown |
| is_manually_locked       | boolean       | 是否手动锁定                                          |
| manual_lock_reason       | text          | 手动锁定原因                                          |
| locked_at                | timestamptz   | 锁定时间                                              |
| locked_by_user_id        | uuid          | 锁定人                                                |
| password_encrypted       | text          | Apple ID 密码，加密保存                               |
| security_info_encrypted  | text          | 密保信息，加密保存                                    |
| phone_encrypted          | text          | 绑定手机号，加密保存                                  |
| recovery_email_encrypted | text          | 备用邮箱，加密保存                                    |
| remark                   | text          | 备注                                                  |
| created_by_user_id       | uuid          | 创建人                                                |
| updated_by_user_id       | uuid          | 更新人                                                |
| created_at               | timestamptz   | 创建时间                                              |
| updated_at               | timestamptz   | 更新时间                                              |
| deleted_at               | timestamptz   | 软删除时间                                            |

约束和索引：

- unique(apple_id_normalized)
- index(status)
- index(currency)
- index(is_manually_locked)
- index(deleted_at)

成本规则：

- 创建或修改 `current_balance`、`balance_cost_amount` 时，服务端自动计算 `average_cost`。
- 当 `current_balance = 0` 时，`balance_cost_amount` 必须为 0。
- Apple ID 充值记录和消费记录已在独立流水表中实现，不直接混入本表。

### 15.2 apple_balance_topups

| 字段                     | 类型          | 说明                              |
| ------------------------ | ------------- | --------------------------------- |
| id                       | uuid          | 主键                              |
| apple_account_id         | uuid          | Apple ID                          |
| face_value               | Decimal(18,4) | 充值面值                          |
| cost_amount              | Decimal(18,4) | 本次人民币成本                    |
| balance_before           | Decimal(18,4) | 充值前余额                        |
| balance_after            | Decimal(18,4) | 充值后余额                        |
| cost_before              | Decimal(18,4) | 充值前余额成本                    |
| cost_after               | Decimal(18,4) | 充值后余额成本                    |
| avg_cost_before          | Decimal(18,8) | 充值前平均成本                    |
| avg_cost_after           | Decimal(18,8) | 充值后平均成本                    |
| gift_card_code_encrypted | text          | 礼品卡代码/充值代码完整内容，加密 |
| gift_card_code_hash      | varchar       | 礼品卡代码 hash，唯一，防重复     |
| gift_card_code_tail      | varchar       | 礼品卡代码后 4 位                 |
| remark                   | text          | 备注                              |
| created_by_user_id       | uuid          | 创建人                            |
| created_at               | timestamptz   | 创建时间                          |

约束和索引：

- unique(gift_card_code_hash)
- index(apple_account_id)
- index(created_at)

### 15.3 apple_balance_consumptions

| 字段                | 类型          | 说明                       |
| ------------------- | ------------- | -------------------------- |
| id                  | uuid          | 主键                       |
| apple_account_id    | uuid          | Apple ID                   |
| amount              | Decimal(18,4) | 消费金额                   |
| cost_amount         | Decimal(18,4) | 本次消费成本               |
| avg_unit_cost       | Decimal(18,8) | 消费时平均成本             |
| balance_before      | Decimal(18,4) | 消费前余额                 |
| balance_after       | Decimal(18,4) | 消费后余额                 |
| cost_before         | Decimal(18,4) | 消费前余额成本             |
| cost_after          | Decimal(18,4) | 消费后余额成本             |
| reason              | varchar       | 消费原因                   |
| related_object_type | varchar       | 关联对象类型，后续订单使用 |
| related_object_id   | uuid          | 关联对象 ID，后续订单使用  |
| remark              | text          | 备注                       |
| created_by_user_id  | uuid          | 创建人                     |
| created_at          | timestamptz   | 创建时间                   |

约束和索引：

- index(apple_account_id)
- index(created_at)

已实现规则：

- 充值和消费会在事务内同时写流水并更新 `apple_accounts` 的余额、余额成本和平均成本。
- 充值支持礼品卡代码加密保存、hash 去重和尾号展示。
- 消费成本按消费时平均成本计算。
