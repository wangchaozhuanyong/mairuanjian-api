# 开发任务清单

## Phase 0 - 项目初始化

- [x] T0001 初始化 monorepo 项目结构
- [x] T0002 创建 docker-compose，包含 PostgreSQL、Redis、MinIO
- [x] T0003 初始化 NestJS API
- [x] T0004 初始化 Vue3 Admin
- [x] T0005 配置 Prisma
- [x] T0006 添加 README 和 .env.example

## Phase 0.5 - 工程质量底座

- [x] T0051 初始化 Git 并配置 GitHub remote
- [x] T0052 接入 ESLint 和 Prettier
- [x] T0053 接入后端环境变量校验
- [x] T0054 接入统一 API 响应拦截器
- [x] T0055 接入统一 HTTP 异常过滤器
- [x] T0056 接入 PrismaModule 和 PrismaService 基础设施
- [x] T0057 安装并验证 Docker Desktop 或确认数据库替代方案
- [x] T0058 接入 CI 质量门禁

## Phase 1 - 登录、权限、日志

- [x] T0101 创建 users、roles、permissions、user_roles、role_permissions 表
- [x] T0102 实现登录接口和 JWT
- [x] T0103 实现 RBAC 权限守卫
- [x] T0104 实现后台登录页和基础布局
- [x] T0105 实现用户管理页面和接口
- [x] T0106 实现角色权限页面和接口
- [x] T0107 实现操作日志模块
- [x] T0108 实现附件上传模块
- [x] T0109 实现敏感操作日志拦截器

说明：敏感操作日志拦截器已提供 `@SensitiveAction` 基础设施；后续 Apple ID 密码、礼品卡完整代码、兑换码完整内容等敏感查看接口必须复用该能力。

## Phase 2 - 公共模块

- [x] T0201 实现客户管理后端
- [x] T0202 实现客户管理前端
- [x] T0203 实现客户详情页，预留订单、开通记录、任务区域
- [x] T0204 实现来源平台设置后端
- [x] T0205 实现来源平台设置前端
- [x] T0206 实现消息模板模块后端
- [x] T0207 实现消息模板前端
- [x] T0208 实现公共列表搜索、分页、排序组件

## Phase 3 - Apple ID 核心模块

- [x] T0301 创建 apple_accounts 表；敏感字段第一版加密保存在账号表，后续如需拆表再迁移 apple_account_secrets
- [x] T0302 实现 Apple ID 基础 CRUD
- [x] T0303 实现 Apple ID 密码、密保等敏感字段加密保存
- [x] T0304 实现 Apple ID 批量导入
- [x] T0305 在 apple_accounts 实现当前余额、余额人民币成本和移动加权平均成本字段；后续如需多币种汇总再拆 apple_balance_summary
- [x] T0306 实现 Apple ID 充值记录和移动加权平均成本
- [x] T0307 实现 Apple ID 消费记录
- [x] T0308 实现 Apple ID 余额修正
- [x] T0309 实现 Apple ID 状态检测记录
- [x] T0310 实现 Apple ID 详情页
- [x] T0311 实现查看敏感字段权限和操作日志
- [x] T0312 实现 Apple ID 搜索、筛选、排序、分页

## Phase 4 - Apple ID 订单和匹配

- [x] T0401 创建 apple_services 表
- [x] T0402 实现 Apple ID 业务设置后端和前端
- [x] T0403 创建 apple_service_platform_mappings 表
- [x] T0404 实现业务来源平台映射
- [x] T0405 创建 apple_orders、service_activations、apple_account_locks 表
- [x] T0406 实现 Apple ID 自动匹配接口
- [x] T0407 实现锁定规则1：按业务锁定
- [x] T0408 实现锁定规则2：全局锁定
- [x] T0409 实现 Apple ID 订单录入页面
- [x] T0410 实现可用 Apple ID 选择弹窗
- [x] T0411 实现订单提交后生成开通记录
- [x] T0412 实现订单提交后扣减余额并生成消费记录
- [x] T0413 实现订单利润计算
- [x] T0414 实现 Apple ID 开通记录列表和详情
- [x] T0415 实现 Apple ID 利润报表

## Phase 5 - 续费任务中心

- [x] T0501 创建 renewal_tasks 表
- [x] T0502 实现到期前 N 天自动生成联系客户任务
- [x] T0503 实现客户续费状态流转
- [x] T0504 实现联系客户、催回复、收款确认任务
- [x] T0505 实现待取消订阅任务
- [x] T0506 实现待充值续费任务
- [x] T0507 实现等待自动续费任务
- [x] T0508 创建 apple_account_action_plans 和 apple_account_action_plan_items 表
- [x] T0509 实现 Apple ID 操作计划生成
- [x] T0510 实现误扣费风险提醒
- [x] T0511 实现续费工作台：今日待办
- [x] T0512 实现续费工作台：按 Apple ID 分组
- [x] T0513 实现待取消订阅页面
- [x] T0514 实现待充值续费页面
- [x] T0515 实现等待自动续费页面
- [x] T0516 实现任务备注、处理结果备注、凭证上传
- [x] T0517 实现续费任务筛选、排序、分页

说明：T0516 已完成任务备注、处理结果备注、凭证附件上传、凭证关联保存和受控下载。Apple ID 操作计划第一版已支持按账号聚合、误扣费风险、建议充值和计划完成，后续可增强批量分配和自动化任务联动。

## Phase 6 - 兑换码库存和半自动发货

- [x] T0601 创建 code_services 表
- [x] T0602 实现兑换码业务设置
- [x] T0603 创建 code_platform_mappings 表
- [x] T0604 实现兑换码平台商品/SKU映射
- [x] T0605 创建 redeem_code_batches、redeem_codes 表
- [x] T0606 实现兑换码批量导入
- [x] T0607 实现兑换码去重
- [x] T0608 实现兑换码库存列表
- [x] T0609 实现查看完整兑换码权限和日志
- [x] T0610 创建 code_platform_orders 表
- [x] T0611 实现手工订单导入
- [x] T0612 实现订单自动匹配兑换码面值
- [x] T0613 实现锁定未售兑换码
- [x] T0614 实现一键生成发货内容
- [x] T0615 创建 code_delivery_logs 表
- [x] T0616 实现半自动发货记录
- [x] T0617 实现发货防重复
- [x] T0618 创建 code_after_sales、code_refund_records 表
- [x] T0619 实现售后补发
- [x] T0620 实现兑换码利润报表

