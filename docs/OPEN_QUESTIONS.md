# 待确认事项

本文件记录开始业务开发前需要用户确认或需要外部环境配合的事项。

## P0 外部环境

### 1. Docker Desktop

状态：已处理。

当前本机已安装 Docker Desktop，并已验证 Docker CLI、Docker Compose、Docker daemon 可用。

当前项目基础服务：

- PostgreSQL 16：Docker 容器端口 `5432` 映射到宿主机 `55432`
- Redis 7：宿主机 `6379`
- MinIO：宿主机 `9000`，控制台 `9001`

说明：本机已有其他 PostgreSQL 服务占用 `localhost:5432`，所以本项目统一使用 `localhost:55432`，避免 Prisma 或后端误连到本机旧数据库。

已完成验证：

- `docker compose up -d`
- `npm run prisma:migrate:deploy`
- `npm run prisma:seed`
- `npm run doctor`
- `npm run check`

后续仍需注意：

- 不要把 `.env` 的 `DATABASE_URL` 改回 `localhost:5432`
- 如果改用外部 PostgreSQL、Redis、MinIO，需要同步更新 `.env` 和部署文档

## P0 Git 基线

当前项目文件尚未提交到 Git。

需要确认：

- 是否把当前基础工程、文档和质量门禁作为初始提交
- 是否推送到 `https://github.com/wangchaozhuanyong/mairuanjian-api.git`

默认规则：

- 未经明确要求，不 commit
- 未经明确要求，不 push
- 未经明确要求，不创建 PR

## P1 业务权限

### Apple ID 充值礼品卡完整代码查看权限

需要确认：

- 财务角色是否默认拥有 `apple.topup.gift_code.view_full`
- 客服是否只能查看后 4 位
- 查看完整礼品卡代码是否需要填写查看原因
- 是否需要敏感字段访问审批后才能查看

默认建议：

- 管理员可查看完整代码
- 财务是否可查看完整代码待确认
- 客服、发货员默认不可查看完整代码
- 每次查看完整代码必须写敏感查看日志

## P1 成本核算口径

需要确认：

- 金额是否统一人民币
- Decimal 精度是否统一 `Decimal(18, 4)`
- 报表展示是否保留 2 位小数
- 成本计算中间过程是否保留 4 位或更多精度
- 退款、余额修正是否影响移动加权平均成本

默认建议：

- 数据库存储 `Decimal(18, 4)`
- 展示金额按业务配置格式化
- 成本计算不使用 float

## P2 平台接口能力

淘宝、闲鱼自动发货能力需要在 Phase 7 前确认实际接口可用性。

需要确认：

- 是否已有淘宝开放平台应用
- 是否已有闲鱼可用发货接口或自动化方案
- 是否允许第一版先做手工导入和半自动发货
- 平台授权失效后的人工处理流程
