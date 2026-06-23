# V3 设计还原验收清单

## 文档定位

本清单用于后续逐页检查后台管理系统是否符合 `design/reference/v3-final-reference.html` 的视觉和交互基准。

本清单只约束前端视觉、交互和响应式体验，不改变数据库、后端接口、权限逻辑、业务流程和真实数据来源。

## 固定设计参数

| 项目           | 标准      |
| -------------- | --------- |
| 侧边栏宽度     | 276px     |
| 顶部栏高度     | 72px      |
| 页面左右内边距 | 24px      |
| 模块间距       | 16px      |
| 主色           | `#2563eb` |
| 页面背景       | `#f5f7fb` |
| 正文字色       | `#172033` |
| 边框色         | `#e4eaf3` |
| 卡片圆角       | 18px      |
| 普通控件圆角   | 12px      |
| 移动端断点     | 840px     |

## 全局外壳验收

- 左侧导航保持当前业务菜单结构，不改路由、不改权限过滤。
- 左侧导航视觉必须接近 V3：深色侧边栏、清晰分组、当前页面高亮、图标可识别。
- 顶部栏高度稳定为 72px，标题、页面说明、全局搜索、通知、刷新、用户入口不挤压。
- 全局搜索浮层必须使用 V3 卡片化结构，包含搜索范围说明和关键词反馈，不出现 Element Plus 默认小白框质感。
- 通知入口必须打开 V3 抽屉，展示通知摘要和最近提醒；进入通知中心按钮必须可用。
- 内容区使用 `#f5f7fb` 背景，不使用装饰性页面渐变。
- 页面左右内边距为 24px，移动端按断点收缩。
- 路由切换应有轻量进度反馈，但不出现长时间大面积加载遮挡。
- 路由懒加载骨架屏必须轻量、响应式，并支持 `prefers-reduced-motion` 关闭动画。
- 工作区页签最多 12 个，6 个一行，两行显示，不使用横向滚动条。
- 页签关闭按钮、关闭当前、关闭其他、关闭全部都必须可用。

## 公共组件验收

- `AppCard`、`content-panel`、`MetricCard` 不允许出现彩色顶部条。
- `AppCard` 必须能承载统一 loading、empty、error 状态，状态区不得露出 Element Plus 默认视觉。
- 卡片边框应克制，阴影轻，不出现营销页式强装饰。
- `MetricCard` 数字、说明、标签在桌面和手机都不能溢出。
- `AppButton` 必须覆盖默认 Element Plus 视觉，按钮层级清晰。
- `StatusChip` 必须统一圆角、色彩、文字粗细和状态语义。
- `TableToolbar` 必须支持搜索、筛选、刷新、导出、列显示、密度、保存视图、筛选标签回显。
- `TableToolbar` 必须展示当前筛选、显示列数、密度和保存视图状态；列显示菜单必须有已显示数量和一键全部显示能力。
- `AppState` 必须统一加载、空、错误、无权限、提示和成功状态，不使用 Element Plus 默认 Empty/Alert/Result 作为最终效果。
- 页面暂未替换为 `AppState` 的 `el-empty`、`el-alert`、`el-result` 必须由全局 V3 fallback 样式兜底，不能露出 Element Plus 默认视觉。
- `AppDrawer` 和 `el-dialog` 必须有统一头部、正文、底部按钮区。
- `AppDrawer` 必须支持标题、说明、底部提示和响应式宽度；默认尺寸不得被全局 CSS 固定死。
- `AppDrawer` 的确认按钮必须来源明确：有 `@confirm` 时执行业务动作；只有自定义确认文案且无监听时作为提示型关闭按钮，不允许出现点击无反馈的死按钮。
- `el-dialog`、`el-drawer`、`el-message-box` 必须对齐 V3 遮罩、圆角、阴影、进入动效和移动端尺寸，不允许按钮区被遮挡。
- `el-message-box` 的图标、正文、输入框和按钮区必须在 390px 移动端内完整可见，按钮不允许挤成不可读宽度。
- `ElMessage` 和 `v-loading` 必须使用 V3 的 toast / loading 反馈样式，不允许出现 Element Plus 默认居中蓝色提示和硬遮罩。
- `ElMessage` 必须靠右浮出，移动端自动铺满安全宽度；`v-loading` 必须是轻量毛玻璃遮罩和小型状态卡，不允许长时间大面积硬遮挡。
- `el-table` 必须保持 V3 表头、行高、hover、边框和横向滚动兜底，固定列阴影不能遮挡正文。
- `el-select`、`el-dropdown`、`el-date-picker`、`el-popover`、`tooltip` 等浮层必须使用 V3 白底、轻边框、18px 圆角、轻阴影和移动端宽度兜底，不允许出现默认箭头或默认蓝色高亮。
- `el-input`、`el-select`、`el-date-editor`、`el-textarea`、`input-number` 的默认高度、图标颜色、placeholder、禁用态、hover 和 focus ring 必须统一，不能混用 Element Plus 默认边框或默认阴影。
- checkbox、radio、radio-button、switch 必须使用 V3 控件圆角、focus ring、状态色和可读的移动端尺寸；禁用态必须可识别但不能抢视觉。
- `el-select`、`el-dropdown`、日期快捷项、日期月份/年份面板在窄屏必须自动控制宽度和换行，选项文字不能被截断到不可读。
- `el-tabs` 必须呈现 V3 pill/segmented 视觉；移动端允许横向轻滑，但不得撑破页面或压住顶部栏、表格工具栏、抽屉内容。
- `el-pagination` 必须使用 V3 小圆角页码按钮、hover/focus/disabled 状态；移动端必须自动换行，不允许页码、每页数量、跳页输入互相遮挡。
- `el-descriptions` 桌面端保持表格式信息密度，移动端必须变成可读信息块或稳定兜底，不能要求用户横向拖动才能读完核心字段。
- `el-skeleton` 必须使用 V3 轻量骨架屏，不得出现 Element Plus 默认灰块跳动、过高占位或大面积硬遮挡。
- `el-tree` 必须使用 V3 权限树视觉：轻边框、圆角节点、hover/focus 高亮、checkbox 状态一致；移动端节点文字必须可换行或省略，不得撑破抽屉/面板。
- `el-badge` 必须和顶部栏/按钮尺寸协调，通知角标不得遮挡图标、压住顶部栏或露出默认红点位置。
- `PaginationBar` 必须显示总量、当前数据范围、首页/尾页入口，并在 390px 移动端可换行不横向溢出。
- `PaginationBar` 必须显示当前页 / 总页数；总量、范围、页码和每页数量控件在窄屏不能互相遮挡。
- 加载、空状态、错误状态、无权限状态必须用统一视觉；`el-empty`、`el-result`、`el-alert` 的 fallback 不得露出默认插画、默认蓝色、默认大圆角或不可读的移动端排版。

