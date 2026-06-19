# Apple ID 代充业务管理系统 + 兑换码自动发货系统

## 项目说明

本项目是一个后台管理系统，包含两个独立业务区：

1. Apple ID 代充业务管理系统
2. 兑换码自动发货系统

两个业务区可以共用客户、来源平台、权限、日志等公共模块，但业务数据、订单逻辑、成本逻辑、报表逻辑必须分开。

## 当前状态

当前已完成 Phase 0、Phase 0.5、Phase 1，以及主要业务模块的第一版实现：

- npm workspaces monorepo
- NestJS API 基础启动入口
- Vue 3 + Vite + Element Plus Admin 基础入口
- Prisma schema、迁移和 seed 基础结构
- PostgreSQL、Redis、MinIO 的 Docker Compose
- 共享类型包 `packages/shared`
- Git remote：`https://github.com/wangchaozhuanyong/mairuanjian-api.git`
- ESLint / Prettier 工程质量工具
- 后端环境变量校验、统一响应、统一异常处理和 PrismaService
- Phase 1 身份权限底座：users / roles / permissions / audit_logs schema、JWT auth、RBAC guard、默认角色权限 seed
- 后台登录页、基础布局、用户管理、角色权限、操作日志查询、附件上传、敏感操作日志拦截器
- Phase 2 公共模块：客户、来源平台、消息模板、附件管理；客户详情页聚合订单/开通/任务，客户完整手机号按权限和原因查看并写日志，附件支持业务归属字段、受控下载和下载审计
- Phase 3/4 Apple ID 核心、充值/消费/余额修正、订单录入、自动匹配、锁定规则、开通记录和利润报表
- Phase 3 Apple ID 列表查询：关键字、状态、地区、币种、锁定筛选，分页和后端排序
- Phase 3 Apple ID 敏感字段查看：完整 Apple ID、密码、密保、手机号、备用邮箱按权限和原因查看，并写入审计和敏感访问日志
- Phase 3 Apple ID 批量导入：文本批量导入、逐行错误结果、重复检测、敏感字段加密和审计记录
- Phase 5 Apple ID 续费任务中心、待取消订阅、待充值续费、等待自动续费、操作计划和任务凭证附件
- Phase 6 兑换码业务设置、批量导入、库存、半自动发货、售后补发和利润报表
- Phase 7 淘宝/闲鱼平台适配层、占位同步/发货接口、失败转人工和平台利润报表入口
- Phase 8 Apple ID 自动化任务中心、任务日志、截图凭证、失败转人工和结果回写
- Phase 9 通知中心基础能力：通知规则、模板、日志、站内通知、Telegram 配置/测试发送、默认通知事件 seed 和部分业务事件自动触发
- Phase 10 安全中心：登录日志、在线会话、密码策略、MFA 设置和真实绑定、恢复码、IP 白名单、敏感字段访问日志、敏感字段访问审批、敏感操作查询、异常登录和连续登录失败通知
- Phase 13 网站维护：系统公告、维护模式、功能开关、版本信息、更新日志、菜单配置、主题配置和维护系统参数
- Phase 14 审计日志中心和平台接口状态：分类审计查询、平台状态总览、测试连接、重新授权占位入口和平台接口统计增强
- Phase 15 通用表格和查询能力：个人保存视图、日期快捷筛选、列配置、密度切换、批量操作、筛选标签；用户管理列表、权限管理角色列表、审计日志中心操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志和平台接口日志、通知中心规则/消息模板/通知日志、安全中心登录日志、在线会话、IP 白名单、敏感审批、敏感查看日志、平台接口状态页、网站维护系统公告、功能开关、版本信息、更新日志和系统参数、数据中心备份/恢复/导入/导出任务、回收站、数据清理、重复合并、数据字典和系统参数、客户管理列表、来源平台列表、消息模板列表、附件管理列表、Apple ID 管理列表、Apple ID 余额对账列表、Apple ID 财务对账/报表、Apple ID 业务设置列表、Apple ID 订单列表、Apple ID 开通记录列表、Apple ID 续费任务列表、Apple ID 操作计划列表、Apple ID 自动化任务列表、兑换码业务设置列表、兑换码订单列表、兑换码库存列表、兑换码报表、淘宝/闲鱼平台订单列表、售后补发列表已接入真实业务范式
- Phase 17 平台接口与自动化增强：平台轮询任务执行入口、默认关闭的后台轮询 Worker、平台接口日志统计增强、平台授权配置加密托管、OAuth 发起/回调骨架
- 本地环境初始化脚本 `npm run setup:env`
- 本地环境自检脚本 `npm run doctor`
- 上线状态速览脚本 `npm run launch:status`
- 手工门禁只读核验脚本 `npm run launch:gates`
- 生产运行基础策略：数据库备份保留、Docker 日志轮转和磁盘告警事件
- GitHub Actions 质量门禁：format、lint、typecheck、test、build、Prisma validate、生产 Compose 示例校验、high 级别依赖审计、Git 提交前安全检查、API/Admin 生产 Docker 镜像构建