## Phase 7 - 淘宝/闲鱼自动发货

- [x] T0701 设计 DeliveryAdapter 抽象接口
- [x] T0702 实现 ManualDeliveryAdapter
- [x] T0703 实现 TaobaoDeliveryAdapter 占位结构
- [x] T0704 实现淘宝订单同步接口占位
- [x] T0705 实现淘宝发货接口占位
- [x] T0706 实现淘宝退款同步接口占位
- [x] T0707 实现 XianyuDeliveryAdapter 占位结构
- [x] T0708 实现闲鱼订单同步接口占位
- [x] T0709 实现闲鱼电子凭证/无需物流发货接口占位
- [x] T0710 实现闲鱼退款售后同步接口占位
- [x] T0711 实现平台发货失败转人工
- [x] T0712 实现平台自动发货开关
- [x] T0713 实现平台利润报表

说明：Phase 7 当前完成平台适配层、占位接口、自动发货开关检查、失败转人工和平台利润报表入口；淘宝/闲鱼真实开放平台授权、签名、回调和接口字段映射需要在拿到平台能力后替换对应 Adapter。

## Phase 8 - Apple ID 自动化任务中心

- [x] T0801 创建 automation_tasks 表
- [x] T0802 实现自动化任务 CRUD
- [x] T0803 实现自动化任务队列
- [x] T0804 实现查询余额任务占位
- [x] T0805 实现检测状态任务占位
- [x] T0806 实现自动充值任务占位
- [x] T0807 实现取消订阅任务占位
- [x] T0808 实现修改手机号/密保任务占位
- [x] T0809 实现自动化任务日志和截图凭证
- [x] T0810 实现自动化任务失败转人工
- [x] T0811 实现自动化任务结果回写

说明：Phase 8 当前完成自动化任务中心的数据表、接口、前端页面、任务日志、截图附件关联、失败转人工和人工结果回写。查询余额、检测状态使用系统快照完成占位执行；自动充值、取消订阅、修改手机号、修改密保、检查续费在真实 Apple ID 自动化 Worker 接入前统一转入人工验证。

## 每个任务的完成要求

每个任务完成后必须输出：

1. 修改文件列表
2. 新增接口列表
3. 数据库变更说明
4. 如何运行迁移
5. 如何测试
6. 是否有未完成事项

## 禁止事项

- 不要一次性开发多个 Phase。
- 不要在没有 PRD 和 DATABASE 依据时随意建表。
- 不要让 Apple ID 模块依赖兑换码模块。
- 不要让兑换码模块依赖 Apple ID 模块。
- 不要用 float 处理金额。
- 不要明文保存敏感信息。

## Phase 9 - 通知中心

- [x] T0901 创建 notification_channels、notification_rules、notification_templates、notification_logs、telegram_configs 表
- [x] T0902 实现 Telegram Bot Token 加密保存和脱敏展示
- [x] T0903 实现通知规则 CRUD 和启用/停用
- [x] T0904 实现 Telegram 测试发送
- [x] T0905 实现系统站内通知
- [x] T0906 实现通知日志列表、筛选、重试
- [x] T0907 接入 Apple ID 到期、余额不足、状态异常等通知事件
- [x] T0908 接入兑换码低库存、缺货、自动发货失败通知事件
- [x] T0909 接入平台接口异常和授权过期通知事件
- [x] T0910 接入系统安全和运维异常通知事件

说明：Phase 9 当前完成通知中心基础底座、后端接口、权限、前端页面、日志重试、默认通知规则/模板 seed、内部 `triggerEvent` 触发入口，并已接入 Apple ID 续费到期/余额不足/状态异常、兑换码低库存/缺货/重复导入/导入失败/发货失败、淘宝/闲鱼订单同步异常、平台发货接口异常、平台授权即将过期/已失效、异常登录/连续登录失败安全事件、备份失败、数据库异常、队列积压和磁盘不足事件。平台授权通知第一版由平台接口状态页基于授权状态和可选 Token 有效期触发，真实淘宝/闲鱼 OAuth 接入后替换 Token 来源。

补充：Phase 11 数据中心已接入备份失败通知事件 `ops.backup.failed`；Phase 12 健康快照已接入 `ops.database.connection_abnormal`、`ops.queue.backlog`、`ops.disk.low`。

## Phase 10 - 安全中心

- [x] T1001 创建 login_logs、active_sessions、security_settings、ip_whitelists 表
- [x] T1002 创建 sensitive_access_logs、sensitive_access_approvals 表
- [x] T1003 实现登录日志记录和异常登录识别
- [x] T1004 实现在线会话列表和强制下线
- [x] T1005 实现密码策略配置
- [x] T1006 实现 MFA 设置结构
- [x] T1007 实现 IP 白名单配置
- [x] T1008 实现敏感字段访问日志
- [x] T1009 实现敏感字段访问审批流程
- [x] T1010 实现敏感操作记录查询

说明：Phase 10 当前完成安全中心数据库迁移、后端接口、权限 seed、前端页面、登录成功/失败日志、登录成功会话记录、会话强制下线、密码策略/MFA 设置、IP 白名单、敏感访问日志列表、敏感访问审批流转和敏感操作审计查询。异常登录第一版支持外部传入 abnormal 标记，以及同一账号或同一 IP 在 15 分钟内累计 5 次 failed / blocked 后自动标记异常并触发连续失败通知。MFA 真实绑定、恢复码和重置流程已在 Phase 18 完成；复杂设备指纹、地理位置会在后续安全增强阶段继续补充。

## Phase 11 - 数据中心

- [x] T1101 创建 backup_jobs、restore_jobs、data_import_jobs、data_export_jobs 表
- [x] T1102 创建 recycle_bin_records、system_parameters、data_dictionaries 表
- [x] T1103 实现数据备份任务记录
- [x] T1104 实现数据恢复任务记录和审批说明
- [x] T1105 实现导入任务列表、错误报告和状态流转
- [x] T1106 实现导出任务列表、敏感字段标记和下载过期
- [x] T1107 实现回收站记录和恢复入口
- [x] T1108 实现数据清理任务记录
- [x] T1109 实现重复数据合并任务记录
- [x] T1110 实现数据字典和系统参数管理