## 页面级验收

每个页面至少检查以下状态：

- 首屏正常状态。
- 数据加载状态。
- 空数据状态。
- 接口失败状态。
- 筛选后状态。
- 打开详情抽屉状态。
- 打开表单弹窗状态。
- 危险操作确认状态。
- 移动端 390x844 状态。

## 不合格表现

出现以下任一情况，都需要修复后再进入下一页：

- 卡片顶部出现彩色横条。
- 页面首屏出现大块无意义空白。
- 列表按钮、筛选栏或页签被挤压到不可读。
- 移动端表格文字重叠，或必须靠横向拖动才能完成核心操作。
- 弹窗超出屏幕，底部按钮不可见。
- 抽屉内容密度过高，标题和操作按钮重叠。
- Element Plus 默认蓝色边框、默认圆角、默认表格头部明显露出。
- “待接入接口”等开发提示直接出现在正式业务主视觉里。
- 路由切换超过短暂反馈仍显示大面积加载。

## 逐页验收顺序

1. 首页仪表盘。
2. 工作台页面组：续费工作台、待取消订阅、待充值续费、等待自动续费、Apple ID 操作计划、上线检查清单。
3. Apple ID 页面组：账号、详情、业务设置、订单、订单录入、开通记录、余额对账、财务对账、自动化任务、报表。
4. 兑换码页面组：库存、业务设置、发货异常、售后补发、兑换码订单、报表。
5. 客户与来源页面组：客户、客户详情、来源平台。发货模板放在兑换码页面组，附件中心放在数据与审计页面组。
6. 系统页面组：通知、安全、数据、运维、维护、审计、平台状态、用户、角色。
7. 特殊页面：403、404、系统维护模式、占位页面、风控中心、客服工单。

## 截图要求

最终交付前，每个页面组至少保留以下截图证据：

- 1440x900 桌面截图。
- 390x844 移动端截图。

截图检查时必须和 `design/reference/v3-final-reference.html` 同视口对照，不只看单张页面截图。

## 验证命令

每轮 UI 修改后至少运行：

```bash
npm run format:check
npm run lint --workspace @apple-business/admin
npm run typecheck --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
git diff --check
```