尚未完成的重点：首个 Git commit/push 授权、Telegram 真实测试发送、生产环境变量确认、更多细分业务列表体验增强、淘宝/闲鱼真实开放平台 token exchange/签名/发货/退款接口、Apple ID 真实自动化 Worker 和预发布演练。

## 推荐技术栈

- 后端：NestJS + TypeScript
- ORM：Prisma
- 数据库：PostgreSQL
- 队列：Redis + BullMQ
- 前端：Vue 3 + Vite + TypeScript + Element Plus
- 包管理器：npm workspaces
- 部署：Docker Compose

## 目录说明

- `AGENTS.md`：Codex/开发规则
- `docs/PRD.md`：完整产品需求
- `docs/ARCHITECTURE.md`：技术架构
- `docs/DATABASE.md`：数据库设计
- `docs/API.md`：API 规范
- `docs/TASKS.md`：开发任务拆分
- `docs/PERMISSIONS.md`：权限设计
- `docs/TEST_CASES.md`：测试用例
- `docs/LAUNCH_STRATEGY.md`：第一版上线策略
- `docs/DEVELOPMENT.md`：本地开发准备和环境自检
- `docs/DEPLOYMENT.md`：生产部署、备份、烟测和上线流程
- `docs/STAGING_DRILL.md`：预发布环境上线演练记录
- `docs/ROADMAP_TO_LAUNCH.md`：从当前开发状态到正式上线的执行路线图和缺口清单
- `docs/FIRST_RELEASE_HANDOFF.md`：首版发布当天交接清单
- `docs/INITIAL_COMMIT_PLAN.md`：首次 Git 提交计划
- `docs/TELEGRAM_RELEASE_GATE.md`：Telegram 上线门禁操作手册
- `docs/PRODUCTION_ENV_RELEASE_GATE.md`：生产环境变量上线门禁操作手册
- `docs/OPEN_QUESTIONS.md`：业务开发前待确认事项
- `apps/api`：NestJS 后端
- `apps/admin`：Vue 管理后台
- `packages/shared`：前后端共享类型

## 本地开发

安装依赖：

```bash
nvm use
npm install
```

初始化本地环境变量：

```bash
npm run setup:env
```

该命令会：

- 在项目根目录创建 `.env`
- 生成本地开发用随机密钥
- 创建 `apps/api/.env` 和 `apps/admin/.env` 软链接，指向根目录 `.env`

启动基础设施：

```bash
docker compose up -d
```

本项目默认把 Docker PostgreSQL 容器端口 `5432` 映射到宿主机 `55432`，`.env.example` 中的 `DATABASE_URL` 也使用 `localhost:55432`。这样可以避开本机已有 PostgreSQL 占用 `localhost:5432` 的情况。

