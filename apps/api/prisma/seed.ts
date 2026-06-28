import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password-hasher';
import {
  buildOfficialPriceProviderPreset,
  OFFICIAL_PRICE_PROVIDER_KEYS,
  OFFICIAL_PRICE_PROVIDER_PROFILES
} from '../src/apple-official-prices/official-price-provider-catalog';

const prisma = new PrismaClient();

const appleAccountRegionDefaults = [
  {
    code: 'US',
    label: '美国',
    currency: 'USD',
    dialCode: '+1',
    phoneExample: '+1 415 555 2671'
  },
  {
    code: 'CN',
    label: '中国',
    currency: 'CNY',
    dialCode: '+86',
    phoneExample: '+86 138 0013 8000'
  },
  {
    code: 'MY',
    label: '马来西亚',
    currency: 'MYR',
    dialCode: '+60',
    phoneExample: '+60 12 345 6789'
  },
  {
    code: 'SG',
    label: '新加坡',
    currency: 'SGD',
    dialCode: '+65',
    phoneExample: '+65 8123 4567'
  },
  {
    code: 'HK',
    label: '中国香港',
    currency: 'HKD',
    dialCode: '+852',
    phoneExample: '+852 9123 4567'
  }
] as const;

const appleDefaultDictionaries = [
  ['apple.service.categories', 'default', '通用', '通用', 10, 'Apple ID 默认业务分类'],
  ['apple.service.categories', 'chatgpt', 'ChatGPT', 'ChatGPT', 20, 'ChatGPT 业务分类'],
  ['apple.service.categories', 'gemini', 'Gemini', 'Gemini', 30, 'Gemini 业务分类'],
  ['apple.service.categories', 'claude', 'Claude', 'Claude', 40, 'Claude 业务分类'],
  ['apple.service.period_types', 'month', '按月', 'month', 10, 'Apple ID 业务周期'],
  ['apple.service.period_types', 'day', '按天', 'day', 20, 'Apple ID 业务周期'],
  ['apple.service.period_types', 'manual', '手工', 'manual', 30, 'Apple ID 业务周期'],
  ['apple.service.expire_calc_types', 'by_month', '按月', 'by_month', 10, 'Apple ID 到期计算方式'],
  ['apple.service.expire_calc_types', 'by_day', '按天', 'by_day', 20, 'Apple ID 到期计算方式'],
  ['apple.service.expire_calc_types', 'manual', '手工', 'manual', 30, 'Apple ID 到期计算方式'],
  ['apple.service.lock_rules', 'by_service', '按业务锁定', 'by_service', 10, 'Apple ID 锁定规则'],
  ['apple.service.lock_rules', 'global', '全局锁定', 'global', 20, 'Apple ID 锁定规则'],
  ['apple.service.platform_fee_types', 'none', '无手续费', 'none', 10, 'Apple ID 平台手续费类型'],
  ['apple.service.platform_fee_types', 'rate', '比例', 'rate', 20, 'Apple ID 平台手续费类型'],
  ['apple.service.platform_fee_types', 'fixed', '固定', 'fixed', 30, 'Apple ID 平台手续费类型'],
  [
    'apple.service.platform_fee_types',
    'mixed',
    '比例 + 固定',
    'mixed',
    40,
    'Apple ID 平台手续费类型'
  ]
] as const;

const appleServiceTemplateDefaults = [
  {
    name: 'ChatGPT Plus 1个月',
    category: 'ChatGPT',
    currency: 'USD',
    officialBasePrice: '20',
    officialCostValue: '20',
    allowedRegions: ['US']
  },
  {
    name: 'ChatGPT Pro 1个月',
    category: 'ChatGPT',
    currency: 'USD',
    officialBasePrice: '200',
    officialCostValue: '200',
    allowedRegions: ['US']
  },
  {
    name: 'Google AI Pro 1个月',
    category: 'Gemini',
    currency: 'USD',
    officialBasePrice: '19.99',
    officialCostValue: '19.99',
    allowedRegions: ['US']
  },
  {
    name: 'Claude Pro 1个月',
    category: 'Claude',
    currency: 'USD',
    officialBasePrice: '20',
    officialCostValue: '20',
    allowedRegions: ['US']
  }
] as const;

