# 部署与上线流程

## 1. 当前部署定位

第一版生产部署采用单服务器 Docker Compose：

- `postgres`：PostgreSQL 16
- `redis`：Redis 7
- `minio`：附件对象存储
- `api`：NestJS 后端
- `admin`：Nginx 托管 Vue 管理后台，并代理 `/api`

本文件只定义生产部署底座和上线检查流程，不代表已经接入真实 Apple ID 自动化 Worker、真实物理备份执行器。

从当前开发状态推进到正式上线的完整执行顺序见：

```text
docs/ROADMAP_TO_LAUNCH.md
```

首版发布当天按一页纸交接清单执行：

```text
docs/FIRST_RELEASE_HANDOFF.md
```

## 2. 生产文件

- `docker-compose.prod.yml`：生产服务编排
- `docker-compose.apple-worker.yml`：Apple 官网检查 Worker 可选编排，不随普通生产启动自动启用
- `.env.production.example`：生产环境变量模板
- `apps/api/Dockerfile`：后端生产镜像
- `apps/api/Dockerfile.worker`：Apple 官网检查 Worker 镜像，包含 Playwright Chromium runtime
- `apps/admin/Dockerfile`：前端生产镜像
- `deploy/nginx/admin.conf`：Admin 容器内 Nginx 配置
- `deploy/nginx/edge-ssl.example.conf`：服务器外层 HTTPS 反代示例
- `scripts/deploy-smoke.sh`：上线后健康烟测
- `scripts/init-production-env.mjs`：生成 `.env.production` 强随机密钥骨架，不打印密钥
- `scripts/validate-production-env.mjs`：生产 `.env.production` 必填项、占位值和弱配置校验
- `scripts/production-env-review.mjs`：只读生产环境变量审查，只展示公开值和密钥状态，不打印密钥
- `scripts/set-production-release-mode.mjs`：安全设置生产 `FIRST_RELEASE_MODE`，只支持 `semi_auto` 或 `full_auto`
- `scripts/backup-postgres.sh`：PostgreSQL 备份
- `scripts/restore-postgres.sh`：PostgreSQL 恢复，默认有确认保护
- `scripts/verify-postgres-restore.sh`：PostgreSQL 备份恢复演练，恢复到临时库并自动清理
- `scripts/acceptance-launch-local.sh`：本地等效上线验收总入口，串行执行质量、业务、安全、备份、恢复演练和 Git 提交前安全检查
- `scripts/launch-status.mjs`：上线状态速览，只读检查 Phase 16/17/18 未完成项、生产环境变量状态和 Git 状态
- `scripts/manual-gates-status.mjs`：上线手工门禁核验，检查生产 env、上线检查清单；`FIRST_RELEASE_MODE=semi_auto` 时 Telegram 真实测试可后补
- `scripts/record-launch-checklist.mjs`：记录上线检查清单手工项证据，拒绝将常见密钥写入证据
- `scripts/release-review.mjs`：只读发布审查聚合，普通模式集中输出上线状态、手工门禁、清单项和 Git 候选文件摘要；strict 模式作为 `npm run release:ready` 发布就绪硬门禁
- `scripts/release-blockers.mjs`：只读输出当前上线阻塞项、处理动作、验证命令和证据记录命令
- `scripts/git-readiness.mjs`：Git 基线提交前检查，防止私有环境变量、备份、上传文件、构建产物、Telegram Bot Token 或常见密钥误提交；`--verbose` 可输出候选文件摘要，便于首次提交审查
- `scripts/generate-apple-web-sing-box-config.mjs`：从加密节点池生成 sing-box 配置，不打印节点密钥
- `scripts/apple-web-worker-runtime-check.mjs`：验证 Playwright Chromium 和出口 IP 检测 runtime

## 3. 服务器准备

要求：

- Linux 服务器
- Docker Engine
- Docker Compose
- 域名解析到服务器
- HTTPS 证书，建议使用 Let’s Encrypt

首次部署前优先生成生产环境变量骨架：

```bash
npm run prod:env:init
```

如需直接指定生产域名，可使用：

```bash
npm run prod:env:init -- --app-url=https://your-domain.com --cors-origin=https://your-domain.com
```

脚本会生成强随机密码和密钥，并写入本地 `.env.production`，不会在终端打印密钥。然后修改 `.env.production`：