## 窗口 A 验收记录：Apple ID / 续费页面组

### 验收范围

本轮窗口 A 只检查 Apple ID 业务与续费工作台页面组，不改数据库、不改后端接口、不写入远程 Supabase 数据。

已检查页面：

- `/apple/accounts`
- `/apple/accounts/detail`
- `/apple/accounts/detail?id=missing-preview-id`
- `/apple/settings`
- `/apple/orders`
- `/apple/order-entry`
- `/apple/activations`
- `/apple/balance-reconciliation`
- `/apple/finance`
- `/apple/reports`
- `/apple/automation`
- `/workspace/renewal`
- `/workspace/renewal/cancel-subscriptions`
- `/workspace/renewal/topups`
- `/workspace/renewal/waiting-auto-renewal`
- `/workspace/action-plans`

### 当前结论

- 390x844 移动端：上述页面未发现页面级横向溢出。
- 390x844 移动端：主列表已由移动卡片列表承接，桌面表格未直接撑破页面。
- 1440x900 桌面端：上述页面未发现页面级横向溢出。
- 1440x900 桌面端：桌面表格正常显示，移动卡片列表保持隐藏。
- 1440x900 桌面端：未发现按钮文字撑破按钮容器。
- Apple ID 详情页：无账号 ID 状态、错误 ID 状态均未发现移动端横向溢出。
- Apple ID 详情页：8 个业务 Tab 均具备桌面表格、移动卡片列表和空状态兜底。

### 已补强的交互兜底

- `el-dialog` / `el-drawer` 标题加入省略和宽度兜底，避免长标题挤压关闭按钮。
- Apple ID 页面组固定像素弹窗宽度已改为 `min(..., calc(100vw - 24px))`，避免窄屏撑破。
- 抽屉内描述、证据块、敏感字段表单加入自动换行和最小宽度兜底。
- 移动端抽屉内多按钮操作区改为自适应网格，避免按钮横向挤出屏幕。
- `el-descriptions` 内容区加入换行兜底，避免长字段撑破详情抽屉。
- Apple ID 详情页加载不存在账号时，不再直接展示后端 `Internal server error`，改为可理解的业务提示。

### 弹窗实测

390x844 移动端已实测以下弹窗，均为 366px 安全宽度且无页面级横向溢出：

- Apple ID 管理：新增 Apple ID。
- Apple ID 管理：批量导入 Apple ID。
- Apple ID 业务设置：新增业务。
- Apple ID 自动化任务：创建自动化任务。

### 工作区页签实测

- 1440x900 桌面端：12 个页签按 6 列 2 行显示，无横向溢出。
- 390x844 移动端：12 个页签按 3 列 4 行显示，无横向溢出，标题不再被压到不可读宽度。
- 页签总数仍由现有逻辑限制为最多 12 个，新打开页面会保留最后 12 个。

### 详情字段实测

- `el-descriptions` 在 840px 以下已切换为块状信息组，不再依赖 560px 横向表格。
- 760px 和 390px 视口下已通过 CSSOM 检查，命中 `max-width: 840px` 的块状 descriptions 规则。
- Apple ID 订单、开通记录、续费任务、操作计划、自动化任务等详情抽屉里的核心字段会继承该兜底。

### 工具栏与筛选区补强

- 390px 移动端工具栏使用明确栅格承载搜索、状态、筛选、刷新、导出、列显示、密度和保存视图。
- 续费任务、开通记录中的自定义快捷日期控件已纳入移动端工具栏宽度规则，不再保留 360px 弹性宽度隐患。
- 工具栏直接子元素补充 `min-width: 0`，避免输入框、下拉、日期快捷组、批量操作按钮在窄屏撑破页面。
- `quick-date` 在 640px 以下铺满工具栏安全宽度，480px 以下切换为两列，不使用横向滚动条。

### 移动卡片与订单录入补强

- 订单录入表单底部操作区在 640px 以下切换为单列满宽按钮，避免“重置/提交”按钮挤压或停留在半宽状态。
- 移动卡片操作区在 480px 以下保持两列布局；只有一个操作按钮时自动跨满整行。
- Apple ID 订单、自动匹配、详情抽屉中的单操作卡片会继承该兜底，不再出现孤立半宽按钮。

### 高密度详情与报表补强

