# 全站 UI/UX 体验审计报告

- 审计日期：2026-06-28
- 项目：Apple ID 代充业务管理系统 + 兑换码自动发货系统
- 项目路径：`/Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件`
- 当前分支：`codex/replan-admin-ui-framework`
- 审计性质：第一阶段全站检查，不修改业务代码
- 前端入口：`apps/admin`
- 前端技术栈：Vue 3 + Vite + TypeScript + Element Plus + Pinia + Vue Router + Axios
- 后端技术栈：NestJS + TypeScript + Prisma + PostgreSQL，Redis/BullMQ 预留
- 包管理器：npm workspaces

## 1. 审计范围

本次审计覆盖后台管理前端的主要页面、组件体系、导航结构、列表体验、表单体验、错误状态、空状态、移动端布局、基础无障碍和安全相关操作入口。

本次只做本地静态检查和浏览器抽样验证，不进行线上环境验证，不修改 UI、接口、数据库或权限逻辑。

## 2. 当前运行环境

- API 健康检查：`http://localhost:3100/api/health/live` 返回 live。
- API 就绪检查：`http://localhost:3100/api/health/ready` 返回 ready，database 为 true，redis 为 not_configured。
- 前端 dev server：`http://localhost:5374/`。
- 当前浏览器已有登录态，因此本次重点检查登录后的后台体验；完整登出登录流程未作为本轮证据。
- 多个业务数据接口在页面抽样时返回 502，报告将其作为体验问题记录，但不判断根因属于前端、代理、接口还是环境数据。

## 3. 文件与结构盘点

### 3.1 页面数量

`apps/admin/src/views` 下共发现 38 个 Vue 页面文件。

- Apple ID 业务区：14 个页面
- 兑换码业务区：6 个页面
- 系统配置与安全：12 个页面
- 公共业务页面：5 个页面
- 认证页面：1 个页面

### 3.2 模块导航数量

`apps/admin/src/config/modules.ts` 中共定义 57 个模块入口。

主要分组：

- 工作台
- Apple ID 业务
- 客户与来源
- 兑换码自动发货
- 系统配置
- 数据与记录
- 安全与风控
- 内部维护
- 平台连接
- 异常页面
- 服务状态

已标记 later 或规划中的模块包括：`/system/risk-control`、`/workspace/work-orders`。

### 3.3 关键页面覆盖

本轮重点抽样检查了：

- `/dashboard`
- `/apple/accounts`
- `/apple/order-entry`
- `/codes/orders`
- `/system/security`
- `/system/source-platforms/platforms`
- `/404`
- 移动端 `/dashboard`
- 移动端 `/codes/orders`

## 4. 截图证据

截图目录：

`qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots`

有效截图：

- `01-dashboard-desktop.png`
- `02-apple-accounts-desktop-api-error.png`
- `03-order-entry-desktop.png`
- `04-code-orders-desktop.png`
- `05-security-center-desktop.png`
- `06-source-options-desktop.png`
- `07-system-state-404-desktop.png`
- `08-dashboard-mobile.png`
- `09-dashboard-mobile-menu-open.png`
- `10-code-orders-mobile.png`

说明：浏览器 fullPage 截图在部分页面出现空白背景，已移动到 `screenshots/rejected`，不作为 UI 结论证据。

## 5. 组件与设计系统盘点

### 5.1 已有良好基础

项目已有比较完整的后台设计系统基础：

- `PageScaffold`：页面标题、描述、顶部操作、内容区域统一容器。
- `AppState`：支持 loading、empty、error、forbidden、info、success、warning 等状态。
- `AppCard`：支持 loading、empty、error 状态。
- `TableToolbar`：统一搜索、筛选、导出、重置等列表工具栏。
- `PaginationBar`：统一分页操作。
- `AppButton`：封装 Element Plus Button。
- 全局 CSS 变量：背景、卡片、文字、边框、品牌色、状态色、阴影、圆角、sidebar/topbar 尺寸等。
- 已有 skip link、focus ring、route progress、移动端菜单等基础体验能力。

