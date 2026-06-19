# 首次 Git 提交计划

本文档用于首次 commit / push 前人工审查。它不是提交记录，也不会触发 Git 操作。

## 1. 当前仓库信息

| 项目     | 当前值                                                     |
| -------- | ---------------------------------------------------------- |
| 分支     | `main`                                                     |
| 远程仓库 | `https://github.com/wangchaozhuanyong/mairuanjian-api.git` |
| 提交策略 | 等待用户明确授权后再执行 commit / push                     |

截至当前审查，`npm run git:readiness:verbose` 已通过，候选文件数量为 350 个。

## 2. 候选文件范围

按顶层目录统计：

| 路径       | 数量 |
| ---------- | ---- |
| `apps`     | 291  |
| `scripts`  | 20   |
| 根目录     | 15   |
| `docs`     | 18   |
| `packages` | 3    |
| `deploy`   | 2    |
| `.github`  | 1    |

按扩展名统计：

| 扩展名     | 数量 |
| ---------- | ---- |
| `.ts`      | 205  |
| `.vue`     | 48   |
| `.sql`     | 25   |
| `.md`      | 20   |
| `.json`    | 14   |
| `.mjs`     | 15   |
| 无扩展名   | 6    |
| `.sh`      | 5    |
| `.yml`     | 3    |
| `.conf`    | 2    |
| `.example` | 2    |
| `.css`     | 1    |

## 3. 本次提交应包含

- 项目根配置：`package.json`、`package-lock.json`、TypeScript、ESLint、Prettier、Docker、GitHub Actions。
- 开发规则和文档：`AGENTS.md`、`README.md`、`docs/*`。
- 后端 NestJS：`apps/api`。
- 前端 Vue 3 + Element Plus：`apps/admin`。
- 共享包：`packages/shared`。
- 部署和运维脚本：`deploy/*`、`scripts/*`。
- 环境变量示例：`.env.example`、`.env.production.example`。

## 4. 本次提交不得包含

这些内容必须继续被 `.gitignore` 或 `git:readiness` 拦截：

- `.env`
- `.env.local`
- `.env.production`
- `backups/`
- `uploads/`
- `tmp/`
- `node_modules/`
- `apps/admin/dist/`
- `apps/api/dist/`
- `packages/shared/dist/`
- Telegram Bot Token
- OpenAI API Key
- GitHub Token
- AWS / Google 等云厂商密钥
- 私钥文件或私钥文本块

## 5. 提交前必须运行

```bash
npm run release:review
npm run git:readiness:verbose
```

如果准备进入预发布或生产等效环境，还必须运行：

```bash
REQUIRE_PROD_ENV=1 REQUIRE_MANUAL_GATES=1 npm run acceptance:launch
```

当前由于 Telegram 真实测试和生产域名尚未完成，严格上线验收仍不应视为通过。

## 6. 建议提交信息

```text
chore: scaffold admin system and launch readiness
```

建议提交说明：

```text
- add NestJS API, Vue admin, shared package, Prisma schema, and Docker setup
- implement Apple ID, redeem code, common admin, security, data, ops, notification, and maintenance modules
- add launch gates, acceptance scripts, backup/restore scripts, and Git readiness checks
- add product, architecture, database, API, permission, test, deployment, and release handoff docs
```

## 7. 用户授权后建议执行

只有用户明确允许 commit / push 后，才执行：

```bash
npm run release:review
npm run git:readiness:verbose
git add .
git commit -m "chore: scaffold admin system and launch readiness"
git push -u origin main
```

执行后确认 `git status --short` 为空，再记录 Git 基线门禁：

```bash
npm run launch:checklist -- \
  --id=git_baseline \
  --status=passed \
  --evidence="initial commit pushed to origin/main after npm run release:review and npm run git:readiness:verbose passed; working tree clean"
```

## 8. 当前不能标记完成的事项

- `telegram_test`：尚未配置真实 Telegram Bot Token / Chat ID 并完成真实测试发送。
- `prod_env`：`.env.production` 的 `APP_PUBLIC_URL` 和 `CORS_ORIGIN` 仍是占位或本地域名。
- `git_baseline`：用户尚未明确授权首次 commit / push。

这三个事项完成前，`npm run launch:gates` 必须继续显示 blocked。