如果本机提示 `docker: command not found`，请先安装 Docker Desktop，或确认改用外部 PostgreSQL、Redis、MinIO。

开工前自检：

```bash
npm run doctor
```

`doctor` 会检查 Node.js、npm、`.env`、workspace 环境变量软链接、Docker、Docker Compose、Docker daemon 和 Prisma schema。Docker 未安装时该命令会失败，这是正常的环境阻塞提示。

生成 Prisma Client：

```bash
npm run prisma:generate
```

应用数据库迁移：

```bash
npm run prisma:migrate:deploy
```

初始化默认角色、权限和可选管理员账号：

```bash
npm run prisma:seed
```

如果需要创建默认管理员，请先在 `.env` 中配置：

```text
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=请改成强密码
SEED_ADMIN_DISPLAY_NAME=管理员
```

启动后端：

```bash
npm run dev:api
```

后端健康检查：

```bash
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
```

启动前端：

```bash
npm run dev:admin
```

前端默认地址：

```text
http://localhost:5374
```

## 生产部署

生产部署说明见：

```text
docs/DEPLOYMENT.md
```

第一版生产部署底座已包含：

- `docker-compose.prod.yml`
- API/Admin 生产 Dockerfile
- Admin Nginx SPA + `/api` 反代配置
- HTTPS 外层 Nginx 示例
- `.env.production.example`
- 生产 `.env.production` 初始化脚本
- PostgreSQL 备份和恢复脚本
- PostgreSQL 临时库恢复演练脚本
- 上线烟测脚本

配置校验：

```bash
npm run prod:config:example
```

生产启动前生成并填写：

```bash
npm run prod:env:init
npm run prod:env:check
```

## 常用检查

```bash
npm run check
```

`check` 会依次执行 format、lint、typecheck、test、build 和 Prisma schema validate。

也可以单独执行：

```bash
npm run launch:status
npm run prisma:validate
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test
npm run audit:high
npm run prod:env:check
npm run prod:env:review
npm run prod:env:set-mode -- --dry-run --mode=semi_auto
npm run prod:env:set-domain -- --dry-run --app-url=https://your-domain.com
npm run acceptance:business
npm run acceptance:security
npm run backup:postgres
npm run restore:verify -- backups/postgres/your-file.dump
npm run acceptance:launch
npm run git:readiness
npm run git:readiness:verbose
npm run launch:gates
npm run launch:checklist -- --list
npm run release:review
npm run release:ready
npm run release:blockers
```

`launch:status` 是只读速览命令，用来查看 Phase 16/17/18 未完成项、第一版上线策略、生产环境变量校验状态和 Git 状态，不会修改数据库、发送通知或启动服务。

`launch:gates` 是只读手工门禁核验命令，用来同时检查 `.env.production`、Telegram 真实测试状态和上线检查清单中的手工项；它不会发送 Telegram，也不会输出明文 token。预发布或生产等效验收需要失败即退出时运行 `npm run launch:gates:strict`。

`launch:checklist` 用来记录上线检查清单手工项的状态和证据，例如 `npm run launch:checklist -- --id=prod_env --status=passed --evidence="npm run prod:env:check passed; APP_PUBLIC_URL=https://your-domain.com"`。该命令只允许更新 `telegram_test`、`prod_env`、`git_baseline` 三个手工门禁项，会拒绝把常见密钥或 Telegram Bot Token 写进证据，并写入审计日志。先加 `--dry-run` 可以只预览不写库；这三个首版 P0 门禁不能用 `waived` 豁免放行。写入 `passed` 前还会检查真实状态：`prod_env` 必须通过生产 env 校验，`telegram_test` 必须存在启用且测试成功的 Telegram 配置，`git_baseline` 必须已有提交且工作区干净。三个手工门禁都记录为 `passed` 后，再运行 `npm run release:ready` 和 `REQUIRE_PROD_ENV=1 REQUIRE_MANUAL_GATES=1 npm run acceptance:launch` 做最终 strict 验收。