const defaultOfficialPriceRegions = new Set(['US', 'MY', 'SG', 'HK']);

const roleDefinitions = [
  ['管理员', 'admin', '拥有全部权限'],
  ['客服', 'customer_service', '处理客户、订单录入和续费任务'],
  ['发货员', 'delivery_staff', '处理兑换码发货和售后补发'],
  ['财务', 'finance', '查看成本、利润、充值和消费记录'],
  ['运营', 'operation', '维护业务设置、来源平台和发货模板'],
  ['技术', 'technician', '查看系统日志和接口配置状态'],
  ['审计', 'auditor', '查看操作日志和权限变更记录']
] as const;

const defaultRolePermissionCodes = {
  customer_service: [
    'customer.view',
    'customer.create',
    'customer.update',
    'customer.view_phone',
    'source_platform.view',
    'attachment.view',
    'attachment.upload',
    'attachment.download',
    'apple.account.view',
    'apple.balance.view',
    'apple.order.view',
    'apple.order.create',
    'apple.order.update',
    'apple.activation.view',
    'apple.renewal_task.view',
    'apple.renewal_task.update',
    'apple.action_plan.view',
    'apple.action_plan.update'
  ],
  delivery_staff: [
    'customer.view',
    'source_platform.view',
    'attachment.view',
    'attachment.upload',
    'attachment.download',
    'code.batch.import',
    'code.inventory.view',
    'code.order.view',
    'code.order.create',
    'code.order.deliver',
    'code.delivery.view',
    'code.after_sale.view',
    'code.after_sale.manage'
  ],
  finance: [
    'customer.view',
    'source_platform.view',
    'apple.account.view',
    'apple.balance.view',
    'apple.cost.view',
    'apple.order.view',
    'apple.activation.view',
    'apple.report.view',
    'code.inventory.view',
    'code.order.view',
    'code.delivery.view',
    'code.cost.view',
    'code.profit.view',
    'code.report.view'
  ],
  operation: [
    'source_platform.view',
    'source_platform.manage',
    'data.dictionary.manage',
    'apple.service.manage',
    'apple.official_price.manage',
    'code.service.manage',
    'code.delivery_template.manage'
  ],
  technician: [
    'ops.overview.view',
    'ops.api_status.view',
    'ops.database_status.view',
    'ops.redis_status.view',
    'ops.queue_status.view',
    'ops.cron_job.view',
    'ops.platform_sync.view',
    'ops.worker_status.view',
    'ops.storage_status.view',
    'ops.disk_status.view',
    'ops.error_log.view',
    'ops.error_log.create',
    'ops.health_snapshot.create',
    'ops.platform.test_connection',
    'ops.platform.reauthorize',
    'notification.telegram.view'
  ],
  auditor: [
    'audit_log.view',
    'security.login_log.view',
    'security.abnormal_login.view',
    'security.sensitive_access_log.view',
    'security.sensitive_operation.view',
    'data.export.view',
    'notification.log.view'
  ]
} as const;

