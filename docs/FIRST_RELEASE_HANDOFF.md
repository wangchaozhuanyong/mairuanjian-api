# 首版发布交接清单

本文档用于首版上线当天交接执行。它只记录发布顺序、门禁和证据要求，不替代 `docs/ROADMAP_TO_LAUNCH.md`、`docs/DEPLOYMENT.md`、`docs/STAGING_DRILL.md`。

## 1. 当前结论

截至 2026-06-18，本项目已经完成本地等效上线验收，首版策略为：

```bash
FIRST_RELEASE_MODE=semi_auto
```

含义：

- Apple ID 代充和兑换码业务可以按半自动可运营方式先内部上线。
- Apple ID 真实自动化 Worker 属于上线后增强，除非改为 `FIRST_RELEASE_MODE=full_auto`。
- 半自动首发允许 Telegram 后补；正式上线前仍必须完成生产域名配置和 Git 基线确认。

## 2. 不可跳过的上线前门禁

| 门禁              | 当前状态 | 证明方式                                                                |
| ----------------- | -------- | ----------------------------------------------------------------------- |
| Telegram 后补配置 | pending  | 后续在通知中心填写 Bot Token / Chat ID 并测试发送                       |
| 生产域名配置      | pending  | `npm run prod:env:check` 通过                                           |
| Git 基线确认      | pending  | `npm run git:readiness:verbose` 通过，并完成用户授权的首次提交/推送策略 |

注意：

- 不要把 Telegram Bot Token、生产密钥、数据库密码写入文档、聊天记录、Git commit message 或上线检查清单证据。
- `npm run launch:checklist` 只用于记录已经真实完成的手工门禁，不用于绕过真实检查。
- `npm run launch:gates:strict` 必须在预发布或生产等效环境通过后，才允许进入正式上线；`FIRST_RELEASE_MODE=semi_auto` 时 Telegram 可以保持 pending 后补。

## 3. 上线当天执行顺序

### Step 1：确认代码基线

```bash
npm run release:blockers
npm run release:review
```

要求：

- Git remote 指向 `https://github.com/wangchaozhuanyong/mairuanjian-api.git`。
- 候选文件不包含 `.env`、`.env.production`、备份、上传文件、构建产物或密钥。
- 首次提交范围和建议提交信息已按 `docs/INITIAL_COMMIT_PLAN.md` 完成人工审查。
- `release:review` 中的生产 env、Git 基线等硬门禁仍然 blocked 时，不能发布生产。
- 用户明确确认是否允许首次 commit / push。

完成后记录：

```bash
npm run launch:checklist -- \
  --id=git_baseline \
  --status=passed \
  --evidence="initial commit pushed to origin/main after npm run release:review and npm run git:readiness:verbose passed; working tree clean"
```

如果用户决定暂不提交，可以保持 `git_baseline=pending`，不能正式上线。

### Step 2：配置生产域名

详细操作按 `docs/PRODUCTION_ENV_RELEASE_GATE.md` 执行。

先确认上线策略写入 `.env.production`：

```bash
npm run prod:env:set-mode -- \
  --dry-run \
  --mode=semi_auto
```

确认无误后写入：

```bash
npm run prod:env:set-mode -- \
  --mode=semi_auto
```

先用真实 HTTPS 域名 dry-run：

```bash
npm run prod:env:set-domain -- \
  --dry-run \
  --app-url=https://your-domain.com
```

确认无误后写入：

```bash
npm run prod:env:set-domain -- \
  --app-url=https://your-domain.com
```

校验生产环境变量：

```bash
npm run prod:env:review
npm run prod:env:check
```

通过后记录：

```bash
npm run launch:checklist -- \
  --id=prod_env \
  --status=passed \
  --evidence="npm run prod:env:check passed; APP_PUBLIC_URL=https://your-domain.com"
```

要求：

- `APP_PUBLIC_URL` 必须是正式 HTTPS 域名。
- `CORS_ORIGIN` 必须匹配正式后台访问域名。
- 不允许出现 `localhost`、`127.0.0.1`、`example.com`、`replace_with`、`change_me`。

### Step 3：预留 Telegram，后续真实测试

详细操作按 `docs/TELEGRAM_RELEASE_GATE.md` 执行。

半自动首发可以先不填写 Telegram。后续需要启用 Telegram 通知时，在后台通知中心完成：

- 新增或更新 Telegram 配置。
- 填写真实 Bot Token 和 Chat ID。
- 启用配置。
- 点击测试发送，并确认 Telegram 真实收到消息。

验证：

```bash
npm run launch:gates
```

通过后记录：

```bash
npm run launch:checklist -- \
  --id=telegram_test \
  --status=passed \
  --evidence="Telegram test send passed in notification center; npm run launch:gates shows Telegram passed"
```

要求：

- 证据里只写测试结果，不写 Bot Token、不写完整 Chat ID。
- 如果测试失败，不要标记 `passed`，先在通知日志和平台接口状态里查看失败原因。

### Step 4：跑严格上线验收

生产 env 和 Git 基线门禁完成后运行：

```bash
npm run release:ready
REQUIRE_PROD_ENV=1 REQUIRE_MANUAL_GATES=1 npm run acceptance:launch
```

要求：

- `release:ready` 通过。
- `npm run check` 通过。
- 业务闭环验收通过。
- 敏感字段安全回归通过。
- 备份和临时库恢复演练通过。
- `launch:gates:strict` 通过。
- `git:readiness` 通过。

通过后更新 `docs/STAGING_DRILL.md`：

- 演练时间
- 执行环境
- 业务验收订单 ID
- 备份文件
- 临时恢复库
- 是否允许正式上线

### Step 5：部署和烟测

部署前：

```bash
npm run backup:postgres
```

部署后：

```bash
npm run prod:smoke
npm run launch:status
npm run launch:gates
```

必须确认：

- API health/ready 正常。
- 后台登录正常。
- 关键页面无 403/404 误拦截。
- 维护模式状态符合预期。
- 如果后续启用 Telegram，确认 `telegram_test` 已真实通过；未启用时保持 pending，不伪造通过。

## 4. 回滚原则

如果上线后出现 P0 问题：

1. 先开启维护模式。
2. 保留错误日志和当前数据库备份。
3. 回滚到上一版镜像或上一版部署包。
4. 必要时使用最近一次可用备份做临时库恢复验证，不要直接覆盖生产库。
5. 在 `docs/STAGING_DRILL.md` 记录问题、影响范围和处理结论。

## 5. 上线后第一批增强

首版 `semi_auto` 上线后，优先处理：

- Apple ID 真实自动化 Worker。
- 平台授权状态页的真实重新授权流程。
- 低/中级依赖风险评估和升级计划。

这些属于上线后增强，不改变首版上线前必须完成的生产 env 和 Git 基线门禁。