`release:review` 是只读发布审查聚合命令，会集中输出 `launch:status`、`launch:gates`、上线检查清单手工项和 `git:readiness:verbose`。它不会写数据库、发送通知、提交或推送代码；如果手工门禁仍 blocked，就不能视为生产已就绪。

`release:ready` 是 strict 发布就绪门禁命令，也不会修改文件、数据库或 Git，但会在生产 env、Telegram、上线检查清单或 Git 安全检查未通过时返回失败退出码。正式上线前必须以它通过作为硬门禁之一。

`release:blockers` 是只读阻塞项行动清单命令，会按当前状态列出还差哪些门禁、负责人、处理动作、验证命令和证据记录命令。它不会替代 `release:ready`，只用于快速安排下一步。

`prod:env:review` 是只读生产环境变量审查命令，会展示公开域名和密钥状态摘要，但不会打印任何真实密钥。它用于配置真实域名前后复核 `.env.production`，最终仍以 `npm run prod:env:check` 和 strict 上线验收为准。

`prod:env:set-mode` 用于安全设置 `.env.production` 的 `FIRST_RELEASE_MODE`，只支持 `semi_auto` 或 `full_auto`，不会打印或改动生产密钥。上线策略不变时使用 `npm run prod:env:set-mode -- --mode=semi_auto`。

拿到真实生产域名后，可以用 `npm run prod:env:set-domain -- --app-url=https://your-domain.com` 更新 `.env.production` 的 `APP_PUBLIC_URL` 和 `CORS_ORIGIN`。先加 `--dry-run` 可以只验证不写入；脚本不会打印或改动生产密钥。

`acceptance:launch` 已包含 `launch:gates` 和 `git:readiness`。本地默认只展示手工门禁状态；设置 `REQUIRE_PROD_ENV=1` 或 `REQUIRE_MANUAL_GATES=1` 时，会改用 `launch:gates:strict`，让生产 env、Telegram 真实测试或上线检查清单手工项未完成时直接失败。如果只想单独检查提交前是否会误带 `.env`、备份、上传文件、构建产物、Telegram Bot Token 或常见密钥，可以单独运行 `npm run git:readiness`；首次提交前建议运行 `npm run git:readiness:verbose` 查看候选文件摘要。

本地 `acceptance:launch` 会把缺少真实生产域名的 `.env.production` 视为外部门禁提示，不阻断本地等效验收。预发布或生产等效验收时使用：

```bash
REQUIRE_PROD_ENV=1 npm run acceptance:launch
```

`lint` 使用 ESLint，`format:check` 使用 Prettier。

## 后续开发步骤

当前从开发到上线的执行顺序以 `docs/ROADMAP_TO_LAUNCH.md` 为准。

第一版上线策略以 `docs/LAUNCH_STRATEGY.md` 为准，当前默认为 `FIRST_RELEASE_MODE=semi_auto`，即半自动可运营优先。

旧 Phase 任务清单仍保留在 `docs/TASKS.md`，用于追溯每个模块已经完成了什么；后续不再只看 Phase 是否打勾，而要按上线路线图确认：

- 是否是真实业务能力
- 是否只是占位或第一版状态流转
- 是否已经完成端到端验收
- 是否满足上线前安全、数据、运维和部署要求

请按照 `docs/TASKS.md` 和 `docs/ROADMAP_TO_LAUNCH.md` 配合开发，不要一次性开发完整系统。

推荐顺序：