### 5.2 当前一致性风险

虽然共享组件存在，但页面使用不完全一致：

- `PageScaffold` 使用覆盖较好。
- `AppState` 直接使用页面较少。
- 很多列表页仍使用本地 empty state 或局部错误处理。
- 数据失败、空数据、加载中、权限不足这几类状态没有完全收敛到同一套视觉和交互规则。

这会导致用户在不同模块中看到类似问题时，系统反馈方式不一致。

## 6. 主要业务流程体验盘点

### 6.1 已覆盖的核心流程类型

- 登录后进入仪表盘。
- 左侧模块导航与移动端菜单。
- 工作台快捷入口与待办概览。
- Apple ID 账号列表、筛选、创建、导入、敏感字段查看入口。
- Apple ID 订单录入、客户选择、服务选择、自动匹配结果。
- 兑换码订单列表、匹配、发货、导入、导出。
- 兑换码库存与批量导入相关入口。
- 来源平台、业务选项、通知选项等基础设置。
- 安全中心、登录日志、会话、MFA、IP 白名单、敏感操作审批。
- 数据导入、数据导出、审计日志、附件与回收站。
- 403、404、维护模式等系统状态页。

### 6.2 状态覆盖情况

| 状态类型       | 当前情况                              | 风险                 |
| -------------- | ------------------------------------- | -------------------- |
| 加载中         | 多数页面有 `v-loading` 或卡片 loading | 基本可用             |
| 空状态         | 多数列表有空状态                      | 失败时容易误显示为空 |
| 接口错误       | 多数页面依赖 toast 提示               | 高风险               |
| 权限不足       | 有 403 页面和部分权限按钮控制         | 需要角色矩阵验证     |
| 未登录/过期    | 有登录页和 auth guard                 | 本轮未完整验证       |
| 404            | 页面清晰                              | 可用                 |
| 维护模式       | 有页面入口                            | 本轮未深测           |
| 网络超时/离线  | 未看到统一状态                        | 中风险               |
| 组件运行时错误 | 未看到全局错误边界                    | 中风险               |

## 7. 主要发现

### AUDIT-001：接口失败时会伪装成“暂无数据”

- 严重级别：高
- 分类：错误状态 / 数据可信度 / 后台效率
- 影响页面：`/apple/accounts`、`/codes/orders`、`/system/security`、`/system/source-platforms/platforms`、移动端 `/codes/orders`
- 证据截图：`02-apple-accounts-desktop-api-error.png`、`04-code-orders-desktop.png`、`05-security-center-desktop.png`、`06-source-options-desktop.png`、`10-code-orders-mobile.png`

现象：

接口返回 502 时，页面顶部出现短暂 toast，但列表区域仍显示“暂无 Apple ID 账号”“暂无兑换码订单”“暂无数据”等空状态。

为什么重要：

后台用户会误以为数据真的为空，从而误判业务状态、库存状态、订单状态或安全事件状态。对代充和自动发货业务来说，这属于高风险体验问题。

建议：

- 将请求失败和真实空数据严格分开。
- 接口失败时列表区域展示持久错误状态，例如“数据加载失败，当前结果不可用”。
- 保留重试按钮。
- 如果存在旧数据，应标记“上次更新时间”和“刷新失败”，不要直接清空为 empty。

是否可安全自动修复：

可以。只要限定在前端状态展示层，不改接口、不改业务逻辑、不改数据库。

### AUDIT-002：错误提示主要依赖 toast，且会遮挡关键区域

- 严重级别：高
- 分类：交互反馈 / 可访问性 / 移动端体验
- 影响页面：多个列表页、设置页和移动端页面
- 证据截图：`02`、`03`、`04`、`05`、`06`、`10`

现象：

错误 toast 在桌面端和移动端都出现在页面上方，并覆盖标题、操作按钮或表单区域。toast 消失后，页面缺少持续可见的失败原因。

建议：

- 页面级失败使用内联 alert 或 `AppState type="error"`。
- toast 只作为补充提示，不作为唯一错误反馈。
- 移动端错误条应避免遮挡主要操作。
- 错误区域需要明确关联到受影响的数据模块。