const permissionDefinitions = [
  ['查看客户', 'customer.view', 'customer', 'view'],
  ['新增客户', 'customer.create', 'customer', 'create'],
  ['编辑客户', 'customer.update', 'customer', 'update'],
  ['删除客户', 'customer.delete', 'customer', 'delete'],
  ['查看客户手机号', 'customer.view_phone', 'customer', 'view_phone'],
  ['查看来源平台', 'source_platform.view', 'source_platform', 'view'],
  ['管理来源平台', 'source_platform.manage', 'source_platform', 'manage'],
  ['管理发货模板', 'code.delivery_template.manage', 'code.delivery_template', 'manage'],
  ['管理消息模板（旧兼容）', 'message_template.manage', 'message_template', 'manage'],
  ['查看附件', 'attachment.view', 'attachment', 'view'],
  ['上传附件', 'attachment.upload', 'attachment', 'upload'],
  ['下载附件', 'attachment.download', 'attachment', 'download'],
  ['查看操作日志', 'audit_log.view', 'audit_log', 'view'],
  ['管理用户', 'system.user_manage', 'system', 'user_manage'],
  ['管理角色', 'system.role_manage', 'system', 'role_manage'],
  ['管理权限', 'system.permission_manage', 'system', 'permission_manage'],
  ['查看 Apple ID', 'apple.account.view', 'apple.account', 'view'],
  ['查看完整 Apple ID 账号', 'apple.account.view_full', 'apple.account', 'view_full'],
  ['新增 Apple ID', 'apple.account.create', 'apple.account', 'create'],
  ['编辑 Apple ID', 'apple.account.update', 'apple.account', 'update'],
  ['删除 Apple ID', 'apple.account.delete', 'apple.account', 'delete'],
  ['导入 Apple ID', 'apple.account.import', 'apple.account', 'import'],
  ['查看 Apple ID 密码', 'apple.secret.view_password', 'apple.secret', 'view_password'],
  ['查看 Apple ID 密保', 'apple.secret.view_security', 'apple.secret', 'view_security'],
  ['查看 Apple ID 手机号', 'apple.secret.view_phone', 'apple.secret', 'view_phone'],
  ['查看 Apple ID 备用邮箱', 'apple.secret.view_email', 'apple.secret', 'view_email'],
  ['查看 Apple ID 余额', 'apple.balance.view', 'apple.balance', 'view'],
  ['录入 Apple ID 充值', 'apple.balance.topup', 'apple.balance', 'topup'],
  ['修正 Apple ID 余额', 'apple.balance.adjust', 'apple.balance', 'adjust'],
  ['管理 Apple ID 业务设置', 'apple.service.manage', 'apple.service', 'manage'],
  ['管理 Apple ID 官方价格巡检', 'apple.official_price.manage', 'apple.official_price', 'manage'],
  [
    '查看 Apple ID 充值礼品卡尾号',
    'apple.topup.gift_code.view_tail',
    'apple.topup.gift_code',
    'view_tail'
  ],
  [
    '查看 Apple ID 充值完整礼品卡代码',
    'apple.topup.gift_code.view_full',
    'apple.topup.gift_code',
    'view_full'
  ],
  [
    '录入 Apple ID 充值礼品卡代码',
    'apple.topup.gift_code.create',
    'apple.topup.gift_code',
    'create'
  ],
  [
    '导出 Apple ID 充值礼品卡代码',
    'apple.topup.gift_code.export',
    'apple.topup.gift_code',
    'export'
  ],
  ['查看 Apple ID 成本', 'apple.cost.view', 'apple.cost', 'view'],
  ['查看 Apple ID 订单', 'apple.order.view', 'apple.order', 'view'],
  ['创建 Apple ID 订单', 'apple.order.create', 'apple.order', 'create'],
  ['编辑 Apple ID 订单', 'apple.order.update', 'apple.order', 'update'],
  ['删除 Apple ID 订单', 'apple.order.delete', 'apple.order', 'delete'],
  ['查看开通记录', 'apple.activation.view', 'apple.activation', 'view'],
  ['查看续费任务', 'apple.renewal_task.view', 'apple.renewal_task', 'view'],
  ['处理续费任务', 'apple.renewal_task.update', 'apple.renewal_task', 'update'],
  ['查看 Apple ID 操作计划', 'apple.action_plan.view', 'apple.action_plan', 'view'],
  ['处理 Apple ID 操作计划', 'apple.action_plan.update', 'apple.action_plan', 'update'],
  ['管理 Apple ID 自动化任务', 'apple.automation_task.manage', 'apple.automation_task', 'manage'],
  ['查看 Apple ID 报表', 'apple.report.view', 'apple.report', 'view'],
  ['管理兑换码业务', 'code.service.manage', 'code.service', 'manage'],
  ['导入兑换码批次', 'code.batch.import', 'code.batch', 'import'],
  ['查看兑换码库存', 'code.inventory.view', 'code.inventory', 'view'],
  ['查看完整兑换码', 'code.inventory.view_full', 'code.inventory', 'view_full'],
  ['作废兑换码', 'code.inventory.void', 'code.inventory', 'void'],
  ['查看兑换码订单', 'code.order.view', 'code.order', 'view'],
  ['手工导入兑换码订单', 'code.order.create', 'code.order', 'create'],
  ['兑换码发货', 'code.order.deliver', 'code.order', 'deliver'],
  ['查看发货记录', 'code.delivery.view', 'code.delivery', 'view'],
  ['查看售后补发', 'code.after_sale.view', 'code.after_sale', 'view'],
  ['管理售后补发', 'code.after_sale.manage', 'code.after_sale', 'manage'],
  ['查看兑换码成本', 'code.cost.view', 'code.cost', 'view'],
  ['查看兑换码利润', 'code.profit.view', 'code.profit', 'view'],
  ['查看兑换码报表', 'code.report.view', 'code.report', 'view'],
  ['查看通知总览', 'notification.view', 'notification', 'view'],
  ['查看通知规则', 'notification.rule.view', 'notification.rule', 'view'],
  ['管理通知规则', 'notification.rule.manage', 'notification.rule', 'manage'],
  ['查看通知模板', 'notification.template.view', 'notification.template', 'view'],
  ['管理通知模板', 'notification.template.manage', 'notification.template', 'manage'],
  ['查看通知日志', 'notification.log.view', 'notification.log', 'view'],
  ['查看 Telegram 配置', 'notification.telegram.view', 'notification.telegram', 'view'],
  ['管理 Telegram 配置', 'notification.telegram.manage', 'notification.telegram', 'manage'],
  ['测试发送 Telegram 通知', 'notification.telegram.test', 'notification.telegram', 'test'],
  ['查看安全总览', 'security.overview.view', 'security.overview', 'view'],
  ['查看登录日志', 'security.login_log.view', 'security.login_log', 'view'],
  ['查看在线会话', 'security.session.view', 'security.session', 'view'],
  ['强制下线会话', 'security.session.revoke', 'security.session', 'revoke'],
  ['管理 MFA 设置', 'security.mfa.manage', 'security.mfa', 'manage'],
  ['管理 IP 白名单', 'security.ip_whitelist.manage', 'security.ip_whitelist', 'manage'],
  ['管理密码策略', 'security.password_policy.manage', 'security.password_policy', 'manage'],
  [
    '查看敏感字段访问日志',
    'security.sensitive_access_log.view',
    'security.sensitive_access_log',
    'view'
  ],
  [
    '审批敏感字段访问',
    'security.sensitive_access_approval.manage',
    'security.sensitive_access_approval',
    'manage'
  ],
  ['查看异常登录记录', 'security.abnormal_login.view', 'security.abnormal_login', 'view'],
  ['查看敏感操作记录', 'security.sensitive_operation.view', 'security.sensitive_operation', 'view'],
  ['查看数据中心总览', 'data.overview.view', 'data.overview', 'view'],
  ['查看数据备份任务', 'data.backup.view', 'data.backup', 'view'],
  ['创建数据备份任务', 'data.backup.create', 'data.backup', 'create'],
  ['查看数据恢复任务', 'data.restore.view', 'data.restore', 'view'],
  ['创建数据恢复任务', 'data.restore.create', 'data.restore', 'create'],
  ['查看数据导入任务', 'data.import.view', 'data.import', 'view'],
  ['创建数据导入任务', 'data.import.create', 'data.import', 'create'],
  ['查看数据导出任务', 'data.export.view', 'data.export', 'view'],
  ['创建数据导出任务', 'data.export.create', 'data.export', 'create'],
  ['查看回收站', 'data.recycle_bin.view', 'data.recycle_bin', 'view'],
  ['恢复回收站数据', 'data.recycle_bin.restore', 'data.recycle_bin', 'restore'],
  ['管理数据清理任务', 'data.cleanup.manage', 'data.cleanup', 'manage'],
  ['管理重复数据合并任务', 'data.duplicate_merge.manage', 'data.duplicate_merge', 'manage'],
  ['管理数据字典', 'data.dictionary.manage', 'data.dictionary', 'manage'],
  ['管理系统参数', 'data.system_parameter.manage', 'data.system_parameter', 'manage'],
  ['查看运维总览', 'ops.overview.view', 'ops.overview', 'view'],
  ['查看 API 状态', 'ops.api_status.view', 'ops.api_status', 'view'],
  ['查看数据库状态', 'ops.database_status.view', 'ops.database_status', 'view'],
  ['查看 Redis 状态', 'ops.redis_status.view', 'ops.redis_status', 'view'],
  ['查看队列状态', 'ops.queue_status.view', 'ops.queue_status', 'view'],
  ['查看定时任务状态', 'ops.cron_job.view', 'ops.cron_job', 'view'],
  ['查看平台同步状态', 'ops.platform_sync.view', 'ops.platform_sync', 'view'],
  ['查看自动化 Worker 状态', 'ops.worker_status.view', 'ops.worker_status', 'view'],
  ['查看文件存储状态', 'ops.storage_status.view', 'ops.storage_status', 'view'],
  ['查看磁盘空间', 'ops.disk_status.view', 'ops.disk_status', 'view'],
  ['查看最近错误', 'ops.error_log.view', 'ops.error_log', 'view'],
  ['记录运维错误', 'ops.error_log.create', 'ops.error_log', 'create'],
  ['记录运维快照', 'ops.health_snapshot.create', 'ops.health_snapshot', 'create'],
  ['测试平台连接', 'ops.platform.test_connection', 'ops.platform', 'test_connection'],
  ['重新授权平台', 'ops.platform.reauthorize', 'ops.platform', 'reauthorize'],
  ['查看系统公告', 'maintenance.announcement.view', 'maintenance.announcement', 'view'],
  ['管理系统公告', 'maintenance.announcement.manage', 'maintenance.announcement', 'manage'],
  ['查看维护模式', 'maintenance.mode.view', 'maintenance.mode', 'view'],
  ['管理维护模式', 'maintenance.mode.manage', 'maintenance.mode', 'manage'],
  ['查看版本信息', 'maintenance.version.view', 'maintenance.version', 'view'],
  ['管理版本和更新日志', 'maintenance.version.manage', 'maintenance.version', 'manage'],
  ['查看功能开关', 'maintenance.feature_flag.view', 'maintenance.feature_flag', 'view'],
  ['管理功能开关', 'maintenance.feature_flag.manage', 'maintenance.feature_flag', 'manage'],
  ['管理菜单配置', 'maintenance.menu_config.manage', 'maintenance.menu_config', 'manage'],
  ['管理主题配置', 'maintenance.theme_config.manage', 'maintenance.theme_config', 'manage'],
  [
    '管理维护系统参数',
    'maintenance.system_parameter.manage',
    'maintenance.system_parameter',
    'manage'
  ]
] as const;