1. Phase 2：公共模块
2. Phase 3：Apple ID 核心模块
3. Phase 4：Apple ID 订单和匹配
4. Phase 5：续费任务中心
5. Phase 6：兑换码库存和半自动发货
6. Phase 7：淘宝/闲鱼自动发货
7. Phase 8：Apple ID 自动化任务中心
8. Phase 9：通知中心
9. Phase 10：安全中心
10. Phase 11：数据中心
    - 当前已完成数据库迁移、权限 seed、默认系统参数/数据字典 seed、后端接口、前端页面、审计日志和备份失败通知。
    - 当前已接入数据导入/导出真实 CSV 执行器、导入错误报告、24 小时下载有效期和下载审计；备份任务可调用 PostgreSQL 备份脚本，恢复任务可通过强确认执行临时库恢复演练。
11. Phase 12：运维监控
    - 当前已完成监控表、权限 seed、后端接口、前端页面、健康快照、队列状态、平台测试日志和错误日志。
    - Redis、淘宝、闲鱼、真实自动化 Worker 会按真实连接情况显示状态；平台授权状态已接入未配置、即将过期、已过期提示和通知，平台 OAuth 发起/回调骨架已接入，真实 token exchange、签名和平台业务接口仍需等开放平台资料接入。
12. Phase 13：网站维护
    - 当前已完成维护表、权限 seed、默认配置 seed、后端接口、前端页面、菜单入口和审计日志。
    - 第一版维护模式保存配置和审计记录；真实全局访问拦截、灰度发布和前台维护页将在上线前网关/前端守卫阶段接入。
13. Phase 14：审计日志中心和平台接口状态
    - 当前已完成分类审计接口、前端审计中心、平台状态接口、前端平台状态页、测试连接、授权配置和 OAuth 发起/回调骨架。
    - 第一版复用既有日志表；淘宝/闲鱼真实 token exchange、签名、订单同步、发货和退款后续接开放平台时实现。
14. Phase 15：通用表格和查询能力
    - 当前已完成 `user_table_views` 数据表、个人保存视图 API、默认视图约束、通用表格工具栏、日期快捷筛选、列配置、密度切换、批量操作、导出入口和筛选标签回显。
    - 第一版已接入模块化占位页、用户管理真实列表、权限管理角色列表、审计日志中心操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志和平台接口日志、通知中心规则/消息模板/通知日志、安全中心登录日志、在线会话、IP 白名单、敏感审批、敏感查看日志、平台接口状态页、网站维护系统公告、功能开关、版本信息、更新日志和系统参数、数据中心备份/恢复/导入/导出任务、回收站、数据清理、重复合并、数据字典和系统参数、客户管理真实列表、来源平台真实列表、消息模板真实列表、附件管理真实列表、Apple ID 管理真实列表、Apple ID 余额对账真实列表、Apple ID 财务对账/报表、Apple ID 业务设置真实列表、Apple ID 订单真实列表、Apple ID 开通记录真实列表、Apple ID 续费任务真实列表、Apple ID 操作计划真实列表、Apple ID 自动化任务真实列表、兑换码业务设置真实列表、兑换码订单真实列表、兑换码库存真实列表、兑换码报表、淘宝/闲鱼平台订单真实列表和售后补发真实列表；更多业务列表后续按模块逐页迁移复用。

## 开工前仍需确认

- 本机需要安装 Docker Desktop，或确认使用外部数据库、Redis 和文件存储。
- 财务角色是否默认拥有 `apple.topup.gift_code.view_full` 权限。
- 是否把当前基础工程和文档作为初始 Git 基线提交。
  - 提交前先运行 `npm run git:readiness`，确认 `.env`、备份、上传文件、构建产物、Telegram Bot Token 和常见密钥不会进入 Git。
  - 首次提交前运行 `npm run git:readiness:verbose`，查看候选文件按目录和扩展名的摘要。

## 核心开发原则

- Apple ID 模块和兑换码模块必须分离。
- 所有金额使用 Decimal。
- Apple ID 成本使用移动加权平均成本。
- 敏感信息必须加密保存。
- 查看敏感信息必须写操作日志。
- 所有列表页支持搜索、筛选、排序、分页。
- 每次只完成一个明确任务。