是否可安全自动修复：

可以。优先从共享请求加载组件或高频列表页开始。

### AUDIT-003：共享状态组件没有被充分统一使用

- 严重级别：中
- 分类：设计系统一致性 / 可维护性
- 影响范围：多数组件和列表页

现象：

项目已有 `AppState` 和 `AppCard` 状态能力，但多处页面仍使用本地 empty state 或本地 class，导致 loading、empty、error、forbidden 的呈现和文案不统一。

建议：

- 定义列表页标准状态顺序：loading > error > forbidden > empty > content。
- 优先改高风险页面：Apple ID 账号、兑换码订单、安全中心、来源平台。
- 后续逐步迁移到共享 `AppState`。

是否可安全自动修复：

可以，但建议分批做，不要一次改完整站。

### AUDIT-004：移动端列表工具栏和批量操作偏拥挤

- 严重级别：中
- 分类：响应式布局 / 操作效率
- 影响页面：兑换码订单、Apple ID 账号、数据记录类页面
- 证据截图：`08-dashboard-mobile.png`、`09-dashboard-mobile-menu-open.png`、`10-code-orders-mobile.png`

现象：

移动端已经有卡片化列表和菜单抽屉，基础可用。但部分页面的搜索、筛选、批量操作、刷新、导入导出在窄屏中堆叠明显，首屏被工具区占用较多。

建议：

- 移动端保留 1 个主操作按钮。
- 次级操作收进更多菜单。
- 搜索和筛选使用折叠区域或抽屉。
- 批量操作只有选中数据后再展示。

是否可安全自动修复：

可以。适合先从 `TableToolbar` 和高频列表页做组件级优化。

### AUDIT-005：未看到明确的前端运行时错误边界

- 严重级别：中
- 分类：系统稳定性 / 异常恢复
- 影响范围：全站

现象：

当前有 403、404、维护模式、加载进度条，但未看到明确的全局 route error 或 Vue runtime error fallback。

建议：

- 增加 router chunk load failure 处理。
- 增加全局错误 fallback 页面或顶部错误条。
- 记录错误但避免输出敏感信息。
- 保留“刷新页面”“返回首页”动作。

是否可安全自动修复：

可以。仅做前端错误边界和展示，不涉及业务数据。

### AUDIT-006：部分帮助/图标控件需要进一步键盘可访问性确认

- 严重级别：中
- 分类：可访问性 / 表单辅助
- 影响范围：帮助说明、图标按钮、敏感字段操作

现象：

项目已有 aria、focus ring、skip link 和部分 role 标记，但帮助提示和图标类操作需要逐个确认键盘 Enter/Space、焦点顺序、可读名称。

建议：

- 非表单按钮统一使用真实 `button`。
- 图标按钮必须有稳定 aria-label。
- 帮助提示支持键盘触发。
- 敏感字段查看、复制、导出按钮必须能被屏幕阅读器理解。

是否可安全自动修复：

可以。优先处理共享组件。

### AUDIT-007：权限不足状态需要角色矩阵验证

- 严重级别：中
- 分类：安全体验 / 权限反馈
- 影响范围：敏感字段、用户角色、审批、导出、复制、发货、补发

现象：

代码中有权限控制和 403 页面，但本轮只有单一登录态，无法确认不同角色下按钮隐藏、API 阻止、错误反馈是否一致。

建议：

- 准备至少 3 类测试角色：超级管理员、业务员工、只读审计员。
- 验证按钮隐藏、直接访问路由、直接调用接口三层行为。
- 敏感字段查看、复制、导出必须验证 audit log。

是否可安全自动修复：

需要先确认角色矩阵和测试账号，不能凭空修改权限策略。

### AUDIT-008：完整登录流程本轮未验证

- 严重级别：低
- 分类：验证缺口

现象：

浏览器中已有登录态，打开根路径会进入后台。当前审计未覆盖登录页输入、错误密码、锁定、过期、退出后重登等路径。

