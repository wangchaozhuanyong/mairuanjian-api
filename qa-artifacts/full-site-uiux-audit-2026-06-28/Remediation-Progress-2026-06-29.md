# UI/UX 审计修复进展

- 日期：2026-06-29
- 项目路径：`/Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件`
- 分支：`codex/replan-admin-ui-framework`
- 本轮性质：前端 UI 状态、移动端工具栏、错误边界与可访问性 guardrail 修复

## 已完成

### AUDIT-001 / AUDIT-002：接口失败伪装为空、toast-only 错误

已新增 `ListRequestError` 和 `getLoadErrorMessage`，并把主列表/主数据加载失败改为持久错误状态 + 重试入口。当前静态扫描结果为 `TOTAL 0`，表示没有发现“列表/移动列表加载失败后只弹 toast、没有持久错误态”的页面。

### AUDIT-003：共享状态组件使用不统一

已通过 `ListRequestError` 统一列表请求错误呈现，并新增 `npm run check:admin-ui`，防止后续页面回退到只弹 toast。

### AUDIT-004：移动端列表工具栏拥挤

已调整 `TableToolbar`：

- 桌面端保留原操作区。
- 移动端隐藏桌面次级操作。
- 移动端新增“筛选”按钮。
- 复杂筛选和日期快捷筛选默认收起，展开后显示。
- “更多”菜单继续承载刷新、导出、保存视图、管理视图等次级操作。

已用 Playwright 在 390px 视口打开 `/codes/orders` 并使用只读 mock API 验证：

- `.table-toolbar__filter-toggle` 可见。
- `.table-toolbar__filters` 默认 `display: none`。
- 点击“筛选”后 `.table-toolbar__filters.is-open` 为 `display: grid`。
- `.table-toolbar__desktop-ops` 在移动端隐藏。
- `.table-toolbar__mobile-more` 可见。
- 展开前后页面横向溢出均为 `0`。

截图证据：`qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/11-code-orders-mobile-toolbar-390.png`

### 响应式 QA 后续项

已继续修复 `qa-artifacts/responsive-layout-2026-06-28/Responsive-Layout-QA-Report.md` 中的安全自动修复项：

- 1024px action-heavy 顶栏：在 `PageActionsPortal` 有动作且视口为 841-1100px 时隐藏全局搜索，避免搜索框挤成空白小控件。
- 375px 用户弹窗：增加移动端 dialog body 高度约束、底部 padding 和 footer safe-area 间距，保证最后一项和按钮区不互相压住。
- 移动端横向 tabs：给 Element Plus tabs 和来源平台自定义导航增加边缘渐隐提示，让横向可滑动更明显。

已用 Playwright 只读 mock API 验证：

- 1024px `/apple/order-entry`：`.global-search` 在 action-heavy 顶栏隐藏，页面横向溢出为 `0`。
- 375px `/system/users`：新增用户 dialog footer 为 grid，body 可独立滚动，页面横向溢出为 `0`。
- 375px `/system/source-platforms/platforms`：自定义 nav 可横向滚动，右侧渐隐提示存在，页面横向溢出为 `0`。
- 375px `/system/notifications`：tabs 可横向滚动，右侧渐隐提示存在，页面横向溢出为 `0`。

截图证据：

- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/12-order-entry-topbar-1024.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/13-users-dialog-mobile-375.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/14-source-options-nav-mobile-375.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/15-notifications-tabs-mobile-375.png`

### AUDIT-005：运行时错误边界

当前代码已具备：

- Vue `app.config.errorHandler`
- `window.error`
- `unhandledrejection`
- route chunk load failure fallback
- 页面级“刷新页面 / 回到首页 / 继续查看”恢复动作

`npm run check:admin-ui` 已把这些入口纳入 guardrail。

### AUDIT-006：帮助/图标控件键盘可访问性

当前代码已具备：

- `FeatureHelp` 使用真实 `button`
- 支持 focus、click、Enter、Space
- `AppButton` 对 `iconOnly` 按钮补齐 `aria-label` / `title`

`npm run check:admin-ui` 已纳入 guardrail。

### AUDIT-007：权限矩阵基础 guardrail

已把以下前端权限链路纳入 `npm run check:admin-ui`：

- 路由 meta 使用 `getModulePermission(module)`。
- 路由 meta 写入 `adminOnly`。
- 未登录业务页跳转登录并保留 redirect。
- 路由守卫命中缺权限时进入 `/403`。
- 管理区侧栏按角色隐藏。
- 菜单项按权限隐藏。
- workspace tab 重新校验 route permission，避免保留已失权页面。
- `admin` 角色拥有前端最高权限，数组权限使用 every。

### AUDIT-008：登录 / MFA / 会话过期基础 guardrail

已把以下登录链路纳入 `npm run check:admin-ui`：

- 登录页保留账号、密码、MFA / 恢复码字段。
- 登录错误使用页面内 `role="alert"` 持久呈现。
- redirect 只接受站内路径，拒绝 `//` 和 `/login`。
- MFA required / invalid 后端消息保持中文映射。
- 401 会触发会话过期事件、清理本地 session、跳转登录并保留 redirect。
- 会话过期会清理导航 badge、workspace tabs 和 smart query cache。