说明：Phase 11 当前完成数据库迁移、权限 seed、默认系统参数/数据字典 seed、后端接口、审计日志、备份失败通知事件、前端数据中心页面。第一版只实现任务记录、状态流转、下载元信息和回收站标记恢复，不直接执行真实物理备份、恢复、导入、导出、清理或合并；真实执行器将在后续队列/运维阶段接入。

## Phase 12 - 运维监控

- [x] T1201 创建 system_health_snapshots、queue_status_logs、cron_job_logs 表
- [x] T1202 创建 platform_sync_logs、error_logs 表
- [x] T1203 实现 API、数据库、Redis、文件存储状态检查
- [x] T1204 实现队列状态、积压和失败任务监控
- [x] T1205 实现定时任务状态监控
- [x] T1206 实现平台同步状态监控
- [x] T1207 实现自动化 Worker 状态监控
- [x] T1208 实现磁盘空间监控
- [x] T1209 实现最近错误列表和错误详情

说明：Phase 12 当前完成数据库迁移、权限 seed、后端接口、前端运维监控页面、健康快照记录、队列状态记录、平台连接测试日志、错误日志记录和运维异常通知触发。第一版 Redis/平台/Worker 以真实连通性或占位状态展示；淘宝、闲鱼真实授权与重新授权入口将在 Phase 14 平台接口状态继续完善。

## Phase 13 - 网站维护

- [x] T1301 创建 app_announcements、maintenance_windows、feature_flags、app_versions 表
- [x] T1302 实现系统公告管理
- [x] T1303 实现维护模式配置
- [x] T1304 实现版本信息和更新日志管理
- [x] T1305 实现功能开关管理
- [x] T1306 实现菜单配置
- [x] T1307 实现主题配置
- [x] T1308 实现系统参数管理

说明：Phase 13 当前完成数据库迁移、权限 seed、默认维护配置 seed、后端接口、审计日志、前端网站维护页面，以及网站维护、功能开关、版本信息、更新日志、系统参数菜单入口接入。第一版维护模式只完成配置保存和审计记录，真实全局访问拦截、灰度发布和前台维护页将在上线前网关/前端守卫阶段接入。

## Phase 14 - 审计日志中心和平台接口状态

- [x] T1401 统一操作日志、敏感查看日志、登录日志、导出日志查询入口
- [x] T1402 实现权限变更日志查询
- [x] T1403 实现自动化任务日志查询
- [x] T1404 实现平台接口日志查询
- [x] T1405 实现淘宝、闲鱼、Telegram、文件存储、自动化服务接口状态页
- [x] T1406 实现接口测试连接和重新授权入口

说明：Phase 14 当前完成审计日志中心分类接口、前端多标签审计页面、平台接口状态接口、平台接口状态前端页面、测试连接入口和重新授权占位入口。第一版复用 `audit_logs`、`sensitive_access_logs`、`login_logs`、`data_export_jobs`、`automation_task_logs`、`platform_sync_logs` 等既有日志表，不新增数据库表；淘宝/闲鱼真实 OAuth 授权流程后续接入真实开放平台时再实现。

## Phase 15 - 通用表格和查询能力

- [x] T1501 创建 user_table_views 表
- [x] T1502 实现统一日期快捷筛选：今天、昨天、近7天、近30天、本月、上月、自定义
- [x] T1503 实现统一搜索、筛选、排序、分页、刷新能力
- [x] T1504 实现批量操作和导出能力
- [x] T1505 实现列显示配置、密度切换、保存视图
- [x] T1506 实现筛选标签回显和一键清空筛选
- [x] T1507 将 Apple ID 订单真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1508 将兑换码订单真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1509 将 Apple ID 管理真实列表迁移到 `TableToolbar` 保存视图范式
- [x] T1510 将兑换码库存真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1511 将客户管理真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1512 将 Apple ID 续费任务真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1513 将 Apple ID 开通记录真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1514 将 Apple ID 操作计划真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1515 将 Apple ID 自动化任务真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1516 将 Apple ID 业务设置真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1517 将兑换码业务设置真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1518 将消息模板真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1519 将淘宝/闲鱼平台订单真实列表迁移到 `TableToolbar` 保存视图范式，复用兑换码订单后端排序白名单
- [x] T1520 将售后补发真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1521 将附件管理真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1522 将 Apple ID 余额对账真实列表迁移到 `TableToolbar` 保存视图范式，复用 Apple ID 账号后端排序白名单
- [x] T1523 将 Apple ID 财务对账、Apple ID 报表和兑换码报表迁移到 `TableToolbar` 保存视图范式
- [x] T1524 将用户管理真实列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1525 将权限管理角色列表迁移到 `TableToolbar` 保存视图范式
- [x] T1526 将审计日志中心操作日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1527 将审计日志中心敏感查看日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1528 将审计日志中心登录日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1529 将审计日志中心导出日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1530 将审计日志中心权限变更日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1531 将审计日志中心自动化任务日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1532 将审计日志中心平台接口日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1533 将通知中心规则、消息模板和通知日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1534 将安全中心登录日志和 IP 白名单迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1535 将安全中心在线会话、敏感审批和敏感查看日志迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1536 将平台接口状态页迁移到 `TableToolbar` 保存视图范式，并接入客户端筛选和排序
- [x] T1537 将网站维护系统公告和功能开关迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1538 将网站维护版本信息、更新日志和系统参数迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1539 将数据中心备份、恢复、导入和导出任务列表迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1540 将数据中心回收站、数据清理、重复合并、数据字典和系统参数迁移到 `TableToolbar` 保存视图范式，并接入后端排序白名单
- [x] T1541 统一页面头部信息架构，移除正文重复标题和副标题，改为顶部栏标题右侧说明按钮
- [x] T1542 重构后台左侧导航为细分类可折叠菜单，并将界面导航中的 Apple ID 简化为 ID
- [x] T1543 为后台左侧导航一级分类增加语义图标和更强层级样式，区分主分类、子分类和具体页面
- [x] T1544 清理正文顶部无业务价值的分组、阶段和“已接入接口”开发状态标签，仅保留真实操作按钮
- [x] T1545 强化左侧一级导航图标为可识别的彩色语义图标，避免只呈现弱边框占位
- [x] T1546 将左侧导航从三级压缩为两级结构，一级主分类展开后直接显示页面入口
- [x] T1547 将左侧一级导航改为手风琴交互，点开一个主分类时自动收起其它主分类
- [x] T1548 增加右侧工作区页签切换能力，导航打开的页面可在顶部页签间切换并保留页面临时输入状态
- [x] T1549 增加工作区页签显式关闭操作，支持关闭当前、关闭其他和关闭全部
- [x] T1550 优化工作区页签和 Apple ID 财务报表性能，关闭全部时释放旧页面缓存，报表页仅挂载当前可见表格