建议：

- 用干净浏览器上下文或测试账号单独验证登录流程。
- 检查登录错误文案是否泄露账号存在性。
- 检查登录失败、会话过期、MFA、重定向回原页面。

是否可安全自动修复：

不能直接修复，需要先拿到明确测试账号或允许清理当前登录态。

## 8. 建议修复顺序

### 第一批：高风险状态修复

目标：解决“接口失败显示为空”的核心问题。

建议范围：

- `apps/admin/src/components/ui/AppState.vue`
- `apps/admin/src/components/ui/AppCard.vue`
- `apps/admin/src/composables/useAuthenticatedPageLoader.ts`
- `apps/admin/src/views/apple/AppleAccountsView.vue`
- `apps/admin/src/views/codes/CodeOrdersView.vue`
- `apps/admin/src/views/system/SecurityView.vue`
- `apps/admin/src/views/common/SourcePlatformsView.vue`

验收标准：

- 502、500、超时、网络失败都显示持久错误状态。
- 真空数据仍显示空状态。
- 错误状态有重试按钮。
- 移动端不遮挡主操作。

### 第二批：移动端列表和工具栏

目标：提升手机上处理订单、库存、审批、日志的效率。

建议范围：

- `apps/admin/src/components/ui/TableToolbar.vue`
- `apps/admin/src/components/ui/PaginationBar.vue`
- 高频列表页的移动端 action 区域
- `apps/admin/src/styles/main.css`

验收标准：

- 移动端首屏可以看到页面标题、核心统计和至少一部分数据/状态。
- 次级操作进入更多菜单。
- 表格和卡片切换不造成布局跳动。

### 第三批：错误边界与可访问性

目标：减少白屏和不可操作状态。

建议范围：

- `apps/admin/src/router/index.ts`
- `apps/admin/src/main.ts`
- 共享帮助提示组件
- 图标按钮组件

验收标准：

- route chunk 加载失败有可恢复页面。
- 全局运行时错误不直接白屏。
- icon/help/sensitive actions 均有键盘可访问名称。

### 第四批：权限矩阵专项

目标：验证安全体验和后端权限边界一致。

需要先确认：

- 测试账号
- 角色矩阵
- 哪些操作需要 audit log
- 哪些操作隐藏按钮，哪些操作展示禁用态和原因

## 9. 可由 Codex 直接安全执行的修复

以下修复不需要改数据库、不需要改接口、不需要改权限策略，适合下一步直接做：

- 给高频列表页增加明确 error state。
- 将 toast-only 错误改为 toast + inline error。
- 在移动端压缩工具栏和次级操作。
- 统一部分 empty/error 文案。
- 增加 route error fallback。
- 修正共享帮助/图标按钮的 keyboard 和 aria。

## 10. 需要先确认后再做的内容

以下内容不建议直接改：

- 权限角色矩阵。
- 敏感字段查看、复制、导出的权限策略。
- audit log 写入规则。
- 登录/MFA/会话过期安全策略。
- 接口 502 的后端根因修复。
- 业务状态机和订单流转逻辑。

## 11. 建议检查命令

下一步进入修复阶段后，每批修改至少运行：

```bash
npm run typecheck --workspace @apple-business/admin
npm run lint --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
```

如果涉及全栈状态或接口返回，还应运行：

```bash
npm run check
```

如果要做页面回归，应重新采集：

- 桌面端 1280x720
- 移动端 390x844
- 接口失败状态
- 真空数据状态
- 有数据状态
- 无权限状态

## 12. 本轮结论

当前后台的整体结构、导航、页面骨架和设计系统基础已经比较完整，适合作为业务管理系统继续迭代。

最需要优先处理的问题不是视觉重做，而是状态可信度：接口失败不能显示为“暂无数据”。这个问题会直接影响订单、库存、账号、安全日志等关键业务判断，应作为第一优先级修复。

第二优先级是移动端后台操作密度和共享状态组件统一。只要分批收敛到现有组件体系，不需要大重构，也不需要换设计框架。