const notificationEventDefinitions = [
  ['业务到期前 3 天', 'apple.service.expiring_3d', 'apple', 'warning'],
  ['业务到期当天仍未处理', 'apple.service.expired_unhandled', 'apple', 'error'],
  ['客户确认续费但未收款', 'apple.payment.confirmed_unpaid', 'apple', 'warning'],
  ['客户确认不续费但未取消订阅', 'apple.no_renew_not_cancelled', 'apple', 'error'],
  ['Apple ID 余额不足', 'apple.balance.low', 'apple', 'warning'],
  [
    'Apple ID 余额足够但存在不续费业务未取消',
    'apple.balance.enough_has_no_renew_uncancelled',
    'apple',
    'warning'
  ],
  ['Apple ID 状态异常', 'apple.account.status_abnormal', 'apple', 'error'],
  ['自动检测失败', 'apple.automation.detect_failed', 'apple', 'error'],
  ['自动化任务需要人工验证', 'apple.automation.manual_verify_required', 'apple', 'warning'],
  ['自动续费扣费失败', 'apple.auto_renew.charge_failed', 'apple', 'error'],
  ['充值后余额和系统不一致', 'apple.balance.mismatch_after_topup', 'apple', 'error'],
  ['Apple ID 被手动锁定', 'apple.account.manually_locked', 'apple', 'warning'],
  ['兑换码低库存', 'code.inventory.low', 'code', 'warning'],
  ['某面值缺货', 'code.inventory.out_of_stock', 'code', 'error'],
  ['自动发货失败', 'code.delivery.failed', 'code', 'error'],
  ['发货后订单退款', 'code.order.refunded_after_delivery', 'code', 'warning'],
  ['兑换码重复导入', 'code.import.duplicate', 'code', 'warning'],
  ['批量导入失败', 'code.import.failed', 'code', 'error'],
  ['兑换码锁定超时', 'code.lock.timeout', 'code', 'warning'],
  ['售后补发失败', 'code.after_sale.reissue_failed', 'code', 'error'],
  ['平台授权即将过期', 'platform.auth.expiring', 'platform', 'warning'],
  ['平台授权已失效', 'platform.auth.invalid', 'platform', 'critical'],
  ['Webhook 异常', 'platform.webhook.abnormal', 'platform', 'error'],
  ['发货接口异常', 'platform.delivery_api.abnormal', 'platform', 'error'],
  ['异常登录', 'security.login.abnormal', 'security', 'warning'],
  ['连续登录失败', 'security.login.failed_many', 'security', 'warning'],
  ['权限被修改', 'security.permission.modified', 'security', 'warning'],
  ['角色权限变更', 'security.role_permission.changed', 'security', 'warning'],
  ['批量导出数据', 'security.data_export.large', 'security', 'warning'],
  ['查看大量敏感信息', 'security.sensitive_view.large', 'security', 'warning'],
  ['备份失败', 'ops.backup.failed', 'ops', 'error'],
  ['数据库连接异常', 'ops.database.connection_abnormal', 'ops', 'critical'],
  ['队列积压严重', 'ops.queue.backlog', 'ops', 'warning'],
  ['磁盘空间不足', 'ops.disk.low', 'ops', 'critical']
] as const;

