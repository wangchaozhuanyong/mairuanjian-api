# 权限设计

## 1. 角色

### 1.1 管理员 admin

拥有全部权限。

### 1.2 客服 customer_service

权限：

- 查看客户
- 新增客户
- 编辑客户基础资料
- 录入 Apple ID 订单
- 查看自己的任务
- 处理续费任务
- 复制发货模板内容
- 查看 Apple ID 脱敏信息
- 查看开通记录

禁止：

- 查看 Apple ID 密码
- 查看密保答案
- 查看完整兑换码
- 查看成本和利润
- 修改余额
- 修改权限

### 1.3 发货员 delivery_staff

权限：

- 查看兑换码订单
- 处理待发货订单
- 一键生成发货内容
- 处理发货失败
- 处理售后补发
- 查看兑换码脱敏信息

禁止：

- 批量导出完整兑换码
- 查看 Apple ID 密码
- 修改 Apple ID 余额
- 查看 Apple ID 成本和利润

### 1.4 财务 finance

权限：

- 查看成本
- 查看利润
- 查看 Apple ID 充值记录
- 查看 Apple ID 消费记录
- 查看兑换码成本
- 查看平台利润报表
- 录入或审核充值
- 导出财务报表

禁止：

- 查看 Apple ID 密码
- 查看密保答案
- 修改系统权限

### 1.5 运营 operation

权限：

- 维护业务设置
- 维护来源平台
- 维护发货模板
- 查看运营报表
- 查看库存统计

禁止：

- 查看完整敏感字段
- 修改财务成本
- 修改用户权限

### 1.6 技术 technician

权限：

- 查看系统日志
- 查看接口配置状态
- 管理平台接口配置
- 查看自动化任务日志

禁止：

- 查看客户完整手机号
- 查看 Apple ID 密码
- 查看完整兑换码
- 查看财务利润

### 1.7 审计 auditor

权限：

- 查看操作日志
- 查看敏感字段查看记录
- 查看导出记录
- 查看权限变更记录

禁止：

- 修改业务数据
- 修改权限
- 查看完整敏感内容，除非管理员授权

## 2. 字段级权限

### 2.1 Apple ID 字段

| 字段         | 默认显示    | 查看完整权限               |
| ------------ | ----------- | -------------------------- |
| Apple ID账号 | 脱敏        | apple.account.view_full    |
| 密码         | 隐藏        | apple.secret.view_password |
| 密保答案     | 隐藏        | apple.secret.view_security |
| 手机号       | 尾号        | apple.secret.view_phone    |
| 备用邮箱     | 脱敏        | apple.secret.view_email    |
| 当前余额     | 显示        | apple.balance.view         |
| 平均成本     | 财务/管理员 | apple.cost.view            |
| 利润         | 财务/管理员 | apple.profit.view          |

### 2.2 兑换码字段

| 字段   | 默认显示    | 查看完整权限             |
| ------ | ----------- | ------------------------ |
| 兑换码 | 只显示后4位 | code.inventory.view_full |
| 成本   | 财务/管理员 | code.cost.view           |
| 利润   | 财务/管理员 | code.profit.view         |

### 2.3 客户字段

| 字段   | 默认显示 | 查看完整权限              |
| ------ | -------- | ------------------------- |
| 微信号 | 显示     | customer.view             |
| 手机号 | 脱敏     | customer.view_phone       |
| 买家ID | 脱敏     | customer.view_platform_id |

规则：

- 客户列表和详情默认只返回 `maskedPhone` 和 `phoneTail`。
- 查看完整手机号必须填写原因。
- 查看完整手机号必须写入 `sensitive_access_logs` 和 `audit_logs`。
- 日志只记录手机号尾号，不记录完整手机号。

## 3. 敏感操作必须写日志

必须记录：

- 查看 Apple ID 密码
- 复制 Apple ID 密码
- 查看密保答案
- 查看完整兑换码
- 导出客户
- 导出 Apple ID
- 导出兑换码
- 修改余额
- 录入充值
- 余额修正
- 修改成本
- 删除账号
- 删除兑换码
- 修改权限
- 修改角色
- 自动发码
- 售后补发

## 4. 权限编码建议

### Apple ID

- apple.account.view
- apple.account.view_full
- apple.account.create
- apple.account.update
- apple.account.delete
- apple.account.import
- apple.secret.view_password
- apple.secret.view_security
- apple.secret.view_phone
- apple.secret.view_email
- apple.balance.view
- apple.balance.topup
- apple.balance.adjust
- apple.cost.view
- apple.order.create
- apple.order.update
- apple.activation.view
- apple.renewal_task.view
- apple.renewal_task.update
- apple.action_plan.view
- apple.action_plan.update
- apple.automation_task.manage
- apple.report.view

### 兑换码

- code.service.manage
- code.batch.import
- code.inventory.view
- code.inventory.view_full
- code.inventory.void
- code.order.view
- code.order.deliver
- code.delivery.view
- code.after_sale.manage
- code.cost.view
- code.profit.view
- code.report.view

### 公共

- customer.view
- customer.create
- customer.update
- customer.delete
- customer.view_phone
- source_platform.manage
- code.delivery_template.manage
- attachment.view
- attachment.upload
- attachment.download
- audit_log.view
- system.user_manage
- system.role_manage
- system.permission_manage

附件规则：

- `attachment.view` 只能查看附件元数据，包括文件名、类型、大小、业务归属和上传人。
- `attachment.upload` 允许上传附件并填写业务归属字段。
- `attachment.download` 才允许下载真实文件内容。
- 下载附件必须写入 `audit_logs`，日志记录附件元数据，不记录本地文件系统绝对路径。

