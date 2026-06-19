# AGENTS.md

## 项目名称

Apple ID 代充业务管理系统 + 兑换码自动发货系统

## 项目定位

这是一个后台管理系统，包含两个相互独立的业务区：

1. Apple ID 代充业务管理系统
2. 兑换码自动发货系统

两个业务区可以共用以下公共模块：

- 客户管理
- 来源平台设置
- 员工账号
- 角色权限
- 消息模板
- 操作日志
- 附件上传
- 系统设置

但是两个业务区的业务数据、订单逻辑、成本逻辑、报表逻辑必须分开。

## 强制模块边界

### Apple ID 业务区

Apple ID 业务区处理：

- Apple ID 资料
- Apple ID 密码、密保、手机号等敏感资料
- Apple ID 当前余额
- Apple ID 移动加权平均成本
- Apple ID 充值记录
- Apple ID 消费记录
- Apple ID 余额修正
- Apple ID 业务设置
- Apple ID 订单录入
- Apple ID 自动匹配
- Apple ID 锁定规则
- Apple ID 开通记录
- Apple ID 到期提醒
- 续费任务中心
- Apple ID 操作计划
- 待取消订阅
- 待充值续费
- 等待自动续费
- Apple ID 自动化任务中心
- Apple ID 利润报表

### 兑换码业务区

兑换码业务区处理：

- 兑换码业务设置
- 兑换码批量导入
- 兑换码库存
- 兑换码面值
- 兑换码成本
- 淘宝订单
- 闲鱼订单
- 商品/SKU 映射
- 自动匹配兑换码
- 自动发货
- 发货失败处理
- 售后补发
- 兑换码利润报表

### 禁止耦合

- 兑换码模块不得依赖 Apple ID 表。
- Apple ID 模块不得依赖兑换码库存表。
- 兑换码订单不得生成 Apple ID 开通记录。
- Apple ID 订单不得消耗兑换码库存。
- 两个业务区可以共用 customers、source_platforms、users、roles、permissions、audit_logs、attachments、message_templates。

## 推荐技术栈

- 后端：NestJS + TypeScript
- ORM：Prisma
- 数据库：PostgreSQL
- 缓存/队列：Redis + BullMQ
- 前端：Vue 3 + Vite + TypeScript + Element Plus
- 状态管理：Pinia
- HTTP：Axios
- 部署：Docker Compose
- 文件存储：本地文件或 MinIO，后期可切换对象存储

## 金额和成本规则

- 所有金额字段必须使用 Decimal。
- 禁止使用 float/double 处理金额。
- Apple ID 成本采用移动加权平均成本，不采用 FIFO。
- Apple ID 充值不需要手续费字段。
- 平台手续费属于订单层成本，不属于 Apple ID 充值成本。
- Apple ID 订单利润公式：

```text
订单利润 = 客户实收金额 - Apple余额消耗成本 - 平台手续费 - 退款/补发损耗
```

- Apple余额消耗成本公式：

```text
Apple余额消耗成本 = 消耗外币金额 × 当前平均成本
```

## 移动加权平均成本规则

充值时：

```text
新余额 = 原余额 + 充值面值
新余额人民币成本 = 原余额人民币成本 + 本次充值人民币成本
新平均成本 = 新余额人民币成本 ÷ 新余额
```

消费时：

```text
本次消费成本 = 消耗金额 × 消费时平均成本
消费后余额 = 消费前余额 - 消耗金额
消费后余额人民币成本 = 消费前余额人民币成本 - 本次消费成本
```

## 敏感信息规则

以下字段必须加密保存：

- Apple ID 密码
- 密保答案
- 完整兑换码
- 平台 access token
- 平台 app secret
- API 密钥

以下字段默认脱敏展示：

- Apple ID 邮箱
- 手机号
- 备用邮箱
- 完整兑换码
- 密保答案
- 平台买家信息

查看、复制、导出敏感字段必须写 audit log。

## 状态字段要求

状态必须使用枚举，不允许随意字符串。

例如：

- Apple ID 状态：normal、need_verify、locked、password_error、risk、unknown
- 任务状态：pending、processing、waiting_customer、waiting_payment、waiting_auto_renewal、waiting_manual_verify、completed、cancelled、failed、abnormal、postponed
- 兑换码状态：unsold、locked、delivered、delivery_failed、after_sale、reissued、voided、refunded

## API 规则

- API 必须统一返回格式。
- 列表接口必须支持分页、搜索、排序。
- 创建、修改、删除操作必须写 audit log。
- 敏感字段接口必须单独做权限校验。
- 禁止在日志里输出密码、密保、完整兑换码、token。

## 前端规则

- 使用 Vue 3 + TypeScript + Element Plus。
- 所有列表页必须支持搜索、筛选、排序、分页。
- 敏感字段默认脱敏。
- 所有表单必须做基础校验。
- 权限不足时隐藏按钮并阻止 API 调用。
- 复杂状态要用标签展示，例如“可用/不可用/需确认”。

## 开发规则

- 每次只完成 docs/TASKS.md 中的一个明确任务。
- 不要一次性开发整个系统。
- 每个任务完成后必须说明：
  1. 修改了哪些文件
  2. 新增了哪些接口
  3. 新增了哪些表或字段
  4. 如何运行迁移
  5. 如何测试
  6. 是否存在未完成事项
- 每个业务 service 必须写基础单元测试。
- 所有数据库迁移必须通过 Prisma migration 管理。
- 不允许硬编码账号、密码、密钥、token。
- 环境变量写入 .env.example。

## 验收要求

每个阶段必须能独立运行和验收。

MVP 优先级：

1. 登录权限和操作日志
2. 客户和来源平台
3. Apple ID 管理
4. Apple ID 余额和平均成本
5. Apple ID 订单录入和自动匹配
6. Apple ID 续费任务中心
7. 兑换码批量导入和半自动发货
8. 淘宝/闲鱼自动发货
9. Apple ID 自动化任务中心