已新增 `npm run probe:admin-auth`，使用 Playwright + 只读 mock API 验证前端认证与权限体验：

- 未登录访问 `/codes/orders` 会跳转 `/login?redirect=/codes/orders`。
- 后端返回 `MFA code is required` 时，登录页出现持久 `role="alert"` 中文错误。
- `/login?redirect=//evil.example` 登录后留在本站并回到 `/dashboard`，未发生外站跳转。
- 业务员工角色可进入 `/codes/orders`，看不到“手工导入订单”按钮，直接访问 `/system/users` 会进入 `/403`。
- 只读审计员角色可进入 `/system/audit-logs`，直接访问 `/system/users` 会进入 `/403`。
- 已登录会话遇到 401 时清理状态，并跳转 `/login?redirect=/dashboard`。

截图证据：

- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/16-auth-guest-redirect.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/17-auth-login-mfa-error.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/18-auth-login-unsafe-redirect.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/19-role-operation-403.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/20-role-auditor-audit-log.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/21-auth-session-expired-redirect.png`

### AUDIT-007：权限矩阵真实后端补充验收

已新增 `npm run probe:admin-real-auth`，使用当前项目本地生产 API `http://127.0.0.1:18081/api` 和临时 `uiux_probe_*` 账号验证真实后端权限边界。

探针行为：

- 创建临时超级管理员、MFA 管理员、业务员工、只读审计员。
- 仅在 `operation` / `auditor` 没有既有用户时，为探针临时补充最小查看权限。
- 登录后直接调用真实 API，验证允许接口返回 200、禁止接口返回 403。
- 结束后删除临时用户、登录记录、会话、MFA 设置和本次创建的临时角色权限。

验收结果：

- 超级管理员进入 `/system/users`，真实 `/users` 与 `/roles` 返回 200。
- 业务员工进入 `/codes/orders`，真实 `/codes/orders` 返回 200，真实 `/users` 返回 403，“手工导入订单”按钮不可见，直接访问 `/system/users` 进入 `/403`。
- 只读审计员进入 `/system/audit-logs`，真实 `/audit-logs` 返回 200，真实 `/users` 返回 403，直接访问 `/system/users` 进入 `/403`。
- 清理后 `uiux_probe_*` 用户数为 0，探针会话数为 0，`mfa_user_*` 探针设置为 0，`operation` / `auditor` 临时用户和临时角色权限为 0。

截图证据：

- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/23-real-operation-code-orders.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/24-real-auditor-audit-logs.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/25-real-auditor-users-403.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/27-real-admin-users.png`

### AUDIT-008：真实登录 / MFA / 会话过期补充验收

`npm run probe:admin-real-auth` 已补充真实本地后端登录链路：

- 错误密码返回 401，登录页用页面内 `role="alert"` 持久展示中文错误。
- 已启用 MFA 的临时管理员不输入验证码时返回 401，登录页展示“需要输入动态验证码或恢复码”。
- 使用真实 TOTP 动态验证码登录成功后进入 `/dashboard`，本地保存 token。
- 已登录会话遇到无效 token 的 401 后清理本地 token，并跳转 `/login?redirect=/dashboard`。

截图证据：

- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/22-real-login-invalid-password.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/28-real-mfa-required.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/29-real-mfa-totp-login.png`
- `qa-artifacts/full-site-uiux-audit-2026-06-28/screenshots/26-real-session-expired-redirect.png`

说明：该补充验收覆盖本机 local prod stack 和临时账号，不声明已经覆盖线上生产账号、真实 owner 账号或真实外部 SSO/设备信任环境。

## 本轮验证命令

```bash
npm run lint
npm run check:admin-ui
npm run check:admin-refresh
npm run probe:admin-auth
npm run probe:admin-real-auth
npm run typecheck --workspace @apple-business/admin
npm run test --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
Playwright 390px /codes/orders toolbar probe
Playwright responsive follow-up probe: 1024px /apple/order-entry, 375px /system/users, 375px /system/source-platforms/platforms, 375px /system/notifications
```

`npm run build --workspace @apple-business/admin` 通过，但仍有既有构建警告：

- `.env` 中 `NODE_ENV=production` 不被 Vite 推荐。
- `@vueuse/core` 的 PURE annotation 被 Rolldown 忽略。
- Element Plus 部分动态导入被静态导入抵消。

这些警告不是本轮新增失败。