- `APP_PUBLIC_URL`
- `CORS_ORIGIN`
- 按需调整 `POSTGRES_DB`、`POSTGRES_USER`、`ADMIN_HTTP_PORT`
- 记录并妥善保管 `POSTGRES_PASSWORD`、`JWT_SECRET`、`FIELD_ENCRYPTION_KEY`、`HASH_SECRET`、`MINIO_ROOT_PASSWORD`、`MINIO_SECRET_KEY`
- 首次初始化后删除或轮换 `SEED_ADMIN_PASSWORD`

如果 `.env.production` 已经存在，只需要替换真实域名，不要重新生成密钥。先 dry-run 检查：

```bash
npm run prod:env:set-domain -- --dry-run --app-url=https://your-domain.com
```

确认无误后执行：

```bash
npm run prod:env:set-domain -- --app-url=https://your-domain.com
```

该脚本只更新 `APP_PUBLIC_URL` 和 `CORS_ORIGIN`，不会打印或改动数据库、JWT、加密、MinIO 等生产密钥。

如果 `.env.production` 缺少 `FIRST_RELEASE_MODE`，且第一版仍按半自动可运营策略上线，先 dry-run 检查：

```bash
npm run prod:env:set-mode -- --dry-run --mode=semi_auto
```

确认无误后执行：

```bash
npm run prod:env:set-mode -- --mode=semi_auto
```

该脚本只更新 `FIRST_RELEASE_MODE`，不会打印或改动数据库、JWT、加密、MinIO 等生产密钥。

如果必须手动创建，也可以复制模板：

```bash
cp .env.production.example .env.production
```

生产环境禁止使用 `replace_with_*` 或 `change_me*` 占位值。

填写完成后先检查生产环境变量：

```bash
npm run prod:env:check
```

开发或上线前可随时查看当前缺口：

```bash
npm run launch:status
```

该命令不会修改数据库、发送通知或启动服务，只读取任务清单、生产环境变量校验结果和 Git 状态。

## 4. 配置校验

用示例配置检查 Compose 结构：

```bash
npm run prod:config:example
```

用真实生产配置检查：

```bash
npm run prod:config
```

## 5. 构建和启动

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

应用数据库迁移：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  npm run prisma:migrate:deploy --workspace @apple-business/api
```

首次初始化权限和管理员：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  npm run prisma:seed --workspace @apple-business/api
```

初始化完成后，建议删除或轮换 `.env.production` 中的 `SEED_ADMIN_PASSWORD`。

## 6. 健康检查

容器内：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

服务器本机：

```bash
BASE_URL=http://localhost:8080 npm run prod:smoke
```

域名接入 HTTPS 后：

```bash
BASE_URL=https://example.com npm run prod:smoke
```

烟测会检查：

- Admin 首页
- `/api/health/live`
- `/api/health/ready`

## 6.1 Apple 官网检查 Worker

Apple 官网检查 Worker 不随普通生产 Compose 自动启用。启用前必须完成：

- 后台“运维监控 -> Apple 节点”已保存并同步节点订阅。
- 已重置任何暴露过的节点订阅 token。
- `.runtime/apple-web-sing-box.json` 已由 `npm run apple-web:sing-box-config` 生成。
- Playwright runtime 可用，可先运行 `npm run apple-web:runtime-check`。
- 确认 `.env.production` 里的 `APPLE_WEB_CHECK_WORKER_ENABLED` 保持默认 `false`，只由单独 Worker 容器覆盖为 `true`，避免多个 API 实例重复消费任务。

启动 Worker：

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.apple-worker.yml \
  up -d sing-box apple-web-worker
```

查看 Worker 日志：

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.apple-worker.yml \
  logs -f apple-web-worker
```

关闭 Worker：

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.apple-worker.yml \
  stop apple-web-worker
