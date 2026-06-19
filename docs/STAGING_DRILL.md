# 预发布环境上线演练记录

## 1. 文档定位

本文档用于记录本项目从本地等效验收到预发布环境上线演练的执行证据。

它不是部署教程；部署步骤以 `docs/ROADMAP_TO_LAUNCH.md` 和 `docs/DEPLOYMENT.md` 为准。本文档只记录每次演练的环境、命令、结果、问题和结论。

## 2. 当前演练状态

截至 2026-06-18，本项目已经完成本地等效上线验收和核心质量门禁，但尚未配置真实预发布域名。

当前状态：

- 本地完整质量门禁 `npm run check` 已通过。
- 上线状态速览 `npm run launch:status` 可用。
- 数据库备份脚本和临时库恢复演练脚本可用。
- 数据中心后台已接入真实备份执行器和强确认恢复演练执行器。
- 生产 `.env.production` 仍有域名占位值，`APP_PUBLIC_URL` 和 `CORS_ORIGIN` 需要替换为真实预发布或生产域名。
- Telegram 真实 Bot Token / Chat ID 测试发送仍待配置。
- 淘宝、闲鱼和 Apple ID 自动化 Worker 若要求全自动上线，仍需单独联调。

## 3. 预发布环境信息

首次真实预发布演练前填写：

| 项目              | 值                | 备注                                   |
| ----------------- | ----------------- | -------------------------------------- |
| 演练日期          | 待填写            | YYYY-MM-DD                             |
| 负责人            | 待填写            | 执行人                                 |
| 服务器            | 待填写            | 主机或云厂商                           |
| 预发布域名        | 待填写            | 例如 `https://staging.example.com`     |
| API 地址          | 待填写            | 例如 `https://staging.example.com/api` |
| 数据库            | PostgreSQL        | 确认是否独立预发布库                   |
| Redis             | Redis             | 确认是否独立预发布实例                 |
| 文件存储          | MinIO / 本地挂载  | 确认持久化目录                         |
| 备份目录          | `DATA_BACKUP_DIR` | 必须持久化                             |
| Git 分支 / commit | 待填写            | 上线候选版本                           |

## 4. 演练前检查

必须全部确认：

- [ ] 已确认本次演练使用的 Git commit。
- [ ] 已确认 `.env.production` 不提交到 Git。
- [ ] `APP_PUBLIC_URL` 已替换为预发布域名。
- [ ] `CORS_ORIGIN` 已替换为预发布域名。
- [ ] `JWT_SECRET`、`FIELD_ENCRYPTION_KEY`、`HASH_SECRET` 已使用强随机值。
- [ ] PostgreSQL、Redis、MinIO 密码不是示例值。
- [ ] `DATA_BACKUP_DIR` 指向持久化备份目录。
- [ ] Telegram 配置已填入真实 Bot Token 和 Chat ID，或明确本次跳过。
- [ ] 已明确第一版上线策略：半自动运营优先 / 必须全自动发货。

## 5. 必跑命令记录

在预发布服务器或等效环境执行并记录结果：

```bash
npm run prod:env:check
npm run prod:config
npm run prisma:migrate:deploy
npm run prisma:seed
BASE_URL=https://staging.example.com npm run prod:smoke
REQUIRE_PROD_ENV=1 npm run acceptance:launch
npm run git:readiness
```

执行记录：

| 命令                                           | 结果   | 时间   | 备注 |
| ---------------------------------------------- | ------ | ------ | ---- |
| `npm run prod:env:check`                       | 待执行 | 待填写 |      |
| `npm run prod:config`                          | 待执行 | 待填写 |      |
| `npm run prisma:migrate:deploy`                | 待执行 | 待填写 |      |
| `npm run prisma:seed`                          | 待执行 | 待填写 |      |
| `BASE_URL=<staging> npm run prod:smoke`        | 待执行 | 待填写 |      |
| `REQUIRE_PROD_ENV=1 npm run acceptance:launch` | 待执行 | 待填写 |      |
| `npm run git:readiness`                        | 待执行 | 待填写 |      |