说明：Phase 15 当前完成 `user_table_views` 持久化表、个人保存视图 API、默认视图唯一规则、通用 `TableToolbar` 组件、日期快捷筛选、批量操作入口、导出入口、列显示配置、密度切换、保存视图、筛选标签回显和一键清空。第一版已接入模块化占位页、用户管理真实列表、权限管理角色列表、审计日志中心操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志和平台接口日志、通知中心规则/消息模板/通知日志、安全中心登录日志、在线会话、IP 白名单、敏感审批和敏感查看日志、平台接口状态页、网站维护系统公告、功能开关、版本信息、更新日志和系统参数、数据中心备份/恢复/导入/导出任务、回收站、数据清理、重复合并、数据字典和系统参数、客户管理真实列表、来源平台真实列表、消息模板真实列表、附件管理真实列表、Apple ID 管理真实列表、Apple ID 余额对账真实列表、Apple ID 财务对账/报表、Apple ID 业务设置真实列表、Apple ID 订单真实列表、Apple ID 开通记录真实列表、Apple ID 续费任务真实列表、Apple ID 操作计划真实列表、Apple ID 自动化任务真实列表、兑换码业务设置真实列表、兑换码订单真实列表、兑换码库存真实列表、兑换码报表、淘宝/闲鱼平台订单真实列表、售后补发真实列表作为统一范式；更多真实业务列表页面后续按模块逐页迁移复用。

## Phase 3 补充任务 - Apple ID 充值礼品卡代码

- [x] T0320 给 Apple ID 充值记录增加 gift_card_code_encrypted、gift_card_code_hash、gift_card_code_tail 设计
- [x] T0321 实现 Apple ID 充值礼品卡代码加密保存
- [x] T0322 实现 gift_card_code_hash 重复检测
- [x] T0323 实现 gift_card_code_tail 列表展示
- [x] T0324 实现查看完整礼品卡代码权限控制和审计日志
- [x] T0325 明确 Apple ID 充值礼品卡代码不得和兑换码库存混用

## 当前实现进度补充 - Phase 2 公共模块

- [x] T0201 创建 customers 表和基础 CRUD 接口
- [x] T0202 创建 source_platforms 表和基础 CRUD 接口
- [x] T0203 创建 message_templates 表和基础 CRUD 接口
- [x] T0204 给 attachments 增加列表查询和上传权限
- [x] T0205 前端接入客户管理、来源平台设置、消息模板、附件管理真实页面
- [x] T0206 公共模块创建、更新、删除写入 audit_logs
- [x] T0207 增强客户敏感字段查看审批和完整手机号查看日志
- [x] T0208 增强附件业务关联字段和下载权限控制

## 当前实现进度补充 - Phase 3 Apple ID 核心模块

- [x] T0301 创建 apple_accounts 表和 Apple ID 状态枚举
- [x] T0302 实现 Apple ID 基础 CRUD 接口
- [x] T0303 实现 Apple ID 密码、密保、手机号、备用邮箱加密保存
- [x] T0304 实现 Apple ID 列表脱敏展示
- [x] T0305 实现当前余额、余额人民币成本、移动加权平均成本字段
- [x] T0306 实现余额和成本录入时平均成本自动计算
- [x] T0307 实现 Apple ID 手动锁定字段和锁定原因
- [x] T0308 前端接入 Apple ID 管理真实列表和表单
- [x] T0309 实现敏感字段查看权限、敏感访问日志和完整字段查看审计
- [x] T0310 实现 Apple ID 充值记录和消费记录
- [x] T0311 前端接入 Apple ID 充值、消费和余额流水抽屉
- [x] T0312 充值礼品卡代码加密保存、hash 去重、尾号展示
- [x] T0313 实现完整礼品卡代码查看权限和审计日志

说明：Apple ID 敏感字段第一版已实现“权限 + 原因 + 审计 + 敏感访问日志”。审批流已在安全中心具备基础表和接口，后续如需强制审批后才能查看，可在安全策略中接入审批前置校验。

## Phase 16 - 上线缺口盘点与发布准备

- [x] T1601 创建 `docs/ROADMAP_TO_LAUNCH.md`，整理从当前开发状态到正式上线的执行路线图
- [x] T1602 重新运行完整质量门禁 `npm run check`，记录当前基线结果
- [x] T1603 验证生产 Compose 配置 `npm run prod:config:example`
- [x] T1604 验证 API/Admin 生产 Docker 镜像可构建
- [x] T1605 将上线检查清单页面从占位改为真实验收任务页面
- [x] T1606 验证 403、404、系统维护模式页没有死路由或空白页
- [x] T1607 接入维护模式后台全局访问拦截
- [x] T1608 完成 Apple ID 代充业务端到端验收
- [x] T1609 完成兑换码半自动发货端到端验收
- [x] T1610 完成敏感字段查看权限、原因、审计和敏感访问日志回归
- [x] T1611 完成数据库备份和恢复演练
- [ ] T1612 完成 Telegram 真实测试发送
- [ ] T1613 准备生产 `.env.production`，确认没有占位密钥和明文敏感信息
- [x] T1614 将生产 Compose 示例校验和 Git 提交前安全检查纳入 GitHub Actions 质量门禁
- [x] T1615 将 API/Admin 生产 Docker 镜像构建纳入 GitHub Actions 质量门禁
- [x] T1616 新增生产 `.env.production` 强随机密钥初始化脚本
- [x] T1617 为本地上线验收增加生产环境变量强制门禁开关 `REQUIRE_PROD_ENV=1`
- [x] T1618 新增上线状态速览脚本 `npm run launch:status`，只读汇总 Phase 16/17/18 缺口、生产环境变量状态和 Git 状态
- [x] T1619 新增手工门禁只读核验脚本 `npm run launch:gates`，统一检查生产 env、Telegram 真实测试状态和上线检查清单
- [x] T1620 新增生产域名安全设置脚本 `npm run prod:env:set-domain`，只更新 `APP_PUBLIC_URL` 和 `CORS_ORIGIN`
- [x] T1621 增强 Git 提交前安全扫描，拦截 Telegram Bot Token 误提交
- [x] T1622 新增 `npm run git:readiness:verbose`，输出首次提交候选文件摘要
- [x] T1623 将上线检查清单手工项纳入 `launch:gates` 阻塞结果，避免 `telegram_test`、`prod_env`、`git_baseline` 被遗漏
- [x] T1624 新增 `npm run launch:checklist`，用于记录上线检查清单手工门禁状态和证据
- [x] T1625 新增 `docs/FIRST_RELEASE_HANDOFF.md`，沉淀首版发布当天交接清单
- [x] T1626 新增 `npm run release:review`，用于首次提交和上线前只读聚合审查
- [x] T1627 新增 `docs/INITIAL_COMMIT_PLAN.md`，沉淀首次 Git 提交范围、排除项和建议提交信息
- [x] T1628 新增 `docs/TELEGRAM_RELEASE_GATE.md`，沉淀 Telegram 真实测试门禁操作和排错流程
- [x] T1629 新增 `npm run prod:env:review` 和 `docs/PRODUCTION_ENV_RELEASE_GATE.md`，用于生产环境变量门禁安全审查
- [x] T1630 新增 `npm run release:ready`，作为正式上线前 strict 发布就绪硬门禁
- [x] T1631 新增 `npm run release:blockers`，输出当前上线阻塞项行动清单