async function seedNotificationDefaults() {
  await prisma.notificationChannel.upsert({
    where: { code: 'system' },
    update: {
      name: '站内通知',
      type: 'in_app',
      enabled: true,
      level: 'info'
    },
    create: {
      name: '站内通知',
      code: 'system',
      type: 'in_app',
      enabled: true,
      level: 'info'
    }
  });

  await prisma.notificationChannel.upsert({
    where: { code: 'telegram' },
    update: {
      name: 'Telegram',
      type: 'telegram',
      level: 'warning'
    },
    create: {
      name: 'Telegram',
      code: 'telegram',
      type: 'telegram',
      enabled: false,
      level: 'warning'
    }
  });

  for (const [name, eventCode, module, level] of notificationEventDefinitions) {
    const rule = await prisma.notificationRule.upsert({
      where: { eventCode },
      update: {
        name,
        module,
        level,
        channels: ['system']
      },
      create: {
        name,
        eventCode,
        module,
        level,
        enabled: true,
        channels: ['system'],
        rateLimit: {
          intervalMinutes: 10,
          scope: 'event'
        }
      }
    });

    await prisma.notificationTemplate.upsert({
      where: {
        eventCode_channel: {
          eventCode,
          channel: 'system'
        }
      },
      update: {
        name: `${name}站内模板`,
        ruleId: rule.id,
        title: `{{title}}`,
        content: `{{summary}}\n{{detail}}`,
        variables: ['title', 'summary', 'detail'],
        enabled: true
      },
      create: {
        name: `${name}站内模板`,
        eventCode,
        ruleId: rule.id,
        channel: 'system',
        title: `{{title}}`,
        content: `{{summary}}\n{{detail}}`,
        variables: ['title', 'summary', 'detail'],
        enabled: true
      }
    });
  }
}

