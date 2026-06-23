# 技术架构设计

## 1. 技术栈

### 后端

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- JWT
- RBAC 权限控制

### 前端

- Vue 3
- Vite
- TypeScript
- Element Plus
- Pinia
- Vue Router
- Axios

### 基础设施

- Docker Compose
- PostgreSQL
- Redis
- MinIO 或本地文件存储

## 2. 推荐目录结构

```text
project-root/
├── AGENTS.md
├── README.md
├── .env.example
├── docker-compose.yml
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── TASKS.md
│   ├── PERMISSIONS.md
│   └── TEST_CASES.md
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── audit-logs/
│   │   │   ├── customers/
│   │   │   ├── source-platforms/
│   │   │   ├── apple/
│   │   │   ├── codes/
│   │   │   └── platform-adapters/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── admin/
│       ├── src/
│       │   ├── main.ts
│       │   ├── router/
│       │   ├── stores/
│       │   ├── api/
│       │   ├── layouts/
│       │   ├── views/
│       │   └── components/
│       └── package.json
├── packages/
│   └── shared/
│       ├── types/
│       ├── constants/
│       └── validators/
└── scripts/
```

## 3. 后端模块划分

### 公共模块

- auth
- users
- roles
- permissions
- audit-logs
- attachments
- customers
- source-platforms
- message-templates
- system-settings

### Apple ID 模块

建议放在 `apps/api/src/apple/` 下：

```text
apple/
├── accounts/
├── secrets/
├── balances/
├── topups/
├── consumptions/
├── adjustments/
├── services/
├── service-platform-mappings/
├── orders/
├── activations/
├── matching/
├── locks/
├── renewal-tasks/
├── action-plans/
├── automation-tasks/
└── reports/
```

### 兑换码模块

建议放在 `apps/api/src/codes/` 下：

```text
codes/
├── services/
├── platform-mappings/
├── batches/
├── inventory/
├── platform-orders/
├── deliveries/
├── after-sales/
├── refunds/
└── reports/
```

### 兑换码交付服务

兑换码交付逻辑放在兑换码业务模块内，不维护外部交易平台自动同步适配器：

```text
codes/
├── orders/
├── inventory/
├── deliveries/
├── after-sales/
└── reports/
```

接口：

```text
deliverCode()
recordDeliveryFailure()
reissueCode()
```

## 4. 前端页面结构

```text
views/
├── login/
├── dashboard/
├── system/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── audit-logs/
│   └── settings/
├── common/
│   ├── customers/
│   ├── source-platforms/
│   └── message-templates/
├── apple/
│   ├── accounts/
│   ├── balances/
│   ├── topups/
│   ├── consumptions/
│   ├── services/
│   ├── orders/
│   ├── activations/
│   ├── renewal-tasks/
│   ├── action-plans/
│   ├── automation-tasks/
│   └── reports/
└── codes/
    ├── services/
    ├── batches/
    ├── inventory/
    ├── orders/
    ├── deliveries/
    ├── after-sales/
    └── reports/
```

## 5. 核心设计原则

1. Apple ID 业务和兑换码业务必须业务隔离。
2. 公共模块可以共享。
3. 后端按领域模块拆分。
4. 金额使用 Decimal。
5. 敏感信息加密。
6. 所有关键操作写 audit log。
7. 列表接口统一分页、搜索、排序。
8. 平台发货能力使用 adapter，不要写死在业务 service 中。
9. 自动化任务使用队列，不能阻塞订单主流程。
10. 订单主流程必须在没有自动化能力的情况下也能正常运转。

## 6. 队列设计

使用 BullMQ。

队列建议：

- renewal-task-generator：到期任务生成
- apple-automation：Apple ID 自动化任务
- code-delivery：兑换码发货任务
- report-export：报表导出

## 7. 安全设计

- JWT 登录
- RBAC 权限
- 字段级权限
- 敏感字段加密
- 敏感字段查看日志
- 导出权限控制
- 平台 token 加密
- 数据库备份加密
- 操作日志不可随意删除

## 8. 部署设计

开发环境：

```text
Docker Compose:
- PostgreSQL
- Redis
- MinIO
```

第一版生产：

- `docker-compose.prod.yml` 编排 PostgreSQL、Redis、MinIO、API、Admin
- `apps/api/Dockerfile` 构建 NestJS 后端镜像
- `apps/admin/Dockerfile` 构建 Vue 静态资源并用 Nginx 托管
- `deploy/nginx/admin.conf` 在 Admin 容器内代理 `/api`
- `deploy/nginx/edge-ssl.example.conf` 作为服务器外层 HTTPS 反代示例
- `.env.production.example` 提供生产环境变量模板
- `scripts/backup-postgres.sh` 和 `scripts/restore-postgres.sh` 提供数据库备份恢复入口
- `scripts/deploy-smoke.sh` 提供上线后健康烟测

后续可升级：

- 云服务器 + 托管数据库
- 独立对象存储
- 自动 HTTPS 证书续期
- 自动化备份上传对象存储
- Kubernetes 或蓝绿发布

## 9. MVP 顺序

1. 项目初始化
2. 登录权限
3. 客户和来源平台
4. Apple ID 管理
5. Apple ID 平均成本
6. Apple ID 订单和匹配
7. 续费任务中心
8. 兑换码库存和半自动发货
9. 兑换码手工订单和外部来源订单处理
10. Apple ID 自动化任务中心