说明：Phase 16 不代表新增业务模块，而是把已经完成的第一版系统推进到可上线状态。淘宝/闲鱼真实开放平台、Apple ID 真实自动化 Worker、数据中心真实执行器是否进入上线前 P0，取决于第一版上线策略是否允许半自动运营。

验证记录：当前基线已通过 `npm run check`、`npm run prod:config:example`，并使用 `COMPOSE_BAKE=false DOCKER_BUILDKIT=0` 验证 API/Admin 生产镜像可构建；GitHub Actions 已纳入代码质量、生产 Compose 示例、Git 提交前安全检查和 API/Admin 生产 Docker 镜像构建。上线检查清单已接入真实页面和 `system_parameters` 持久化接口，浏览器实测 `/workspace/launch-audit` 可显示 12 个验收项、统计和保存入口。已通过浏览器实际渲染确认 `/403`、`/404`、`/system/maintenance-mode` 均能显示对应页面内容。维护模式已接入公开只读状态接口和前端路由守卫，维护开启时非允许角色会被引导到维护模式页。`npm run acceptance:business` 已通过真实本地 API 验收 Apple ID 代充闭环和兑换码半自动发货闭环，并更新上线检查清单中的 `apple_e2e`、`code_e2e`。`npm run acceptance:security` 已通过真实本地 API 验收 Apple ID 密码、Apple ID 礼品卡代码、兑换码完整码、客户手机号的无权限拦截、查看原因、操作审计和敏感访问日志，并更新上线检查清单中的 `sensitive_audit`。Admin 前端已完成路由级按需加载和 Element Plus 异步组件注册，本轮生产构建最大 JS chunk 约 370.95KB，已消除 500KB chunk 警告。`npm run acceptance:launch` 本地等效上线验收总入口已跑通，串行验证格式、lint、类型检查、27 个 API 测试套件、96 个测试、生产构建、Prisma schema、生产 Compose 示例、业务闭环、安全回归、备份、临时库恢复和 Git 提交前安全检查。本轮备份文件为 `backups/postgres/local/apple_business-20260618-053949.dump`，已恢复到临时数据库 `restore_drill_20260618_053950_19852` 验证关键表数量后清理，其中 `users=4`、`roles=8`、`permissions=117`、`audit_logs=221`、`system_parameters=8`、`apple_accounts=14`、`redeem_codes=13`。`npm run git:readiness` 已确认 Git remote 存在，`.env`、备份、上传文件、构建产物和常见密钥不会进入 Git 候选文件；是否执行首次 commit/push 仍等待用户确认。当前仍存在 `npm audit` 报告的低/中级依赖风险；高危审计门禁通过。

补充验证记录：新增 `REQUIRE_PROD_ENV=1` 强制门禁开关后，`npm run acceptance:launch` 已再次通过本地等效上线验收。生产 `.env.production` 已生成强随机密钥骨架，但 `APP_PUBLIC_URL` 和 `CORS_ORIGIN` 仍为占位域名，因此本地验收将生产环境变量门禁标记为 `pending` 并继续执行；预发布或生产等效环境必须使用 `REQUIRE_PROD_ENV=1 npm run acceptance:launch` 强制失败。最新备份文件为 `backups/postgres/local/apple_business-20260618-055354.dump`，已恢复到临时数据库 `restore_drill_20260618_055354_21188` 验证关键表数量后清理，其中 `users=4`、`roles=8`、`permissions=117`、`audit_logs=252`、`system_parameters=8`、`apple_accounts=16`、`redeem_codes=16`。

补充验证记录：新增 `npm run launch:status` 作为只读上线状态速览入口，用于在继续开发或上线前快速查看 Phase 16/17/18 未完成项、生产环境变量校验结果和 Git 变更状态。该命令不修改数据库、不发送通知、不启动服务；真实 Telegram 测试发送、真实生产域名和首次 commit/push 仍是外部或人工门禁。

补充验证记录：`npm run launch:status` 已补充首版发布门禁判断，会根据 `FIRST_RELEASE_MODE` 将阻塞项和后续自动化路线图区分展示。在 `semi_auto` 模式下，Phase 17 的淘宝/闲鱼真实 Adapter 和 Apple ID 真实 Worker 会显示为 post-launch automation roadmap，不阻断首个内部可运营版本；在 `full_auto` 模式下，这些任务仍会作为上线前阻塞项。

补充验证记录：新增 `npm run launch:gates` 和 `npm run launch:gates:strict`。该脚本只读检查 `.env.production`、`telegram_configs.last_test_status` 和上线检查清单中的 `telegram_test`、`prod_env`、`git_baseline`，不会发送 Telegram、不会写数据库、不会输出明文 token。当前真实 Telegram 测试和真实生产域名仍未完成，因此该脚本会显示 manual gates blocked；预发布或生产等效环境可使用 strict 版本让未通过项返回失败退出码。