async function seedSecurityDefaults() {
  await prisma.securitySetting.upsert({
    where: { key: 'password_policy' },
    update: {},
    create: {
      key: 'password_policy',
      value: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: false,
        expireDays: 0,
        maxFailedAttempts: 5
      },
      remark: '默认密码策略'
    }
  });

  await prisma.securitySetting.upsert({
    where: { key: 'mfa_settings' },
    update: {},
    create: {
      key: 'mfa_settings',
      value: {
        enabled: false,
        requiredForAdmins: false,
        issuer: '代充管理后台'
      },
      remark: '默认 MFA 设置'
    }
  });
}

async function seedDataCenterDefaults() {
  const parameters = [
    ['backup_retention_days', 'data', { days: 30 }, '备份文件默认保留天数'],
    ['export_download_ttl_hours', 'data', { hours: 24 }, '导出文件默认下载有效期'],
    ['recycle_bin_retention_days', 'data', { days: 30 }, '回收站数据默认保留天数'],
    ['import_max_file_size_mb', 'data', { sizeMb: 20 }, '导入文件默认大小限制']
  ] as const;

  for (const [key, group, value, remark] of parameters) {
    await prisma.systemParameter.upsert({
      where: { key },
      update: {},
      create: {
        key,
        group,
        value,
        remark
      }
    });
  }

  const dictionaries = [
    ['data_job_status', 'pending', '待处理', 'pending', 10],
    ['data_job_status', 'running', '运行中', 'running', 20],
    ['data_job_status', 'success', '成功', 'success', 30],
    ['data_job_status', 'failed', '失败', 'failed', 40],
    ['data_job_status', 'cancelled', '已取消', 'cancelled', 50],
    ['business_module', 'apple', 'Apple ID 业务', 'apple', 10],
    ['business_module', 'code', '兑换码业务', 'code', 20],
    ['business_module', 'common', '公共模块', 'common', 30],
    ['business_module', 'system', '系统模块', 'system', 40]
  ] as const;

  for (const [group, code, label, value, sortOrder] of dictionaries) {
    await prisma.dataDictionary.upsert({
      where: {
        group_code: {
          group,
          code
        }
      },
      update: {
        label,
        value,
        sortOrder,
        status: 'active'
      },
      create: {
        group,
        code,
        label,
        value,
        sortOrder,
        status: 'active'
      }
    });
  }
}