```

## 7. HTTPS 反代

`admin` 容器默认暴露宿主机 `8080`。

服务器外层 Nginx 可参考：

```text
deploy/nginx/edge-ssl.example.conf
```

上线时把：

- `example.com`
- 证书路径
- 反代端口

替换成真实值。

## 8. 备份

创建数据库备份：

```bash
npm run backup:postgres
```

默认写入：

```text
backups/postgres/
```

备份文件权限会设置为 `600`。备份目录默认被 `.gitignore` 忽略。

默认保留策略：

- `BACKUP_RETENTION_DAYS=14`：删除超过 14 天的当前数据库备份。
- `BACKUP_RETENTION_COUNT=30`：当前数据库备份最多保留 30 份。
- 设置为 `0` 可关闭对应清理规则。
- 脚本只清理 `${POSTGRES_DB}-*.dump`，不会清理其他数据库或手工命名文件。

示例：

```bash
BACKUP_RETENTION_DAYS=30 BACKUP_RETENTION_COUNT=60 npm run backup:postgres
```

生产环境建议把 `npm run backup:postgres` 加入服务器 cron，并把备份文件同步到服务器外部的安全存储。

## 9. 恢复

恢复属于高风险操作，脚本默认拒绝执行。

```bash
CONFIRM_RESTORE=YES bash scripts/restore-postgres.sh backups/postgres/your-file.dump
```

上线前恢复演练请优先使用临时库校验脚本，不覆盖当前业务库：

```bash
npm run restore:verify -- backups/postgres/your-file.dump
```

恢复前必须确认：

- 已停止业务写入
- 已额外复制当前数据库备份
- 恢复文件来自可信来源
- 当前连接的是目标环境，不是误连生产或误连测试

## 10. 上线检查清单

上线前必须确认：

- `npm run launch:status` 已确认 Phase 16 剩余项只包含明确的人工/外部门禁
- `npm run acceptance:launch` 在本地或预发布等效环境通过，其中已包含 `npm run git:readiness`
- 预发布或生产等效环境必须使用 `REQUIRE_PROD_ENV=1 npm run acceptance:launch`，确保 `.env.production` 真实配置也被强制校验
- `npm run check` 通过
- `npm run acceptance:business` 在预发布或本地等效环境通过
- `npm run acceptance:security` 在预发布或本地等效环境通过
- `npm run backup:postgres` 已生成可用备份
- `npm run restore:verify -- backups/postgres/your-file.dump` 已完成临时库恢复演练
- 已确认 `BACKUP_RETENTION_DAYS`、`BACKUP_RETENTION_COUNT`、`DOCKER_LOG_MAX_SIZE`、`DOCKER_LOG_MAX_FILE` 符合服务器磁盘容量
- `npm run prod:env:check` 通过
- `npm run doctor` 在部署机或等效环境通过
- `npm run prod:config` 通过
- `docs/ROADMAP_TO_LAUNCH.md` 中 P0 上线阻塞项已处理或已明确延期原因
- `prisma migrate status` 显示数据库最新
- 已执行一次数据库备份
- 管理员账号可登录
- 权限、角色、审计日志可用
- `/api/health/live` 和 `/api/health/ready` 正常
- 附件上传和下载正常
- 通知中心默认规则存在
- 平台接口状态页能打开
- 维护模式未误开启
- `.env.production` 不包含占位密钥

## 11. 日志、备份和磁盘策略

第一版生产默认策略：

- Docker 容器日志使用 `json-file` 轮转，默认 `DOCKER_LOG_MAX_SIZE=20m`、`DOCKER_LOG_MAX_FILE=10`。
- PostgreSQL 备份默认保留 14 天且最多 30 份，可通过 `.env.production` 调整。
- 运维监控通过 `/api/ops/disk-space` 和健康快照记录磁盘使用率；80% 进入 warning，90% 进入 critical。
- 健康快照发现磁盘 critical 会触发通知事件 `ops.disk.low`，通知渠道取决于通知中心规则配置。
- 正式上线后应在服务器层额外配置日志采集或远程备份，避免单机磁盘故障导致日志和备份同时丢失。

## 12. 回滚

第一版回滚策略：

1. 保留上一个稳定镜像或代码版本。
2. 上线前备份数据库。
3. 如果新版本启动失败，回退镜像或代码后重新 `up -d`。
4. 如果 migration 已改变数据库结构，先评估是否需要恢复备份，不要直接手工改生产库。

## 13. 后续增强

- API 镜像瘦身，拆分 migration runner
- Admin 静态资源 CDN
- 自动 HTTPS 证书续期
- 自动化备份上传到对象存储
- 数据恢复审批和执行器
- 蓝绿发布或灰度发布
- 接入真实 Apple ID 自动化 Worker