- Apple ID 详情页和 Apple ID 报表页已确认具备移动卡片列表兜底，桌面表格不会直接撑破手机视口。
- 480px 以下移动卡片的标题、说明、统计值和元信息允许自动换行，避免 Apple ID、订单号、客户/业务、关联对象等长文本被单行省略到不可读。
- 多 Tab 页面保留 V3 pill 样式，移动端 Tab 区域由内部轻量横向滚动承接，不产生页面级横向溢出。

### 详情页与订单录入首屏清理

- Apple ID 详情页已移除旧的 `metric-grid` 指标卡首屏和 `apple-core-board-grid` 双列概览，改为紧凑的 V3 概览面板。
- Apple ID 详情页继续保留当前余额、余额成本、移动平均成本、关联业务、充值、消费和待办数量，不改变真实数据来源。
- Apple ID 订单录入页已移除旧的 `apple-core-board-grid` 类名，自动匹配和订单成本预估改由 `order-entry-board-grid` 承接，并纳入 V3 响应式断点。
- 当前 Apple ID 页面组已搜索确认不再直接使用 `metric-grid`、`apple-core-board-grid` 或 `MetricCard` 作为页面首屏结构。

### 续费任务凭证上传补强

- 续费任务抽屉内的处理凭证上传控件已纳入 V3 全局控件样式，不再露出系统默认文件选择按钮质感。
- 文件上传控件补充 hover、focus-visible、disabled 状态，键盘聚焦时有明确 focus ring。
- 480px 以下文件选择按钮改为单列满宽显示，避免按钮和文件名在抽屉内横向挤压。

### 抽屉尺寸复核

- Apple ID 操作计划、自动化任务、业务设置、续费任务和余额对账里的 `AppDrawer size="..."` 已复核为公共组件尺寸参数，不是硬编码移动端宽度。
- `AppDrawer` 通过 `width: min(var(--app-drawer-size), 92vw)` 和移动端 `min(100vw, 420px)` 兜底，720px、760px、780px、860px 等桌面尺寸不会撑破手机视口。
- 本轮未修改后端接口、抽屉业务动作、确认弹窗流程和真实数据来源。

### 空状态与抽屉长字段补强

- `apple-core-empty-state` 在 840px 以下降低最小高度和内边距，避免手机和小面板里出现过大的空白区域。
- `apple-core-empty-state` 在 480px 以下进一步压缩高度，空列表、空详情、空日志仍保留操作按钮但不制造大面积留白。
- `drawer-detail-grid strong` 在移动端允许换行，Apple ID、订单号、客户名、锁定原因等长字段不再被单行省略到不可读。

### 打开态源码复核与本轮补强

- Apple ID 管理的新增、批量导入、充值、消费、余额修正、敏感字段查看等弹窗均已使用 `min(..., calc(100vw - 24px))` 宽度，移动端会继续被全局 `el-dialog` 兜底为安全宽度。
- Apple ID 订单录入的自动匹配区和订单成本预估区已由 `order-entry-board-grid` 承接，1200px 以下单列、840px 以下继续单列，不再保留旧双列硬撑页面。
- 续费任务和操作计划详情抽屉继续使用 `AppDrawer size="..."` 作为桌面建议宽度，实际渲染由公共抽屉 `min(var(--app-drawer-size), 92vw)` 和移动端 `min(100vw, 420px)` 限制。
- `apple-core-alert` 信息块已调整为“状态标签 + 内容”的 V3 栅格结构，避免长提示文字在窄屏被状态标签挤压。
- 移动端 `el-dialog__footer` 补充单按钮跨满整行兜底，关闭类弹窗不会出现孤立半宽按钮。
- 当前远程数据库没有足够续费任务/操作计划记录时，不通过“生成到期任务”或“生成操作计划”制造测试数据；详情抽屉的可视复核以源码结构和公共抽屉规则为准。

### 真实浏览器双端验收

验收视口：

- 桌面：1440x900。
- 移动：390x844。

已验收路由：

- `/apple/accounts`
- `/apple/order-entry`
- `/workspace/renewal`
- `/workspace/action-plans`

验收结果：

- 以上 4 个路由在桌面和移动视口均未发现页面级横向溢出。
- 以上 4 个路由的 `.workspace` 容器均未发现横向溢出。
- 以上 4 个路由均未发现 `metric-grid`、`apple-core-board-grid`、`el-empty`、`el-result`、`el-alert`、`el-card` 残留。
- 390x844 移动端桌面表格均隐藏，由移动卡片或移动空状态承接。
- 390x844 移动端工作区页签宽度为 366px，未出现横向滚动或遮挡。
- 桌面端表格内部存在 Element Plus 表格自己的横向滚动内容宽度，属于表格容器内部滚动，不构成页面级横向溢出。
- 以上 4 个路由逐页打开后，浏览器控制台 `error` 数量均为 0。