async function seedAppleSettingsDefaults() {
  await prisma.systemParameter.upsert({
    where: { key: 'apple_balance_price_rule' },
    update: {},
    create: {
      key: 'apple_balance_price_rule',
      group: 'apple',
      value: {
        ruleType: 'percent',
        ruleValue: '1'
      },
      remark: 'Apple ID 余额价全局默认规则'
    }
  });

  for (const [group, code, label, value, sortOrder, remark] of appleDefaultDictionaries) {
    await prisma.dataDictionary.upsert({
      where: {
        group_code: {
          group,
          code
        }
      },
      update: {},
      create: {
        group,
        code,
        label,
        value,
        sortOrder,
        status: 'active',
        remark
      }
    });
  }

  for (const [sortOrder, region] of appleAccountRegionDefaults.entries()) {
    await prisma.dataDictionary.upsert({
      where: {
        group_code: {
          group: 'apple.account.regions',
          code: region.code
        }
      },
      update: {},
      create: {
        group: 'apple.account.regions',
        code: region.code,
        label: region.label,
        value: JSON.stringify({
          currency: region.currency,
          dialCode: region.dialCode,
          phoneExample: region.phoneExample
        }),
        sortOrder: (sortOrder + 1) * 10,
        status: 'active',
        remark: 'Apple ID 默认地区，可在快捷设置里调整显示名称、币种和手机号区号'
      }
    });
  }

  await seedOfficialPriceSourceDefaults();
  await seedAppleServiceTemplateDefaults();
}

async function seedOfficialPriceSourceDefaults() {
  for (const provider of OFFICIAL_PRICE_PROVIDER_KEYS) {
    const regions = OFFICIAL_PRICE_PROVIDER_PROFILES[provider].defaultRegions.filter((region) =>
      defaultOfficialPriceRegions.has(region.region)
    );

    for (const region of regions) {
      const preset = buildOfficialPriceProviderPreset(provider, region);
      const existing = await prisma.appleOfficialPriceSource.findFirst({
        where: {
          deletedAt: null,
          provider: preset.provider,
          region: preset.region,
          currency: preset.currency
        },
        select: { id: true }
      });

      if (existing) {
        continue;
      }

      await prisma.appleOfficialPriceSource.create({
        data: {
          name: preset.name,
          provider: preset.provider,
          priceSourceType: 'official_web',
          region: preset.region,
          currency: preset.currency,
          sourceUrl: preset.sourceUrl,
          collectMethod: 'webpage',
          checkIntervalHours: preset.checkIntervalHours,
          status: 'enabled',
          remark: preset.remark
        }
      });
    }
  }
}

