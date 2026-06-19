# 生产环境变量上线门禁操作手册

本文档用于完成首版上线前的 `prod_env` 门禁。它只说明生产环境变量的安全配置、审查、验收和证据记录流程，不保存任何真实密钥。

## 1. 门禁目标

`prod_env` 只有同时满足以下条件，才允许标记通过：

- `.env.production` 存在。
- `APP_PUBLIC_URL` 使用真实 HTTPS 域名。
- `CORS_ORIGIN` 使用真实 HTTPS 来源，不能是本地或占位域名。
- 必填密钥存在，且不是 `replace_with`、`change_me`、`example.com`、`localhost`、`127.0.0.1`。
- `npm run prod:env:check` 通过。
- 使用 `npm run launch:checklist` 记录不含敏感信息的 `prod_env` 证据。

## 2. 安全原则

- 不要把 `.env.production` 提交到 Git。
- 不要在聊天、文档、截图、commit message 或清单证据中写真实密钥。
- 不要把生产数据库密码、JWT Secret、字段加密密钥、Hash Secret、MinIO 密钥发给不需要的人。
- 可以记录公开域名，例如 `APP_PUBLIC_URL=https://admin.example.com`。
- 密钥审查只看“是否设置、长度是否足够、是否仍是占位值”，不看明文。

## 3. 当前只读审查

运行：

```bash
npm run prod:env:review
```

该命令会输出：

- `prod:env:check` 是否通过。
- 公开值：`NODE_ENV`、`APP_PUBLIC_URL`、`CORS_ORIGIN`、`FIRST_RELEASE_MODE`、数据库名、用户名、MinIO bucket 等。
- 密钥状态：只显示 `ok`、`missing`、`needs-rotation`、长度，不显示真实值。
- 下一步建议。

当前常见未完成状态：

```text
APP_PUBLIC_URL: needs-real-value | https://example.com
CORS_ORIGIN: needs-real-value | https://example.com
```

这表示还没有填真实生产域名。

## 4. 设置真实域名

先 dry-run：

```bash
npm run prod:env:set-domain -- \
  --dry-run \
  --app-url=https://your-domain.com
```

如果后台和 API 使用不同来源，显式传入 CORS：

```bash
npm run prod:env:set-domain -- \
  --dry-run \
  --app-url=https://admin.your-domain.com \
  --cors-origin=https://admin.your-domain.com,https://api.your-domain.com
```

确认无误后写入：

```bash
npm run prod:env:set-domain -- \
  --app-url=https://your-domain.com
```

要求：

- 必须是 `https://`。
- 不允许使用 `localhost`、`127.0.0.1`、`example.com`。
- 脚本只会更新 `APP_PUBLIC_URL` 和 `CORS_ORIGIN`，不会打印或重置密钥。

## 5. 校验生产 env

写入真实域名后运行：

```bash
npm run prod:env:review
npm run prod:env:check
```

必须确认：

- `Validation: passed`。
- `APP_PUBLIC_URL: ok`。
- `CORS_ORIGIN: ok`。
- 核心密钥为 `ok`。
- 没有 `missing`、`needs-real-value`、`needs-rotation`。

如果 `FIRST_RELEASE_MODE` 缺失，建议补为：

```bash
npm run prod:env:set-mode -- --dry-run --mode=semi_auto
npm run prod:env:set-mode -- --mode=semi_auto
```

该值不是密钥，但应和 `docs/LAUNCH_STRATEGY.md` 保持一致。

## 6. 记录上线证据

生产 env 校验通过后，记录上线检查清单：

```bash
npm run launch:checklist -- \
  --id=prod_env \
  --status=passed \
  --evidence="npm run prod:env:check passed; APP_PUBLIC_URL=https://your-domain.com"
```

要求：

- `prod_env` 当前必须能通过 `npm run prod:env:check`，否则脚本会拒绝写入 `passed`。
- 证据里不包含任何密钥。
- 可以记录公开域名，例如 `APP_PUBLIC_URL=https://your-domain.com`。

再次复核：

```bash
npm run launch:gates
npm run release:review
```

要求：

- `prod_env` 显示 `passed`。
- `release:review` 仍然能看到生产 env 审查摘要。

## 7. 最终严格上线验收

`telegram_test`、`prod_env`、`git_baseline` 三个手工门禁都记录为 `passed` 后，在预发布或生产等效环境运行：

```bash
npm run release:ready
REQUIRE_PROD_ENV=1 REQUIRE_MANUAL_GATES=1 npm run acceptance:launch
```

要求：

- `release:ready` 通过。
- 生产 env 强制门禁通过。
- 手工门禁 strict 通过。
- 业务闭环、安全回归、备份恢复和 Git 安全检查都通过。

## 8. 常见失败和处理

| 现象                                             | 处理方式                                       |
| ------------------------------------------------ | ---------------------------------------------- |
| `APP_PUBLIC_URL contains placeholder`            | 使用 `prod:env:set-domain` 写入真实 HTTPS 域名 |
| `CORS_ORIGIN contains placeholder`               | 使用真实后台/API 来源替换                      |
| `must use https:// in production`                | 不允许用 HTTP，上线前配置 HTTPS                |
| `JWT_SECRET contains placeholder`                | 使用 `prod:env:init` 生成强随机值或手工轮换    |
| `FIELD_ENCRYPTION_KEY must be at least 32`       | 使用 32 字节以上随机值                         |
| `SEED_ADMIN_PASSWORD contains placeholder`       | 首次初始化后移除或轮换                         |
| `prod:env:review` 显示 `FIRST_RELEASE_MODE` 缺失 | 补充 `FIRST_RELEASE_MODE=semi_auto`            |

## 9. 不允许的做法

- 不允许为了通过门禁删除 `.env.production` 校验项。
- 不允许把本地域名当生产域名。
- 不允许在 `npm run prod:env:check` 未通过时标记 `prod_env=passed`。
- 不允许把 `.env.production` 内容复制进文档或 Git。
- 不允许在生产环境继续使用模板中的 `replace_with_*` 值。