补充验证记录：`npm run acceptance:launch` 已纳入 `launch:gates`。本地默认使用非 strict 模式，只展示生产 env 和 Telegram 真实测试门禁状态，不阻断本地等效验收；当设置 `REQUIRE_PROD_ENV=1` 或 `REQUIRE_MANUAL_GATES=1` 时，会执行 `launch:gates:strict`，确保预发布或生产等效验收在真实域名或 Telegram 真实测试未完成时失败退出。

补充验证记录：新增 `npm run prod:env:set-domain`，支持 `--dry-run`、`--app-url`、`--cors-origin` 和 `--env-file`。该脚本用于拿到真实 HTTPS 域名后安全更新 `.env.production`，只改 `APP_PUBLIC_URL` 和 `CORS_ORIGIN`，不会打印或重置生产密钥。当前真实域名仍未提供，因此 T1613 仍保持未完成。

补充验证记录：`npm run git:readiness` 已增强 Telegram Bot Token 扫描，除 `.env`、`.env.production`、备份、上传文件、构建产物和常见云厂商/API 密钥外，也会拦截形如真实 Telegram Bot Token 的内容进入 Git 候选文件。真实 Telegram 配置仍应只保存在数据库加密字段和生产环境中，不应写入代码或文档。

补充验证记录：`npm run launch:gates` 已将上线检查清单中的 `telegram_test`、`prod_env`、`git_baseline` 纳入阻塞结果。清单项只有在状态为 `passed` 时才视为放行；当前这三项仍为 `pending`，因此 non-strict 模式会显示 blocked，strict 模式会返回失败退出码。

补充验证记录：新增 `npm run git:readiness:verbose`，在普通提交前安全检查基础上输出候选文件按顶层目录、扩展名的统计摘要和前 40 个文件样本。该命令便于首次提交前人工审查范围，不会修改文件、不执行提交、不推送远程。

补充验证记录：再次运行 `npm run acceptance:launch` 已通过本地等效上线验收。该流程串行通过 `npm run check`、`npm run prod:config:example`、`npm run acceptance:business`、`npm run acceptance:security`、数据库备份、临时库恢复演练、`npm run launch:gates` 和 `npm run git:readiness`。本次业务验收生成 Apple ID 订单 `90a895ef-ed43-4b5a-b473-089de239f7b1`、兑换码订单 `0a14cf7d-d596-42ab-ab85-6fa4fc0f2e2f`，安全验收覆盖 Apple ID 密码、Apple ID 礼品卡代码、兑换码完整码和客户手机号。最新备份文件为 `backups/postgres/local/apple_business-20260618-133507.dump`，已恢复到临时数据库 `restore_drill_20260618_133508_20016` 验证关键表数量后清理，其中 `users=4`、`roles=8`、`permissions=117`、`audit_logs=345`、`system_parameters=8`、`apple_accounts=22`、`redeem_codes=25`。本地非 strict 模式下生产 env gate 为 `pending`、manual gates 为 `checked-non-strict`；真实生产域名和 Telegram 真实测试仍是首版上线前外部门禁。

补充验证记录：2026-06-18 13:41 PDT 再次运行 `npm run acceptance:launch` 已通过本地等效上线验收。该流程通过格式检查、lint、类型检查、29 个 API 测试套件、158 个测试、前后端生产构建、Prisma schema 校验、高危依赖审计、生产 Compose 示例、业务闭环、安全回归、PostgreSQL 备份、临时库恢复演练、`npm run launch:gates` 和 `npm run git:readiness`。本次业务验收生成 Apple ID 订单 `60df5990-54e6-41cc-97ab-0b284d1a1b95`、Apple ID 开通记录 `234143f1-b736-4f03-9d28-a93728cea786`、兑换码订单 `c3b49542-15c5-467d-b6ad-7bd2f3b290ea`，兑换码重复发货保护返回 `409`。最新备份文件为 `backups/postgres/local/apple_business-20260618-134138.dump`，已恢复到临时数据库 `restore_drill_20260618_134138_11556` 验证关键表数量后清理，其中 `users=4`、`roles=8`、`permissions=117`、`audit_logs=376`、`system_parameters=8`、`apple_accounts=24`、`redeem_codes=28`。当前高危审计门禁通过，但 `npm audit` 仍报告低/中级依赖风险；生产 env、Telegram 真实测试和首次 Git 基线确认仍是首版上线前外部门禁。

补充验证记录：新增 `npm run launch:checklist`，用于在真实 Telegram 测试、真实生产域名校验或 Git 基线确认完成后，记录 `telegram_test`、`prod_env`、`git_baseline` 三个手工门禁项的状态和证据。该脚本支持 `--list` 和 `--dry-run`，写入时会更新 `system_parameters.maintenance_launch_checklist` 并创建 `maintenance.launch_checklist.manual_gate.record` 审计日志；它会拒绝将常见密钥或 Telegram Bot Token 格式写入证据文本。已验证 `npm run launch:checklist -- --list` 和 dry-run 记录命令，不会在未授权情况下把 `git_baseline` 标为通过。

补充验证记录：新增 `docs/FIRST_RELEASE_HANDOFF.md` 作为首版发布当天交接清单，按顺序固化 Git 基线确认、生产域名配置、Telegram 真实测试、严格上线验收、部署烟测和回滚原则。该文档明确 `launch:checklist` 只记录已经真实完成的手工门禁，不用于绕过 `launch:gates`、`prod:env:check` 或 Telegram 真实发送。

补充验证记录：新增 `npm run release:review`，只读聚合输出上线状态、手工门禁、上线检查清单手工项和 Git 候选文件摘要。该命令不会写数据库、不会发送通知、不会 commit/push；用于首次提交授权前和上线当天快速审查当前发布状态。

补充验证记录：新增 `docs/INITIAL_COMMIT_PLAN.md`，基于 `npm run git:readiness:verbose` 当前结果记录首次提交候选范围、必须排除的敏感文件和密钥类型、提交前必跑命令、建议 commit message 以及用户授权后才可执行的 commit/push 命令。当前仍未执行 commit 或 push，`git_baseline` 保持 `pending`。