async function seedAppleServiceTemplateDefaults() {
  const existingServiceCount = await prisma.appleService.count({
    where: { deletedAt: null }
  });

  if (existingServiceCount > 0) {
    return;
  }

  for (const service of appleServiceTemplateDefaults) {
    await prisma.appleService.create({
      data: {
        name: service.name,
        category: service.category,
        defaultPrice: '0',
        officialBasePrice: service.officialBasePrice,
        officialCostValue: service.officialCostValue,
        appleBalancePriceRuleType: 'inherit',
        currency: service.currency,
        defaultPeriodType: 'month',
        defaultPeriodValue: 1,
        expireCalcType: 'by_month',
        requireAppleId: true,
        requireServiceAccount: false,
        autoMatchAppleId: true,
        lockRule: 'by_service',
        allowedRegions: [...service.allowedRegions],
        minBalanceRequired: '0',
        status: 'paused',
        remark: '系统初始化业务模板，确认售价、成本和地区后再启用。'
      }
    });
  }
}

async function seedMaintenanceDefaults() {
  const parameters = [
    [
      'maintenance_menu_config',
      'maintenance',
      {
        collapsed: false,
        showPhaseBadge: true,
        hiddenModuleKeys: []
      },
      '后台菜单配置'
    ],
    [
      'maintenance_theme_config',
      'maintenance',
      {
        theme: 'light',
        density: 'default',
        primaryColor: '#2563eb'
      },
      '后台主题配置'
    ],
    [
      'maintenance_system_parameters',
      'maintenance',
      {
        defaultPageSize: 20,
        maxExportRows: 5000,
        supportContact: ''
      },
      '网站维护系统参数'
    ]
  ] as const;

  for (const [key, group, value, remark] of parameters) {
    await prisma.systemParameter.upsert({
      where: { key },
      update: {},
      create: {
        key,
        group,
        value,
        remark
      }
    });
  }

  const featureFlags = [
    [
      'apple_automation_worker',
      'Apple ID 自动化 Worker',
      false,
      '真实自动化 Worker 接入前保持关闭'
    ],
    ['sensitive_export', '敏感数据导出', false, '默认关闭包含敏感字段的批量导出']
  ] as const;

  for (const [key, name, enabled, remark] of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name,
        enabled,
        config: {},
        remark
      }
    });
  }

  await prisma.appVersion.upsert({
    where: { version: '0.1.0' },
    update: {},
    create: {
      version: '0.1.0',
      title: '后台基础底座',
      status: 'released',
      releaseNotes: '完成后台基础设计、权限、安全中心、数据中心、运维监控和网站维护底座。',
      impactModules: ['system', 'admin'],
      releasedAt: new Date()
    }
  });
}

async function main() {
  const permissions = await Promise.all(
    permissionDefinitions.map(([name, code, module, action]) =>
      prisma.permission.upsert({
        where: { code },
        update: { name, module, action },
        create: { name, code, module, action }
      })
    )
  );

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: { name: '管理员', description: '拥有全部权限' },
    create: { name: '管理员', code: 'admin', description: '拥有全部权限' }
  });

  for (const [name, code, description] of roleDefinitions.filter((role) => role[1] !== 'admin')) {
    await prisma.role.upsert({
      where: { code },
      update: { name, description },
      create: { name, code, description }
    });
  }

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      })
    )
  );

  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]));
  const businessRoles = await prisma.role.findMany({
    where: {
      code: {
        in: Object.keys(defaultRolePermissionCodes)
      }
    }
  });
  const roleByCode = new Map(businessRoles.map((role) => [role.code, role]));

  for (const [roleCode, permissionCodes] of Object.entries(defaultRolePermissionCodes)) {
    const role = roleByCode.get(roleCode);

    if (!role) {
      throw new Error(`Default role ${roleCode} was not seeded`);
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionByCode.get(permissionCode);

      if (!permission) {
        throw new Error(`Default role permission ${permissionCode} does not exist`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  await seedNotificationDefaults();
  await seedSecurityDefaults();
  await seedDataCenterDefaults();
  await seedAppleSettingsDefaults();
  await seedMaintenanceDefaults();

  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const shouldResetAdminPassword = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';

  if (!adminUsername || !adminPassword) {
    return;
  }

  const adminPasswordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      ...(shouldResetAdminPassword ? { passwordHash: adminPasswordHash } : {}),
      displayName: process.env.SEED_ADMIN_DISPLAY_NAME ?? '管理员'
    },
    create: {
      username: adminUsername,
      passwordHash: adminPasswordHash,
      displayName: process.env.SEED_ADMIN_DISPLAY_NAME ?? '管理员'
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
