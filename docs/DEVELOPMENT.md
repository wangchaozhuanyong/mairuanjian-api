# 本地开发准备

## 1. 基础环境

需要：

- Node.js 24
- npm 10+
- Docker Desktop，或外部 PostgreSQL、Redis、MinIO

检查命令：

```bash
node -v
npm -v
docker --version
```

## 2. 安装依赖

```bash
nvm use
npm install
```

如果没有安装 nvm，可以直接使用 Node.js 24。

## 3. 初始化本地环境变量

```bash
npm run setup:env
```

该命令会：

- 创建根目录 `.env`
- 生成本地开发用随机密钥
- 创建 `apps/api/.env` 和 `apps/admin/.env` 软链接

`.env` 不允许提交到 Git。

## 4. 启动基础设施

推荐使用 Docker Compose：

```bash
docker compose up -d
```

包含：

- PostgreSQL 16
- Redis 7
- MinIO

默认端口：

- PostgreSQL：宿主机 `55432` -> 容器 `5432`
- Redis：宿主机 `6379`
- MinIO API：宿主机 `9000`
- MinIO Console：宿主机 `9001`

本项目不使用宿主机 `5432` 作为 PostgreSQL 端口，避免和本机已有 PostgreSQL 服务冲突。

如果本机没有 Docker Desktop，则需要先安装 Docker Desktop，或把 `.env` 中的 PostgreSQL、Redis、MinIO 配置改为外部服务。

## 5. 环境自检

```bash
npm run doctor
```

`doctor` 会检查：

- Node.js 版本
- npm 版本
- `.env`
- workspace 环境变量软链接
- Docker CLI
- Docker Compose
- Prisma schema

如果 Docker 未安装，`doctor` 会失败。这表示数据库、Redis、MinIO 还不能用，不代表代码质量检查失败。

## 6. Prisma

生成 Prisma Client：

```bash
npm run prisma:generate
```

应用迁移：

```bash
npm run prisma:migrate:deploy
```

初始化 seed：

```bash
npm run prisma:seed
```

## 7. 启动服务

后端：

```bash
npm run dev:api
```

前端：

```bash
npm run dev:admin
```

默认地址：

- API: `http://localhost:3000/api`
- Admin: `http://localhost:5374`

## 8. 质量门禁

```bash
npm run check
```

包含：

- Prettier 格式检查
- ESLint
- TypeScript 类型检查
- 测试
- 构建
- Prisma schema validate
- high 级别依赖审计

当前前端和 shared 包还没有真实测试用例，后端 Jest 也允许无测试通过。进入业务开发后，关键成本、权限、加密、去重、防重复发货逻辑必须补测试。