补充验证记录：新增 `docs/TELEGRAM_RELEASE_GATE.md`，记录 Telegram 上线门禁目标、权限要求、后台入口、配置字段、真实测试发送步骤、`launch:gates` 验证、上线证据记录、常见失败排查和安全禁止项。该文档明确不能直接改数据库伪造 `last_test_status`，不能在未实际收到 Telegram 消息时标记 `telegram_test=passed`。

补充验证记录：新增 `npm run prod:env:review`，只读审查 `.env.production`，输出公开域名和密钥状态摘要但不打印真实密钥；同时新增 `docs/PRODUCTION_ENV_RELEASE_GATE.md`，沉淀真实 HTTPS 域名配置、生产 env 校验、strict 上线验收和 `prod_env` 证据记录流程。当前审查显示 `.env.production` 的密钥已设置为非占位状态，但 `APP_PUBLIC_URL` 和 `CORS_ORIGIN` 仍为 `https://example.com`，且 `FIRST_RELEASE_MODE` 缺失，正式上线前仍需处理。

补充验证记录：新增 `npm run release:ready`，复用 `scripts/release-review.mjs --strict`，在不写文件、不写数据库、不发送通知、不 commit/push 的前提下，强制检查上线状态、`launch:gates:strict`、生产 env 校验、生产 env 审查详情、上线检查清单和 Git 候选文件安全性。当前由于 Telegram 真实测试、生产域名和上线检查清单手工项仍未完成，该命令会按预期返回失败退出码。

补充验证记录：新增 `npm run release:blockers`，只读汇总当前上线阻塞项、负责人、处理动作、验证命令和证据记录命令。当前输出 3 个阻塞项：Telegram real test、Production env、Git baseline；该命令不写文件、不写数据库、不发送通知、不 commit/push，只用于安排下一步处理顺序。

- [x] T1632 新增生产发布模式安全设置脚本 `npm run prod:env:set-mode`

补充验证记录：新增 `npm run prod:env:set-mode`，用于安全设置 `.env.production` 中的 `FIRST_RELEASE_MODE`。脚本只支持 `semi_auto` 或 `full_auto`，支持 `--dry-run`，不会打印、重置或改动生产密钥。已用 `--dry-run` 验证当前可写入 `semi_auto`，但未实际修改 `.env.production`；`prod:env:review` 仍正确提示 `FIRST_RELEASE_MODE` 缺失，等待真实上线前按手册写入。

- [x] T1633 修正 `npm run launch:status` 的 Git 待审查文件统计，避免未跟踪目录只显示顶层条目导致首次提交范围被低估

- [x] T1634 将 `FIRST_RELEASE_MODE` 纳入 `npm run prod:env:check` 硬校验，缺失或不是 `semi_auto/full_auto` 时禁止通过生产环境变量检查

补充验证记录：`npm run prod:env:check` 已将 `FIRST_RELEASE_MODE` 作为必填生产环境变量，且只允许 `semi_auto` 或 `full_auto`。当前 `.env.production` 因缺少 `FIRST_RELEASE_MODE`、`APP_PUBLIC_URL=https://example.com` 和 `CORS_ORIGIN=https://example.com` 会被硬拦截；`release:blockers` 已同步提示先运行 `npm run prod:env:set-mode -- --mode=semi_auto`，再设置真实 HTTPS 域名。

- [x] T1635 增强 `npm run launch:status` 的发布模式来源展示，明确区分 `.env.production` 已配置和从模板 fallback 推断的状态

- [x] T1636 将 API 生产运行时的 `FIRST_RELEASE_MODE` 改为必填，并补充配置校验单测，防止绕过脚本直接启动生产时静默 fallback

- [x] T1637 禁止 `telegram_test`、`prod_env`、`git_baseline` 三个首版 P0 手工门禁被 `waived/豁免` 放行；CLI、发布脚本、后端保存和后台页面已同步收紧

- [x] T1638 增强 `npm run launch:gates` 的清单完整性校验；`telegram_test`、`prod_env`、`git_baseline` 任一缺失也会显示为 missing 并阻塞上线

- [x] T1639 增强 `npm run launch:checklist` 的 `passed` 写入前真实状态校验；生产 env 必须当前通过、Telegram 必须有启用且测试成功配置、Git 基线必须已有提交且工作区干净

- [x] T1640 修正上线手册中的手工门禁记录顺序，避免 `prod_env` 等待 strict acceptance、strict acceptance 又等待 `prod_env=passed` 的循环依赖

- [x] T1641 修正 `npm run launch:status` 的发布模式来源和生产 env 下一步提示；当 `.env.production` 存在但缺少 `FIRST_RELEASE_MODE` 时明确提示字段缺失，并将下一步收敛为先跑 `prod:env:review/check`、记录 `prod_env` 证据，再进入最终 strict 验收

## Phase 17 - 平台接口与自动化增强

- [x] T1701 确认第一版上线策略：半自动运营优先，还是必须全自动发货
- [ ] T1702 接入淘宝真实 OAuth、签名、订单同步、发货、退款同步
- [ ] T1703 接入闲鱼真实授权、订单同步、电子凭证或无需物流发货
- [x] T1704 接入平台 Webhook 或定时轮询任务
- [ ] T1705 接入 Apple ID 真实自动化 Worker
- [ ] T1706 将平台授权状态页的重新授权占位替换为真实授权流程
- [x] T1707 增强平台接口错误率、调用次数、失败原因和重试记录

说明：Phase 17 属于全自动化增强阶段。如果第一版允许手工导入和半自动发货，可以在生产上线后逐步接入；如果业务要求无人值守自动发货，则必须在正式上线前完成。

补充验证记录：第一版上线策略已固化为“半自动可运营优先”，详见 `docs/LAUNCH_STRATEGY.md`。配置项 `FIRST_RELEASE_MODE=semi_auto` 已写入 `.env.example` 和 `.env.production.example`，并纳入后端环境校验与 `npm run launch:status` 展示。该策略下淘宝/闲鱼真实开放平台和 Apple ID 真实自动化 Worker 不阻断第一版内部上线；如果改为 `FIRST_RELEASE_MODE=full_auto`，则 T1702、T1703、T1705、T1706 必须在正式上线前完成。