## 6. 业务验收记录

Apple ID 代充业务：

- [ ] 创建客户和来源平台。
- [ ] 创建 Apple ID 账号。
- [ ] 录入充值并验证礼品卡代码加密、hash 去重、尾号展示。
- [ ] 录入消费并验证移动加权平均成本。
- [ ] 创建订单并验证自动匹配、锁定、开通记录、扣费和利润。
- [ ] 生成续费任务、操作计划和待办。
- [ ] 验证敏感字段查看权限、原因和审计日志。

兑换码自动发货业务：

- [ ] 创建兑换码业务设置和平台映射。
- [ ] 批量导入兑换码并验证去重。
- [ ] 创建平台订单并匹配兑换码。
- [ ] 执行发货并验证防重复发货。
- [ ] 执行售后补发并验证损耗成本。
- [ ] 查看库存和利润报表。

系统能力：

- [ ] 管理员登录成功。
- [ ] MFA 绑定、恢复码和登录校验可用。
- [ ] 通知中心站内通知可用。
- [ ] Telegram 测试发送成功。
- [ ] 数据中心备份任务可执行。
- [ ] 数据中心恢复演练强确认可执行。
- [ ] 运维监控 API、数据库、Redis、队列、磁盘状态可查看。
- [ ] 维护模式、403、404 页面可访问。

## 7. 问题记录

| 编号 | 问题   | 严重级别 | 处理人 | 状态 | 备注 |
| ---- | ------ | -------- | ------ | ---- | ---- |
| 1    | 待填写 | P0/P1/P2 | 待填写 | open |      |

## 8. 演练结论

真实预发布演练完成后填写：

- 演练结论：未开始 / 通过 / 有条件通过 / 不通过
- 是否允许正式上线：是 / 否
- 必须上线前修复的问题：
  - 待填写
- 可上线后处理的问题：
  - 待填写

## 9. 当前结论

当前只完成本地等效演练记录，真实预发布演练等待以下外部信息：

- 预发布服务器或部署环境。
- 真实预发布域名。
- 真实 `.env.production` 域名配置。
- 真实 Telegram Bot Token / Chat ID。
- 第一版上线策略确认：半自动优先或必须全自动。

## 10. 最新本地等效演练记录

演练时间：2026-06-18 13:41 PDT

执行命令：

```bash
npm run acceptance:launch
```

结果：通过本地等效上线验收。

已通过内容：

- `npm run check`
- `npm run prod:config:example`
- `npm run acceptance:business`
- `npm run acceptance:security`
- PostgreSQL 本地备份
- 临时库恢复演练
- `npm run launch:gates` 非 strict 手工门禁核验（当前外部门禁未完成，预期显示 blocked）
- `npm run git:readiness`

业务验收证据：

- Apple ID 订单：`60df5990-54e6-41cc-97ab-0b284d1a1b95`
- Apple ID 开通记录：`234143f1-b736-4f03-9d28-a93728cea786`
- 兑换码订单：`c3b49542-15c5-467d-b6ad-7bd2f3b290ea`
- 兑换码重复发货保护返回：`409`

安全验收证据：

- Apple ID 密码
- Apple ID 礼品卡代码
- 兑换码完整码
- 客户手机号

备份和恢复证据：

- 备份文件：`backups/postgres/local/apple_business-20260618-134138.dump`
- 临时恢复库：`restore_drill_20260618_134138_11556`
- 恢复校验：`users=4`、`roles=8`、`permissions=117`、`audit_logs=376`、`system_parameters=8`、`apple_accounts=24`、`redeem_codes=28`

仍未通过的外部门禁：

- `.env.production` 的 `APP_PUBLIC_URL` 和 `CORS_ORIGIN` 仍是占位或本地域名。
- Telegram 尚无启用且真实测试成功的配置。
- 首次 Git commit / push 仍等待明确授权。
