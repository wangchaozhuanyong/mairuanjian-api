# V3 双窗口并行开发规则

## 目的

本文件用于把 V3 设计还原工作拆成两个互不冲突的窗口并行推进。

两个窗口都必须以 `design/reference/v3-final-reference.html` 为唯一视觉和交互基准。除非用户明确要求，任何窗口都不得修改数据库、后端接口、业务流程、Prisma schema、迁移文件或生产配置。

## 窗口 A：全局底座窗口

### 负责范围

窗口 A 只负责全局外壳、全局样式、公共组件和路由体验。

允许修改：

- `apps/admin/src/styles/main.css`
- `apps/admin/src/layouts/AdminLayout.vue`
- `apps/admin/src/App.vue`
- `apps/admin/src/router/index.ts`
- `apps/admin/src/components/ui/*`
- `apps/admin/src/composables/*`
- `docs/V3_DESIGN_QA.md`
- `docs/V3_PARALLEL_WORKFLOW.md`

### 当前优先任务

1. 全局 V3 tokens 和 Element Plus 覆盖收口。
2. 后台外壳、顶部栏、侧边栏和页签体验收口。
3. 路由切换反馈、骨架屏、KeepAlive、预加载体验收口。
4. 全局加载、空状态、错误状态、弹窗、抽屉、消息提示、表格样式收口。
5. 首页仪表盘视觉还原。

### 禁止事项

- 不修改具体业务页面的数据结构和业务逻辑。
- 不进入 Apple ID、兑换码、系统页面逐页重构，除非只是为了验证公共组件效果。
- 不修改后端、数据库、接口、权限数据或部署配置。

## 窗口 B：页面组窗口

### 负责范围

窗口 B 只负责页面级 V3 还原，优先修改 `views` 下的业务页面。

允许修改：

- `apps/admin/src/views/apple/*`
- `apps/admin/src/views/codes/*`
- `apps/admin/src/views/common/*`
- `apps/admin/src/views/system/*`
- `apps/admin/src/views/modules/*`

### 当前优先任务

1. 工作台页面组：续费工作台、待取消订阅、待充值续费、等待自动续费、Apple ID 操作计划、上线检查清单。
2. Apple ID 页面组：账号、详情、业务设置、订单、订单录入、开通记录、余额对账、财务对账、自动化任务、报表。
3. 兑换码页面组：库存、业务设置、发货异常、售后补发、兑换码订单、报表。
4. 系统页面组：通知、安全、数据、运维、维护、审计、平台状态、用户、角色。
5. 特殊入口：403、404、系统维护模式、风控中心、客服工单。

### 禁止事项

窗口 B 不得修改：

- `apps/admin/src/styles/main.css`
- `apps/admin/src/layouts/AdminLayout.vue`
- `apps/admin/src/App.vue`
- `apps/admin/src/router/index.ts`
- `apps/admin/src/config/modules.ts`
- `apps/admin/src/components/ui/*`
- 后端、数据库、接口、迁移、部署配置

如果页面需要新的公共组件或全局 CSS，窗口 B 只能记录需求，由窗口 A 处理。

## 冲突处理规则

1. 两个窗口不能同时修改同一个文件。
2. 公共样式和公共组件只能窗口 A 改。
3. 页面文件只能窗口 B 改，除非窗口 A 为验证全局组件做极小范围检查。
4. 任一窗口开始前先运行 `git status --short`，确认没有误碰对方文件。
5. 任一窗口完成后必须说明改动文件、检查命令和遗留风险。
6. 最终合并、提交、推送、部署只能由一个窗口执行。

## 验证命令

窗口 A 每轮修改后至少运行：

```bash
npm run format:check
npm run typecheck --workspace @apple-business/admin
npm run lint --workspace @apple-business/admin
npm run build --workspace @apple-business/admin
git diff --check
```

窗口 B 每完成一个页面组后至少运行：

```bash
npm run format:check
npm run typecheck --workspace @apple-business/admin
npm run lint --workspace @apple-business/admin
git diff --check
```

## 窗口 B 开工提示词

```text
你是窗口 B，只做页面级 V3 还原。

请先阅读：
1. AGENTS.md
2. docs/V3_DESIGN_QA.md
3. docs/V3_PARALLEL_WORKFLOW.md
4. design/reference/v3-final-reference.html

禁止修改：
- apps/admin/src/styles/main.css
- apps/admin/src/layouts/AdminLayout.vue
- apps/admin/src/App.vue
- apps/admin/src/router/index.ts
- apps/admin/src/config/modules.ts
- apps/admin/src/components/ui/*
- 后端、数据库、接口、迁移、部署配置

只允许修改：
- apps/admin/src/views/apple/*
- apps/admin/src/views/codes/*
- apps/admin/src/views/common/*
- apps/admin/src/views/system/*
- apps/admin/src/views/modules/*

任务：
从工作台页面组开始，按 V3 设计基准修复页面布局、空白、表格、移动端卡片、筛选栏、详情抽屉和状态展示。不要改业务流程，不要改接口，不要新建全局 CSS。每完成一个页面组运行 typecheck、lint 和 diff check。
```