发货模板权限规则：

- `code.delivery_template.manage` 用于新增、编辑、删除兑换码发货模板。
- 发货模板只服务淘宝/闲鱼自动发货和售后补发，不等于通知模板。
- 历史权限 `message_template.manage` 仅作为旧账号兼容，不再作为新权限名称分配。

## 5. 补充权限编码

### Apple ID 充值礼品卡代码

- apple.topup.gift_code.view_tail：查看礼品卡代码后 4 位
- apple.topup.gift_code.view_full：查看完整礼品卡代码
- apple.topup.gift_code.create：录入礼品卡代码
- apple.topup.gift_code.export：导出包含礼品卡代码的充值记录

规则：

- 客服默认不能查看完整礼品卡代码。
- 财务可查看礼品卡代码尾号和充值成本。
- 管理员可查看完整礼品卡代码。
- 查看完整礼品卡代码必须写审计日志。
- 完整礼品卡代码不得进入兑换码权限体系。

### 通知中心 notification.\*

- notification.view：查看通知总览
- notification.rule.view：查看通知规则
- notification.rule.manage：管理通知规则
- notification.template.view：查看通知模板
- notification.template.manage：管理通知模板
- notification.log.view：查看通知日志
- notification.telegram.view：查看 Telegram 配置
- notification.telegram.manage：管理 Telegram 配置
- notification.telegram.test：测试发送 Telegram 通知

### 安全中心 security.\*

- security.overview.view：查看安全总览
- security.login_log.view：查看登录日志
- security.session.view：查看在线会话
- security.session.revoke：强制下线会话
- security.mfa.manage：管理 MFA 设置
- security.ip_whitelist.manage：管理 IP 白名单
- security.password_policy.manage：管理密码策略
- security.sensitive_access_log.view：查看敏感字段访问日志
- security.sensitive_access_approval.manage：审批敏感字段访问
- security.abnormal_login.view：查看异常登录记录
- security.sensitive_operation.view：查看敏感操作记录

### 数据中心 data.\*

- data.overview.view：查看数据中心总览
- data.backup.view：查看备份任务
- data.backup.create：创建备份任务
- data.restore.view：查看恢复任务
- data.restore.create：创建恢复任务
- data.import.view：查看导入任务
- data.import.create：创建导入任务
- data.export.view：查看导出任务
- data.export.create：创建导出任务
- data.recycle_bin.view：查看回收站
- data.recycle_bin.restore：恢复回收站数据
- data.cleanup.manage：管理数据清理
- data.duplicate_merge.manage：管理重复数据合并
- data.dictionary.manage：管理数据字典
- data.system_parameter.manage：管理系统参数

### 运维监控 ops.\*

- ops.overview.view：查看运维总览
- ops.api_status.view：查看 API 状态
- ops.database_status.view：查看数据库状态
- ops.redis_status.view：查看 Redis 状态
- ops.queue_status.view：查看队列状态
- ops.cron_job.view：查看定时任务状态
- ops.platform_sync.view：查看平台同步状态
- ops.worker_status.view：查看自动化 Worker 状态
- ops.storage_status.view：查看文件存储状态
- ops.disk_status.view：查看磁盘空间
- ops.error_log.view：查看最近错误
- ops.error_log.create：记录运维错误
- ops.health_snapshot.create：记录健康快照
- ops.platform.test_connection：测试平台连接
- ops.platform.reauthorize：重新授权平台

### 网站维护 maintenance.\*

- maintenance.announcement.view：查看系统公告
- maintenance.announcement.manage：管理系统公告
- maintenance.mode.view：查看维护模式
- maintenance.mode.manage：管理维护模式
- maintenance.version.view：查看版本信息
- maintenance.version.manage：管理版本和更新日志
- maintenance.feature_flag.view：查看功能开关
- maintenance.feature_flag.manage：管理功能开关
- maintenance.menu_config.manage：管理菜单配置
- maintenance.theme_config.manage：管理主题配置
- maintenance.system_parameter.manage：管理系统参数

## 6. 角色默认权限补充建议

### 管理员 admin

默认拥有所有 `notification.*`、`security.*`、`data.*`、`ops.*`、`maintenance.*`、`apple.topup.gift_code.*` 权限。

### 财务 finance

建议增加：

- apple.topup.gift_code.view_tail
- apple.topup.gift_code.view_full，是否默认授予需要业务确认
- data.export.view
- data.export.create
- notification.view
- notification.log.view

### 技术 technician

建议增加：

- ops.\*
- notification.telegram.test
- notification.log.view
- security.login_log.view
- security.abnormal_login.view
- maintenance.version.view

### 审计 auditor

建议增加：

- audit_log.view
- security.sensitive_access_log.view
- security.sensitive_operation.view
- security.login_log.view
- data.export.view
- notification.log.view

### 运营 operation

建议增加：

- notification.view
- notification.rule.view
- notification.template.manage
- maintenance.announcement.manage
- maintenance.feature_flag.view

### 客服 customer_service

建议增加：

- notification.view
- apple.topup.gift_code.view_tail

禁止默认授予：

- apple.topup.gift_code.view_full
- security.\*
- data.restore.create
- ops.\*

### 发货员 delivery_staff

建议增加：

- notification.view
- notification.log.view，仅限兑换码相关通知时可考虑

禁止默认授予：

- apple.topup.gift_code.\*
- security.\*
- data.\*
- maintenance.\*