补充验证记录：平台轮询任务已接入 `POST /api/platforms/taobao/poll`、`POST /api/platforms/xianyu/poll`、`POST /api/platforms/poll-all` 和默认关闭的 `PlatformPollingWorker`。生产可通过 `PLATFORM_POLL_ENABLED=true` 与 `PLATFORM_POLL_INTERVAL_MS` 开启定时轮询。每次轮询会写 `cron_job_logs`、`platform_sync_logs` 和 `audit_logs`；当前淘宝/闲鱼真实开放平台适配器仍未接入，因此轮询会保留失败/不支持状态，真实 OAuth、签名、订单同步、发货、退款同步仍属于 T1702/T1703/T1706。

补充验证记录：平台接口状态已基于最近 30 天 `platform_sync_logs` 统计调用次数、失败请求数、失败日志数、最近失败时间、重试记录数、最近重试时间和加权错误率；错误率按失败请求数 / 总请求数计算，不再使用简单日志平均值。前端平台接口状态页已补充对应列展示、列配置和排序能力。淘宝/闲鱼真实 OAuth、真实订单同步、真实发货和退款同步仍属于 T1702/T1703/T1706。

补充验证记录：平台授权配置底座已接入 `GET/POST /api/ops/platforms/:platform/authorization`，支持保存 `appKey`、`appSecret`、`accessToken`、`refreshToken`、`tokenExpiresAt`、店铺名称和授权范围。敏感字段使用字段加密服务保存到 `system_parameters` 的 `platform_auth` 分组，平台状态页只展示是否配置和尾号，保存动作写审计日志和平台接口日志。真实 OAuth 授权跳转、回调验签和 token 刷新仍属于 T1706，真实订单/发货/退款接口仍属于 T1702/T1703。

补充验证记录：平台 OAuth 发起/回调骨架已接入 `POST /api/ops/platforms/:platform/oauth/start` 和 `GET /api/ops/platforms/:platform/oauth/callback`。当前支持保存授权地址、Token 地址、回调地址、Client ID 参数名，发起授权时生成 state 并写入 10 分钟有效的 `platform_oauth_state` 参数，回调时校验 state 并加密保存授权码。该能力只完成“授权流程外壳”，还未完成淘宝/闲鱼真实 token exchange、平台签名验签、token 刷新、订单同步、发货和退款，因此 T1702/T1703/T1706 仍保持未完成。

## Phase 18 - 数据、运维和安全增强

- [x] T1801 接入数据中心真实备份执行器
- [x] T1802 接入数据中心真实恢复执行器，并保留强确认保护
- [x] T1803 接入数据导入真实执行器和错误行报告下载
- [x] T1804 接入数据导出真实执行器、下载有效期和导出审计
- [x] T1805 增强异常登录识别、连续失败策略和通知
- [x] T1806 完成 MFA 真实绑定、恢复码和重置流程
- [x] T1807 建立生产日志保留、备份保留和磁盘告警策略
- [x] T1808 建立预发布环境上线演练记录

说明：Phase 18 主要提升长期运行能力。生产上线前至少必须保证备份脚本、恢复演练、安全密钥、审计日志和基础监控可用。

补充验证记录：数据导出任务已接入真实 CSV 执行器，支持客户、来源平台、Apple ID 账号概览、Apple ID 订单、兑换码库存概览、兑换码订单等模块，单次最多 5000 行；导出文件默认保存到 `uploads/data-exports`，下载有效期默认 24 小时，下载接口返回文件流并写 `data.export.download` 审计日志。敏感原文字段不导出，只导出脱敏值或尾号。

补充验证记录：数据导入任务已接入真实 CSV 执行器，第一版支持 `customers` 和 `source_platforms` 两类低风险模块，文件从 `uploads/data-imports` 受控读取，单次最多 5000 行；部分成功会保留成功落库数据、失败行数量和 CSV 错误报告，错误报告默认写入 `uploads/data-import-errors`，下载接口返回文件流并写 `data.import.error_report.download` 审计日志。Apple ID 密码、完整兑换码、礼品卡完整码等敏感原文导入仍走专用业务模块，不通过数据中心通用导入器。

补充验证记录：数据中心备份任务已接入真实 PostgreSQL 备份执行器，`POST /api/data/backup-jobs/:id/execute` 会调用 `scripts/backup-postgres.sh`，成功后写入 `storagePath`、`fileSize` 和执行审计，失败时写 failed 状态并触发 `ops.backup.failed` 通知。数据中心恢复任务已接入强确认恢复演练执行器，`POST /api/data/restore-jobs/:id/execute` 要求确认文本 `CONFIRM_RESTORE_DRILL {restoreJobId前8位}`，并调用 `scripts/verify-postgres-restore.sh` 将备份恢复到临时库验证，不覆盖当前业务库；备份文件路径限制在 `DATA_BACKUP_DIR` 内。

补充验证记录：已为生产 Docker Compose 接入容器日志轮转，默认 `DOCKER_LOG_MAX_SIZE=20m`、`DOCKER_LOG_MAX_FILE=10`；`backup-postgres.sh` 已支持 `BACKUP_RETENTION_DAYS` 和 `BACKUP_RETENTION_COUNT`，默认保留 14 天且最多 30 份，并只清理当前数据库名匹配的 dump 文件；生产环境变量校验已覆盖这些保留策略参数。磁盘告警沿用运维监控健康快照，80% warning、90% critical，critical 时触发 `ops.disk.low` 通知事件。远程日志采集和异地备份属于生产运维部署增强，需在正式服务器上按实际存储方案配置。

补充验证记录：MFA 已完成个人绑定、TOTP 验证、恢复码一次性使用、管理员重置和登录链路拦截。MFA 密钥使用字段加密服务保存，恢复码只保存 hash；登录时已绑定 MFA 的账号必须提供动态验证码或恢复码，缺失或错误会写入 `login_logs` 的 blocked 记录并拒绝签发 JWT。安全中心策略设置页已接入“我的 MFA”绑定入口，登录页已支持输入动态验证码或恢复码。

补充验证记录：已建立 `docs/STAGING_DRILL.md` 作为预发布环境上线演练记录，包含预发布环境信息、演练前检查、必跑命令、业务验收记录、系统能力验收、问题记录和演练结论。本文件当前记录的是本地等效验收状态；真实预发布域名、服务器、Telegram 配置和上线策略确认后，需要按该记录补齐实际执行结果。