### 未写入数据的原因

当前 `.env` 与 `apps/api/.env` 的 `DATABASE_URL` 指向远程 Supabase。设计验收阶段不得为了制造测试数据写入远程数据库，因此本轮未运行会创建或修改业务数据的验收脚本。

### 已运行检查

```bash
git diff --check
npm run typecheck --workspace @apple-business/admin
npm run lint --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
```

结果：全部通过。`build` 阶段仅出现第三方 `@vueuse/core` PURE 注释警告，不影响打包。

## 窗口 B 验收记录：系统 / 公共运维页面组

### 验收范围

本轮窗口 B 只检查系统与公共资料页面的前端视觉一致性，不改数据库、不改后端接口、不改业务流程、不部署。

已检查页面文件：

- `apps/admin/src/views/system/NotificationsView.vue`
- `apps/admin/src/views/system/PlatformStatusView.vue`
- `apps/admin/src/views/system/OpsMonitorView.vue`
- `apps/admin/src/views/system/RolesView.vue`
- `apps/admin/src/views/system/UsersView.vue`
- `apps/admin/src/views/system/SystemStateView.vue`
- `apps/admin/src/views/modules/ModulePlaceholderView.vue`
- `apps/admin/src/views/common/CustomerDetailView.vue`

### 已修复内容

- 通知中心首屏旧 `metric-grid + MetricCard` 指标块已替换为 `content-panel + detail-note-grid`，保留启用规则、未读通知、失败通知、Telegram 配置统计。
- 平台接口状态首屏旧指标块已替换为 V3 克制信息块，保留平台数量、正常、异常、未配置统计。
- 运维监控首屏旧 5 列指标块已替换为 V3 信息块，保留 API、数据库、Redis、队列、最近错误状态。
- 权限管理首屏旧指标块已替换为 V3 信息块，保留角色数量、权限模块、已选权限、覆盖用户统计。
- 用户管理首屏旧指标块已替换为 V3 信息块，保留用户数量、启用账号、已分配角色、有登录记录统计。
- 系统状态页和通用模块占位页旧指标块已替换为 V3 信息块，保留原有状态、阶段和建议入口。
- 客户详情页旧指标块已替换为 V3 信息块，保留 Apple ID 订单、开通记录、续费任务、客户状态统计。
- 本轮没有新增重复 CSS；全部复用既有 `content-panel`、`detail-note-grid`、`detail-note-item`、`StatusChip` 和 `AppButton`。

### 扫描结论

- 窗口 B 负责的系统、公共、模块占位页面中，未再发现 `el-card`、`el-empty`、`el-result`、`el-alert`、`el-tag`、`el-button`、`el-pagination` 默认视觉入口。
- 窗口 B 负责的系统、公共、模块占位页面中，已移除旧首屏 `metric-grid + MetricCard` 残留。
- `/dashboard` 首页仪表盘仍保留 `metric-grid + MetricCard`，属于 Phase 1 首页仪表盘范围，不在本轮窗口 B 修改范围内。
- Apple ID、续费、订单录入和 Workspace 页面不属于窗口 B，已留给窗口 A 继续处理。

### 未修复原因

- `DashboardView.vue` 不在窗口 B 范围内，避免和首页仪表盘 Phase 1 以及主线程改动冲突。
- `DataCenterView.vue`、`SecurityView.vue`、`MaintenanceView.vue`、`AuditLogsView.vue` 当前已经使用系统紧凑列表结构，且文件体量较大，本轮只做扫描，不做高风险大改。
- 本轮未做真实浏览器双端截图；窗口 B 先完成静态结构清理和格式检查，后续可按页面组统一做 1440x900 与 390x844 浏览器验收。

### 已运行检查

```bash
npm exec prettier -- --check apps/admin/src/views/system/NotificationsView.vue apps/admin/src/views/system/PlatformStatusView.vue apps/admin/src/views/system/RolesView.vue apps/admin/src/views/system/UsersView.vue apps/admin/src/views/system/OpsMonitorView.vue apps/admin/src/views/system/SystemStateView.vue apps/admin/src/views/modules/ModulePlaceholderView.vue apps/admin/src/views/common/CustomerDetailView.vue
git diff --check
npm run typecheck --workspace @apple-business/admin
npm run lint --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
```

结果：全部通过。`build` 阶段仅出现第三方 `@vueuse/core` PURE 注释警告，不影响打包。
