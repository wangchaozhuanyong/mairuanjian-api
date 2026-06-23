import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  NotificationLevel,
  NotificationLog,
  NotificationLogStatus,
  Prisma,
  TelegramConfig
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateInAppNotificationDto } from './dto/create-in-app-notification.dto';
import type { SaveNotificationRuleDto } from './dto/save-notification-rule.dto';
import type { SaveNotificationTemplateDto } from './dto/save-notification-template.dto';
import type { SaveTelegramConfigDto } from './dto/save-telegram-config.dto';
import type { TestTelegramDto } from './dto/test-telegram.dto';

interface ListRulesQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  level?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListTemplatesQuery extends PaginationQuery {
  keyword?: string;
  eventCode?: string;
  channel?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListLogsQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  eventCode?: string;
  channel?: string;
  status?: string;
  unread?: string;
  sortBy?: string;
  sortOrder?: string;
}

type NavBadgeSectionKey =
  | 'workspace'
  | 'common'
  | 'id-business'
  | 'codes'
  | 'security'
  | 'data-audit'
  | 'ops-platform'
  | 'system-config';

const NAV_BADGE_SECTION_LABELS: Record<NavBadgeSectionKey, string> = {
  workspace: '工作台',
  common: '客户与来源',
  'id-business': 'ID 业务',
  codes: '兑换码业务',
  security: '安全与风控',
  'data-audit': '数据与审计',
  'ops-platform': '运维与平台',
  'system-config': '系统配置'
};

const NAV_BADGE_MODULE_SECTION_MAP: Record<string, NavBadgeSectionKey> = {
  attachment: 'data-audit',
  customer: 'common',
  customers: 'common',
  delivery_template: 'codes',
  message_template: 'codes',
  notification: 'system-config',
  source_platform: 'common',

  apple: 'id-business',
  apple_account: 'id-business',
  apple_action_plan: 'id-business',
  apple_automation_task: 'id-business',
  apple_balance: 'id-business',
  apple_order: 'id-business',
  apple_service: 'id-business',

  code: 'codes',
  code_after_sale: 'codes',
  code_order: 'codes',
  code_platform_mapping: 'codes',
  code_service: 'codes',
  redeem_code: 'codes',

  auth: 'security',
  security: 'security',

  audit_log: 'data-audit',
  data: 'data-audit',

  ops: 'ops-platform',
  platform: 'ops-platform',

  maintenance: 'system-config',
  system: 'system-config',
  table_view: 'system-config'
};

const NAV_BADGE_SECTION_MODULES = Object.entries(NAV_BADGE_MODULE_SECTION_MAP).reduce(
  (sections, [module, section]) => {
    sections[section].push(module);
    return sections;
  },
  {
    workspace: [],
    common: [],
    'id-business': [],
    codes: [],
    security: [],
    'data-audit': [],
    'ops-platform': [],
    'system-config': []
  } as Record<NavBadgeSectionKey, string[]>
);

const NAV_BADGE_ACTIONABLE_STATUSES = new Set<NotificationLogStatus>(['pending', 'failed']);
const NOTIFICATION_OVERVIEW_CACHE_TTL_MS = 120_000;
const NOTIFICATION_NAV_BADGE_CACHE_TTL_MS = 120_000;

type NavItemBadgeTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';

interface NavItemBadgeInput {
  itemKey: string;
  label: string;
  count: number;
  tone?: NavItemBadgeTone;
  description?: string;
}

interface NavBadgeAggregateRow {
  sectionKey: NavBadgeSectionKey;
  status: NotificationLogStatus;
  count: bigint | number | string;
}

const OPEN_RENEWAL_TASK_STATUSES = [
  'pending',
  'processing',
  'waiting_customer',
  'waiting_payment',
  'waiting_auto_renewal',
  'waiting_manual_verify',
  'failed',
  'abnormal'
] as const;

const OPEN_DATA_JOB_STATUSES = ['pending', 'running', 'failed'] as const;

const NOTIFICATION_RULE_SORT_FIELDS: Record<
  string,
  keyof Prisma.NotificationRuleOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  eventCode: 'eventCode',
  module: 'module',
  level: 'level',
  enabled: 'enabled',
  lastTriggeredAt: 'lastTriggeredAt'
};

const NOTIFICATION_TEMPLATE_SORT_FIELDS: Record<
  string,
  keyof Prisma.NotificationTemplateOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  eventCode: 'eventCode',
  channel: 'channel',
  title: 'title',
  enabled: 'enabled'
};

const NOTIFICATION_LOG_SORT_FIELDS: Record<
  string,
  keyof Prisma.NotificationLogOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  triggeredAt: 'triggeredAt',
  sentAt: 'sentAt',
  title: 'title',
  eventCode: 'eventCode',
  module: 'module',
  channel: 'channel',
  status: 'status',
  recipient: 'recipient',
  errorMessage: 'errorMessage',
  retryCount: 'retryCount'
};

export interface TriggerNotificationEventInput {
  eventCode: string;
  module: string;
  level?: NotificationLevel;
  title: string;
  content: string;
  recipient?: string | null;
  recipientUserId?: string | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  private readonly responseCache = new TimedMemoryCache();
  private defaultChannelsEnsured = false;
  private defaultChannelsEnsurePromise?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async overview(operator?: AuthenticatedUser) {
    return this.responseCache.getOrSet(
      this.getOperatorCacheKey('overview', operator),
      NOTIFICATION_OVERVIEW_CACHE_TTL_MS,
      async () => {
        this.ensureDefaultChannelsInBackground();

        const [enabledRuleCount, failedLogCount, unreadCount, telegramCount, recentLogs] =
          await Promise.all([
            this.prisma.notificationRule.count({
              where: { deletedAt: null, enabled: true }
            }),
            this.prisma.notificationLog.count({
              where: { status: 'failed' }
            }),
            this.prisma.notificationLog.count({
              where: this.getInAppWhere({ unread: 'true' }, operator)
            }),
            this.prisma.telegramConfig.count({
              where: { deletedAt: null, enabled: true }
            }),
            this.prisma.notificationLog.findMany({
              take: 8,
              orderBy: { createdAt: 'desc' }
            })
          ]);

        return {
          enabledRuleCount,
          failedLogCount,
          unreadCount,
          telegramCount,
          recentLogs: recentLogs.map((log) => this.toLogResponse(log))
        };
      }
    );
  }

  async navBadges(operator?: AuthenticatedUser) {
    return this.responseCache.getOrSet(
      this.getOperatorCacheKey('nav-badges', operator),
      NOTIFICATION_NAV_BADGE_CACHE_TTL_MS,
      async () => {
        const rows = await this.getNavBadgeAggregateRows(operator);

        const itemMap = new Map(
          Object.entries(NAV_BADGE_SECTION_LABELS).map(([sectionKey, label]) => [
            sectionKey,
            {
              sectionKey,
              label,
              count: 0,
              todoCount: 0,
              failedCount: 0
            }
          ])
        );

        for (const row of rows) {
          const item = itemMap.get(row.sectionKey);

          if (!item) {
            continue;
          }

          const count = Number(row.count);
          item.count += count;

          if (NAV_BADGE_ACTIONABLE_STATUSES.has(row.status)) {
            item.todoCount += count;
          }

          if (row.status === 'failed') {
            item.failedCount += count;
          }
        }

        const items = [...itemMap.values()].filter((item) => item.count > 0);

        return {
          totalCount: items.reduce((sum, item) => sum + item.count, 0),
          todoCount: items.reduce((sum, item) => sum + item.todoCount, 0),
          failedCount: items.reduce((sum, item) => sum + item.failedCount, 0),
          items,
          generatedAt: new Date().toISOString()
        };
      }
    );
  }

  async navItemBadges(operator?: AuthenticatedUser) {
    return this.responseCache.getOrSet(
      this.getOperatorCacheKey('nav-item-badges', operator),
      NOTIFICATION_NAV_BADGE_CACHE_TTL_MS,
      async () => {
        const now = new Date();
        const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const openRenewalWhere: Prisma.RenewalTaskWhereInput = {
          status: { in: [...OPEN_RENEWAL_TASK_STATUSES] }
        };
        const pendingOrFailedNotificationWhere: Prisma.NotificationLogWhereInput = {
          ...this.getInAppWhere({ unread: 'true' }, operator),
          status: { in: ['pending', 'sent', 'failed'] }
        };

        const [
          renewal,
          renewalCancel,
          renewalTopup,
          renewalWaitingAuto,
          actionPlans,
          appleAccounts,
          appleOrders,
          appleAutomation,
          codeOrders,
          deliveryExceptions,
          afterSales,
          notifications,
          sensitiveApprovals,
          backupJobs,
          restoreJobs,
          importJobs,
          exportJobs,
          cleanupJobs,
          duplicateMergeJobs,
          queueIncidents,
          cronIncidents,
          errorIncidents,
          healthIncidents,
          platformIncidents,
          launchChecklistParameter
        ] = await Promise.all([
          this.prisma.renewalTask.count({ where: openRenewalWhere }),
          this.prisma.renewalTask.count({
            where: {
              ...openRenewalWhere,
              OR: [
                { taskType: 'cancel_subscription' },
                { customerDecision: 'confirmed_no_renewal' }
              ]
            }
          }),
          this.prisma.renewalTask.count({
            where: {
              ...openRenewalWhere,
              taskType: 'topup_apple_balance'
            }
          }),
          this.prisma.renewalTask.count({
            where: {
              ...openRenewalWhere,
              OR: [
                { taskType: { in: ['wait_auto_renewal', 'check_renewal_result'] } },
                { status: 'waiting_auto_renewal' }
              ]
            }
          }),
          this.prisma.appleAccountActionPlan.count({
            where: { status: { in: ['pending', 'processing', 'abnormal'] } }
          }),
          this.prisma.appleAccount.count({
            where: {
              deletedAt: null,
              OR: [
                { status: { in: ['need_verify', 'locked', 'password_error', 'risk'] } },
                { isManuallyLocked: true }
              ]
            }
          }),
          this.prisma.appleOrder.count({
            where: { deletedAt: null, status: { in: ['pending', 'abnormal'] } }
          }),
          this.prisma.automationTask.count({
            where: {
              OR: [
                { manualRequired: true },
                { status: { in: ['failed', 'need_review', 'waiting_manual_verify'] } }
              ]
            }
          }),
          this.prisma.codePlatformOrder.count({
            where: { deliveryStatus: 'pending' }
          }),
          this.prisma.codePlatformOrder.count({
            where: { deliveryStatus: { in: ['failed', 'manual'] } }
          }),
          this.prisma.codeAfterSale.count({
            where: { status: 'pending' }
          }),
          this.prisma.notificationLog.count({
            where: pendingOrFailedNotificationWhere
          }),
          this.prisma.sensitiveAccessApproval.count({
            where: {
              status: 'pending',
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            }
          }),
          this.prisma.backupJob.count({ where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } } }),
          this.prisma.restoreJob.count({ where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } } }),
          this.prisma.dataImportJob.count({
            where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } }
          }),
          this.prisma.dataExportJob.count({
            where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } }
          }),
          this.prisma.dataCleanupJob.count({
            where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } }
          }),
          this.prisma.duplicateMergeJob.count({
            where: { status: { in: [...OPEN_DATA_JOB_STATUSES] } }
          }),
          this.prisma.queueStatusLog.count({
            where: {
              status: { in: ['warning', 'error', 'critical'] },
              checkedAt: { gte: recentSince }
            }
          }),
          this.prisma.cronJobLog.count({
            where: { status: 'failed', createdAt: { gte: recentSince } }
          }),
          this.prisma.errorLog.count({
            where: { level: { in: ['error', 'fatal'] }, occurredAt: { gte: recentSince } }
          }),
          this.prisma.systemHealthSnapshot.count({
            where: {
              checkedAt: { gte: recentSince },
              OR: [
                { apiStatus: { in: ['warning', 'error', 'critical'] } },
                { dbStatus: { in: ['warning', 'error', 'critical'] } },
                { redisStatus: { in: ['warning', 'error', 'critical'] } },
                { storageStatus: { in: ['warning', 'error', 'critical'] } },
                { queueStatus: { in: ['warning', 'error', 'critical'] } },
                { workerStatus: { in: ['warning', 'error', 'critical'] } }
              ]
            }
          }),
          this.prisma.platformSyncLog.count({
            where: { status: 'failed', createdAt: { gte: recentSince } }
          }),
          this.prisma.systemParameter.findUnique({
            where: { key: 'maintenance_launch_checklist' }
          })
        ]);

        const dataCenter = backupJobs + restoreJobs + cleanupJobs + duplicateMergeJobs;
        const opsMonitor = queueIncidents + cronIncidents + errorIncidents + healthIncidents;
        const launchAudit = this.countLaunchChecklistOpenItems(launchChecklistParameter?.value);
        const items = [
          this.createNavItemBadge({
            itemKey: 'renewal',
            label: '续费工作台',
            count: renewal,
            tone: renewal > 0 ? 'orange' : 'neutral',
            description: '未完成续费任务'
          }),
          this.createNavItemBadge({
            itemKey: 'renewal-cancel',
            label: '待取消订阅',
            count: renewalCancel,
            tone: renewalCancel > 0 ? 'red' : 'neutral',
            description: '需要取消订阅的任务'
          }),
          this.createNavItemBadge({
            itemKey: 'renewal-topup',
            label: '待充值续费',
            count: renewalTopup,
            tone: renewalTopup > 0 ? 'orange' : 'neutral',
            description: '需要充值后处理的续费任务'
          }),
          this.createNavItemBadge({
            itemKey: 'renewal-waiting-auto',
            label: '等待自动续费',
            count: renewalWaitingAuto,
            tone: renewalWaitingAuto > 0 ? 'orange' : 'neutral',
            description: '等待自动扣费或续费结果检查'
          }),
          this.createNavItemBadge({
            itemKey: 'action-plans',
            label: 'ID 操作计划',
            count: actionPlans,
            tone: actionPlans > 0 ? 'orange' : 'neutral',
            description: '未完成或异常的 ID 操作计划'
          }),
          this.createNavItemBadge({
            itemKey: 'launch-audit',
            label: '上线检查清单',
            count: launchAudit,
            tone: launchAudit > 0 ? 'red' : 'neutral',
            description: '未通过、阻塞或待确认的上线检查项'
          }),
          this.createNavItemBadge({
            itemKey: 'apple-list',
            label: 'Apple ID 管理',
            count: appleAccounts,
            tone: appleAccounts > 0 ? 'red' : 'neutral',
            description: '需要验证、锁定、密码错误或风险状态的 Apple ID'
          }),
          this.createNavItemBadge({
            itemKey: 'apple-orders',
            label: '订单管理',
            count: appleOrders,
            tone: appleOrders > 0 ? 'red' : 'neutral',
            description: '待处理或异常的 Apple ID 订单'
          }),
          this.createNavItemBadge({
            itemKey: 'apple-automation',
            label: 'ID 自动化任务',
            count: appleAutomation,
            tone: appleAutomation > 0 ? 'red' : 'neutral',
            description: '失败、需复核或等待人工验证的自动化任务'
          }),
          this.createNavItemBadge({
            itemKey: 'code-orders',
            label: '兑换码订单',
            count: codeOrders,
            tone: codeOrders > 0 ? 'orange' : 'neutral',
            description: '待发货的兑换码订单'
          }),
          this.createNavItemBadge({
            itemKey: 'delivery-exceptions',
            label: '发货异常',
            count: deliveryExceptions,
            tone: deliveryExceptions > 0 ? 'red' : 'neutral',
            description: '发货失败或已转人工的兑换码订单'
          }),
          this.createNavItemBadge({
            itemKey: 'after-sales',
            label: '售后补发',
            count: afterSales,
            tone: afterSales > 0 ? 'red' : 'neutral',
            description: '待处理售后补发'
          }),
          this.createNavItemBadge({
            itemKey: 'notifications',
            label: '通知设置',
            count: notifications,
            tone: notifications > 0 ? 'orange' : 'neutral',
            description: '未读、待发送或失败通知'
          }),
          this.createNavItemBadge({
            itemKey: 'sensitive-approvals',
            label: '敏感审批',
            count: sensitiveApprovals,
            tone: sensitiveApprovals > 0 ? 'red' : 'neutral',
            description: '待审批敏感信息查看请求'
          }),
          this.createNavItemBadge({
            itemKey: 'data-center',
            label: '数据中心',
            count: dataCenter,
            tone: dataCenter > 0 ? 'orange' : 'neutral',
            description: '备份、恢复、清理或合并任务待处理'
          }),
          this.createNavItemBadge({
            itemKey: 'data-imports',
            label: '数据导入',
            count: importJobs,
            tone: importJobs > 0 ? 'orange' : 'neutral',
            description: '导入任务待处理、执行中或失败'
          }),
          this.createNavItemBadge({
            itemKey: 'data-exports',
            label: '数据导出',
            count: exportJobs,
            tone: exportJobs > 0 ? 'orange' : 'neutral',
            description: '导出任务待处理、执行中或失败'
          }),
          this.createNavItemBadge({
            itemKey: 'ops-monitor',
            label: '运维监控',
            count: opsMonitor,
            tone: opsMonitor > 0 ? 'red' : 'neutral',
            description: '近 24 小时队列、定时任务、错误或健康检查异常'
          }),
          this.createNavItemBadge({
            itemKey: 'platform-status',
            label: '平台接口状态',
            count: platformIncidents,
            tone: platformIncidents > 0 ? 'red' : 'neutral',
            description: '近 24 小时平台同步失败'
          })
        ].filter((item) => item.count > 0);

        return {
          totalCount: items.reduce((sum, item) => sum + item.count, 0),
          items,
          generatedAt: new Date().toISOString()
        };
      }
    );
  }

  async listInApp(query: ListLogsQuery, operator?: AuthenticatedUser) {
    const pagination = getPagination(query);
    const where = this.getInAppWhere(query, operator);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.notificationLog.count({ where })
    ]);

    return {
      items: items.map((item) => this.toLogResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getNotification(id: string) {
    const log = await this.findLogOrThrow(id);
    return this.toLogResponse(log);
  }

  async markRead(id: string, operator?: AuthenticatedUser) {
    const log = await this.findLogOrThrow(id);
    const updated = await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        readAt: new Date(),
        readByUserId: operator?.id
      }
    });

    this.responseCache.clear();
    return this.toLogResponse(updated);
  }

  async markAllRead(operator?: AuthenticatedUser) {
    const where = this.getInAppWhere({ unread: 'true' }, operator);
    const result = await this.prisma.notificationLog.updateMany({
      where,
      data: {
        readAt: new Date(),
        readByUserId: operator?.id
      }
    });

    this.responseCache.clear();
    return {
      updatedCount: result.count
    };
  }

  async listRules(query: ListRulesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const level = this.parseLevel(query.level, false);
    const enabled = this.parseBoolean(query.enabled);
    const where: Prisma.NotificationRuleWhereInput = {
      deletedAt: null,
      module: query.module || undefined,
      level: level ?? undefined,
      enabled,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { eventCode: { contains: keyword, mode: 'insensitive' } },
            { module: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationRule.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildRuleOrderBy(query),
        include: {
          templates: {
            where: { deletedAt: null },
            orderBy: { channel: 'asc' }
          }
        }
      }),
      this.prisma.notificationRule.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getRule(id: string) {
    const rule = await this.prisma.notificationRule.findFirst({
      where: { id, deletedAt: null },
      include: {
        templates: {
          where: { deletedAt: null },
          orderBy: { channel: 'asc' }
        }
      }
    });

    if (!rule) {
      throw new NotFoundException('Notification rule not found');
    }

    return rule;
  }

  private buildRuleOrderBy(
    query: ListRulesQuery
  ): Prisma.NotificationRuleOrderByWithRelationInput[] {
    const sortField = query.sortBy ? NOTIFICATION_RULE_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ enabled: 'desc' }, { module: 'asc' }, { createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createRule(dto: SaveNotificationRuleDto, operator?: AuthenticatedUser) {
    const name = this.normalizeRequiredString(dto.name, 'name');
    const eventCode = this.normalizeCode(dto.eventCode, 'eventCode');
    const module = this.normalizeRequiredString(dto.module, 'module');
    const existingRule = await this.prisma.notificationRule.findUnique({
      where: { eventCode }
    });

    if (existingRule && !existingRule.deletedAt) {
      throw new ConflictException('Notification rule eventCode already exists');
    }

    const rule = await this.prisma.notificationRule.create({
      data: {
        name,
        eventCode,
        module,
        level: this.parseLevel(dto.level ?? 'info', true),
        enabled: dto.enabled ?? true,
        channels: this.normalizeChannels(dto.channels),
        recipients: this.toNullableJson(dto.recipients),
        triggerCondition: this.toNullableJson(dto.triggerCondition),
        rateLimit: this.toNullableJson(dto.rateLimit)
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.rule.create',
      objectType: 'notification_rule',
      objectId: rule.id,
      afterData: this.toAuditJson(rule),
      remark: `Created notification rule ${rule.eventCode}`
    });

    return this.getRule(rule.id);
  }

  async updateRule(
    id: string,
    dto: Partial<SaveNotificationRuleDto>,
    operator?: AuthenticatedUser
  ) {
    const rule = await this.getRule(id);
    const data: Prisma.NotificationRuleUpdateInput = {};

    if (dto.name !== undefined) data.name = this.normalizeRequiredString(dto.name, 'name');
    if (dto.eventCode !== undefined)
      data.eventCode = this.normalizeCode(dto.eventCode, 'eventCode');
    if (dto.module !== undefined) data.module = this.normalizeRequiredString(dto.module, 'module');
    if (dto.level !== undefined) data.level = this.parseLevel(dto.level, true);
    if (dto.enabled !== undefined) data.enabled = Boolean(dto.enabled);
    if (dto.channels !== undefined) data.channels = this.normalizeChannels(dto.channels);
    if (dto.recipients !== undefined) data.recipients = this.toNullableJson(dto.recipients);
    if (dto.triggerCondition !== undefined) {
      data.triggerCondition = this.toNullableJson(dto.triggerCondition);
    }
    if (dto.rateLimit !== undefined) data.rateLimit = this.toNullableJson(dto.rateLimit);

    await this.prisma.notificationRule.update({
      where: { id: rule.id },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.rule.update',
      objectType: 'notification_rule',
      objectId: rule.id,
      beforeData: this.toAuditJson(rule),
      afterData: this.toAuditJson(dto),
      remark: `Updated notification rule ${rule.eventCode}`
    });

    return this.getRule(rule.id);
  }

  async removeRule(id: string, operator?: AuthenticatedUser) {
    const rule = await this.getRule(id);
    await this.prisma.notificationRule.update({
      where: { id: rule.id },
      data: { deletedAt: new Date(), enabled: false }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.rule.delete',
      objectType: 'notification_rule',
      objectId: rule.id,
      beforeData: this.toAuditJson(rule),
      remark: `Deleted notification rule ${rule.eventCode}`
    });

    return { deleted: true };
  }

  async setRuleEnabled(id: string, enabled: boolean, operator?: AuthenticatedUser) {
    const rule = await this.getRule(id);
    const updated = await this.prisma.notificationRule.update({
      where: { id: rule.id },
      data: { enabled }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: enabled ? 'notification.rule.enable' : 'notification.rule.disable',
      objectType: 'notification_rule',
      objectId: rule.id,
      afterData: this.toAuditJson({ enabled }),
      remark: `${enabled ? 'Enabled' : 'Disabled'} notification rule ${rule.eventCode}`
    });

    return updated;
  }

  async listTemplates(query: ListTemplatesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const enabled = this.parseBoolean(query.enabled);
    const where: Prisma.NotificationTemplateWhereInput = {
      deletedAt: null,
      eventCode: query.eventCode || undefined,
      channel: query.channel || undefined,
      enabled,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationTemplate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildTemplateOrderBy(query),
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              eventCode: true,
              module: true,
              level: true,
              enabled: true
            }
          }
        }
      }),
      this.prisma.notificationTemplate.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getTemplate(id: string) {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            eventCode: true,
            module: true,
            level: true,
            enabled: true
          }
        }
      }
    });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return template;
  }

  private buildTemplateOrderBy(
    query: ListTemplatesQuery
  ): Prisma.NotificationTemplateOrderByWithRelationInput[] {
    const sortField = query.sortBy ? NOTIFICATION_TEMPLATE_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createTemplate(dto: SaveNotificationTemplateDto, operator?: AuthenticatedUser) {
    const eventCode = this.normalizeCode(dto.eventCode, 'eventCode');
    const channel = this.parseChannel(dto.channel, true);
    const ruleId = this.normalizeOptionalUuid(dto.ruleId ?? undefined, 'ruleId');
    const template = await this.prisma.notificationTemplate.create({
      data: {
        name: this.normalizeRequiredString(dto.name, 'name'),
        eventCode,
        channel,
        ruleId,
        title: this.normalizeRequiredString(dto.title, 'title'),
        content: this.normalizeRequiredString(dto.content, 'content'),
        variables: this.toAuditJson(dto.variables ?? this.extractVariables(dto.content)),
        enabled: dto.enabled ?? true
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.template.create',
      objectType: 'notification_template',
      objectId: template.id,
      afterData: this.toAuditJson(template),
      remark: `Created notification template ${template.eventCode}/${template.channel}`
    });

    return this.getTemplate(template.id);
  }

  async updateTemplate(
    id: string,
    dto: Partial<SaveNotificationTemplateDto>,
    operator?: AuthenticatedUser
  ) {
    const template = await this.getTemplate(id);
    const data: Prisma.NotificationTemplateUpdateInput = {};

    if (dto.name !== undefined) data.name = this.normalizeRequiredString(dto.name, 'name');
    if (dto.eventCode !== undefined)
      data.eventCode = this.normalizeCode(dto.eventCode, 'eventCode');
    if (dto.ruleId !== undefined) {
      data.rule =
        dto.ruleId === null || dto.ruleId === ''
          ? { disconnect: true }
          : { connect: { id: this.normalizeRequiredUuid(dto.ruleId, 'ruleId') } };
    }
    if (dto.channel !== undefined) data.channel = this.parseChannel(dto.channel, true);
    if (dto.title !== undefined) data.title = this.normalizeRequiredString(dto.title, 'title');
    if (dto.content !== undefined)
      data.content = this.normalizeRequiredString(dto.content, 'content');
    if (dto.variables !== undefined || dto.content !== undefined) {
      data.variables = this.toAuditJson(
        dto.variables ?? this.extractVariables(dto.content ?? template.content)
      );
    }
    if (dto.enabled !== undefined) data.enabled = Boolean(dto.enabled);

    await this.prisma.notificationTemplate.update({
      where: { id: template.id },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.template.update',
      objectType: 'notification_template',
      objectId: template.id,
      beforeData: this.toAuditJson(template),
      afterData: this.toAuditJson(dto),
      remark: `Updated notification template ${template.eventCode}/${template.channel}`
    });

    return this.getTemplate(template.id);
  }

  async removeTemplate(id: string, operator?: AuthenticatedUser) {
    const template = await this.getTemplate(id);
    await this.prisma.notificationTemplate.update({
      where: { id: template.id },
      data: { deletedAt: new Date(), enabled: false }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.template.delete',
      objectType: 'notification_template',
      objectId: template.id,
      beforeData: this.toAuditJson(template),
      remark: `Deleted notification template ${template.eventCode}/${template.channel}`
    });

    return { deleted: true };
  }

  renderTemplate(id: string, payload: Record<string, unknown>) {
    return this.getTemplate(id).then((template) => ({
      title: this.renderText(template.title, payload),
      content: this.renderText(template.content, payload)
    }));
  }

  async listLogs(query: ListLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseLogStatus(query.status, false);
    const where: Prisma.NotificationLogWhereInput = {
      module: query.module || undefined,
      eventCode: query.eventCode || undefined,
      channel: query.channel || undefined,
      status: status ?? undefined,
      OR: keyword
        ? [
            { title: { contains: keyword, mode: 'insensitive' } },
            { contentDigest: { contains: keyword, mode: 'insensitive' } },
            { recipient: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildLogOrderBy(query)
      }),
      this.prisma.notificationLog.count({ where })
    ]);

    return {
      items: items.map((item) => this.toLogResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getLog(id: string) {
    return this.toLogResponse(await this.findLogOrThrow(id));
  }

  private buildLogOrderBy(query: ListLogsQuery): Prisma.NotificationLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? NOTIFICATION_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async retryLog(id: string, operator?: AuthenticatedUser) {
    const log = await this.findLogOrThrow(id);
    if (!['failed', 'skipped', 'pending'].includes(log.status)) {
      throw new ConflictException('Only failed, skipped, or pending notification logs can retry');
    }

    if (log.channel === 'telegram') {
      return this.retryTelegramLog(log, operator);
    }

    const updated = await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: 'sent',
        errorMessage: null,
        retryCount: { increment: 1 },
        sentAt: new Date()
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.log.retry',
      objectType: 'notification_log',
      objectId: log.id,
      afterData: this.toAuditJson({ channel: log.channel, status: 'sent' }),
      remark: `Retried notification log ${log.id}`
    });

    return this.toLogResponse(updated);
  }

  async listTelegramConfigs() {
    const configs = await this.prisma.telegramConfig.findMany({
      where: { deletedAt: null },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      items: configs.map((config) => this.toTelegramResponse(config))
    };
  }

  async createTelegramConfig(dto: SaveTelegramConfigDto, operator?: AuthenticatedUser) {
    const token = this.normalizeNullableString(dto.botToken);
    const config = await this.prisma.telegramConfig.create({
      data: {
        notificationName: this.normalizeRequiredString(dto.notificationName, 'notificationName'),
        enabled: dto.enabled ?? false,
        botTokenEncrypted: this.fieldEncryptionService.encrypt(token),
        botTokenTail: this.getTail(token),
        chatId: this.normalizeRequiredString(dto.chatId, 'chatId'),
        notificationLevel: this.parseLevel(dto.notificationLevel ?? 'warning', true),
        silentStartTime: this.normalizeNullableString(dto.silentStartTime),
        silentEndTime: this.normalizeNullableString(dto.silentEndTime),
        retryCount: this.normalizeRetryCount(dto.retryCount)
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.telegram.create',
      objectType: 'telegram_config',
      objectId: config.id,
      afterData: this.toAuditJson({
        id: config.id,
        notificationName: config.notificationName,
        enabled: config.enabled,
        botTokenTail: config.botTokenTail,
        hasBotToken: Boolean(config.botTokenEncrypted),
        chatId: config.chatId
      }),
      remark: `Created Telegram config ${config.notificationName}`
    });

    return this.toTelegramResponse(config);
  }

  async updateTelegramConfig(
    id: string,
    dto: Partial<SaveTelegramConfigDto>,
    operator?: AuthenticatedUser
  ) {
    const existingConfig = await this.findTelegramConfigOrThrow(id);
    const data: Prisma.TelegramConfigUpdateInput = {};

    if (dto.notificationName !== undefined) {
      data.notificationName = this.normalizeRequiredString(
        dto.notificationName,
        'notificationName'
      );
    }
    if (dto.enabled !== undefined) data.enabled = Boolean(dto.enabled);
    if (dto.botToken !== undefined) {
      const token = this.normalizeNullableString(dto.botToken);
      data.botTokenEncrypted = this.fieldEncryptionService.encrypt(token);
      data.botTokenTail = this.getTail(token);
    }
    if (dto.chatId !== undefined) data.chatId = this.normalizeRequiredString(dto.chatId, 'chatId');
    if (dto.notificationLevel !== undefined) {
      data.notificationLevel = this.parseLevel(dto.notificationLevel, true);
    }
    if (dto.silentStartTime !== undefined) {
      data.silentStartTime = this.normalizeNullableString(dto.silentStartTime);
    }
    if (dto.silentEndTime !== undefined) {
      data.silentEndTime = this.normalizeNullableString(dto.silentEndTime);
    }
    if (dto.retryCount !== undefined) data.retryCount = this.normalizeRetryCount(dto.retryCount);

    const config = await this.prisma.telegramConfig.update({
      where: { id: existingConfig.id },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.telegram.update',
      objectType: 'telegram_config',
      objectId: config.id,
      beforeData: this.toAuditJson(this.toTelegramResponse(existingConfig)),
      afterData: this.toAuditJson(this.toTelegramResponse(config)),
      remark: `Updated Telegram config ${config.notificationName}`
    });

    return this.toTelegramResponse(config);
  }

  async removeTelegramConfig(id: string, operator?: AuthenticatedUser) {
    const config = await this.findTelegramConfigOrThrow(id);
    await this.prisma.telegramConfig.update({
      where: { id: config.id },
      data: {
        deletedAt: new Date(),
        enabled: false
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'notification',
      action: 'notification.telegram.delete',
      objectType: 'telegram_config',
      objectId: config.id,
      beforeData: this.toAuditJson(this.toTelegramResponse(config)),
      remark: `Deleted Telegram config ${config.notificationName}`
    });

    return { deleted: true };
  }

  async testTelegram(dto: TestTelegramDto, operator?: AuthenticatedUser) {
    const config = dto.configId
      ? await this.findTelegramConfigOrThrow(dto.configId)
      : await this.findFirstTelegramConfigOrThrow();
    const title = dto.title?.trim() || 'Telegram 通知测试';
    const content = dto.content?.trim() || '这是一条来自代充管理后台的 Telegram 测试通知。';

    try {
      await this.sendTelegramMessage(config, title, content);
      const updated = await this.prisma.telegramConfig.update({
        where: { id: config.id },
        data: {
          lastTestStatus: 'success',
          lastTestError: null,
          lastTestAt: new Date()
        }
      });

      await this.createNotificationLog({
        eventCode: 'telegram.test',
        module: 'notification',
        channel: 'telegram',
        title,
        content,
        recipient: config.chatId,
        status: 'sent',
        payload: {
          configId: config.id,
          operatorId: operator?.id ?? null
        }
      });

      return {
        status: 'success',
        config: this.toTelegramResponse(updated)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Telegram test failed';
      const updated = await this.prisma.telegramConfig.update({
        where: { id: config.id },
        data: {
          lastTestStatus: 'failed',
          lastTestError: message,
          lastTestAt: new Date()
        }
      });

      await this.createNotificationLog({
        eventCode: 'telegram.test',
        module: 'notification',
        channel: 'telegram',
        title,
        content,
        recipient: config.chatId,
        status: 'failed',
        errorMessage: message,
        payload: {
          configId: config.id,
          operatorId: operator?.id ?? null
        }
      });

      return {
        status: 'failed',
        errorMessage: message,
        config: this.toTelegramResponse(updated)
      };
    }
  }

  async createInApp(dto: CreateInAppNotificationDto) {
    return this.toLogResponse(
      await this.createNotificationLog({
        eventCode: this.normalizeCode(dto.eventCode, 'eventCode'),
        module: this.normalizeRequiredString(dto.module, 'module'),
        channel: 'system',
        title: this.normalizeRequiredString(dto.title, 'title'),
        content: this.normalizeRequiredString(dto.content, 'content'),
        recipient: this.normalizeNullableString(dto.recipient),
        recipientUserId: this.normalizeOptionalUuid(
          dto.recipientUserId ?? undefined,
          'recipientUserId'
        ),
        status: this.parseLogStatus(dto.status ?? 'sent', true),
        payload: dto.payload ?? null
      })
    );
  }

  async triggerEvent(input: TriggerNotificationEventInput) {
    const eventCode = this.normalizeCode(input.eventCode, 'eventCode');
    const module = this.normalizeRequiredString(input.module, 'module');
    const title = this.normalizeRequiredString(input.title, 'title');
    const content = this.normalizeRequiredString(input.content, 'content');
    const payload = {
      title,
      summary: content,
      detail: '',
      ...(input.payload ?? {})
    };
    const rule = await this.prisma.notificationRule.findUnique({
      where: { eventCode },
      include: {
        templates: {
          where: { deletedAt: null, enabled: true },
          orderBy: { channel: 'asc' }
        }
      }
    });

    if (!rule || rule.deletedAt) {
      const log = await this.createNotificationLog({
        eventCode,
        module,
        channel: 'system',
        title,
        content,
        recipient: input.recipient,
        recipientUserId: this.normalizeOptionalUuid(
          input.recipientUserId ?? undefined,
          'recipientUserId'
        ),
        status: 'skipped',
        errorMessage: 'Notification rule is not configured',
        payload
      });

      return {
        status: 'skipped',
        reason: 'rule_not_configured',
        logs: [this.toLogResponse(log)]
      };
    }

    const channels = rule.channels.length ? rule.channels : ['system'];
    if (!rule.enabled) {
      const logs = await Promise.all(
        channels.map((channel) =>
          this.createNotificationLog({
            ruleId: rule.id,
            eventCode,
            module: rule.module,
            channel,
            title,
            content,
            recipient: input.recipient,
            recipientUserId: this.normalizeOptionalUuid(
              input.recipientUserId ?? undefined,
              'recipientUserId'
            ),
            status: 'skipped',
            errorMessage: 'Notification rule is disabled',
            payload
          })
        )
      );

      return {
        status: 'skipped',
        reason: 'rule_disabled',
        logs: logs.map((log) => this.toLogResponse(log))
      };
    }

    const logs: NotificationLog[] = [];
    for (const channel of channels) {
      const template = rule.templates.find((item) => item.channel === channel);
      const renderedTitle = template ? this.renderText(template.title, payload ?? {}) : title;
      const renderedContent = template ? this.renderText(template.content, payload ?? {}) : content;

      if (channel === 'system') {
        logs.push(
          await this.createNotificationLog({
            ruleId: rule.id,
            eventCode,
            module: rule.module,
            channel,
            title: renderedTitle,
            content: renderedContent,
            recipient: input.recipient,
            recipientUserId: this.normalizeOptionalUuid(
              input.recipientUserId ?? undefined,
              'recipientUserId'
            ),
            status: 'sent',
            payload
          })
        );
        continue;
      }

      if (channel === 'telegram') {
        const telegramLogs = await this.sendRuleTelegramNotifications(rule, {
          eventCode,
          module: rule.module,
          title: renderedTitle,
          content: renderedContent,
          payload,
          recipient: input.recipient
        });
        logs.push(...telegramLogs);
      }
    }

    await this.prisma.notificationRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() }
    });

    return {
      status: logs.some((log) => log.status === 'failed') ? 'partial_failed' : 'sent',
      logs: logs.map((log) => this.toLogResponse(log))
    };
  }

  private async sendRuleTelegramNotifications(
    rule: { id: string; level: NotificationLevel },
    input: {
      eventCode: string;
      module: string;
      title: string;
      content: string;
      recipient?: string | null;
      payload?: Record<string, unknown> | null;
    }
  ) {
    const configs = await this.prisma.telegramConfig.findMany({
      where: {
        deletedAt: null,
        enabled: true
      },
      orderBy: [{ notificationLevel: 'desc' }, { createdAt: 'desc' }]
    });

    if (!configs.length) {
      return [
        await this.createNotificationLog({
          ruleId: rule.id,
          eventCode: input.eventCode,
          module: input.module,
          channel: 'telegram',
          title: input.title,
          content: input.content,
          recipient: input.recipient,
          status: 'skipped',
          errorMessage: 'No enabled Telegram config',
          payload: input.payload
        })
      ];
    }

    const logs: NotificationLog[] = [];
    for (const config of configs) {
      if (!this.shouldSendToTelegramLevel(rule.level, config.notificationLevel)) {
        logs.push(
          await this.createNotificationLog({
            ruleId: rule.id,
            eventCode: input.eventCode,
            module: input.module,
            channel: 'telegram',
            title: input.title,
            content: input.content,
            recipient: config.chatId,
            status: 'skipped',
            errorMessage: `Telegram config level ${config.notificationLevel} does not match ${rule.level}`,
            payload: input.payload
          })
        );
        continue;
      }

      try {
        await this.sendTelegramMessage(config, input.title, input.content);
        logs.push(
          await this.createNotificationLog({
            ruleId: rule.id,
            eventCode: input.eventCode,
            module: input.module,
            channel: 'telegram',
            title: input.title,
            content: input.content,
            recipient: config.chatId,
            status: 'sent',
            payload: input.payload
          })
        );
      } catch (error) {
        logs.push(
          await this.createNotificationLog({
            ruleId: rule.id,
            eventCode: input.eventCode,
            module: input.module,
            channel: 'telegram',
            title: input.title,
            content: input.content,
            recipient: config.chatId,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Telegram notification failed',
            payload: input.payload
          })
        );
      }
    }

    return logs;
  }

  private async retryTelegramLog(log: NotificationLog, operator?: AuthenticatedUser) {
    const config = await this.findFirstTelegramConfigOrThrow();

    try {
      await this.sendTelegramMessage(config, log.title, log.contentDigest);
      const updated = await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          errorMessage: null,
          retryCount: { increment: 1 },
          sentAt: new Date()
        }
      });

      this.responseCache.clear();
      await this.auditLogsService.create({
        userId: operator?.id,
        module: 'notification',
        action: 'notification.log.retry',
        objectType: 'notification_log',
        objectId: log.id,
        afterData: this.toAuditJson({ channel: 'telegram', status: 'sent' }),
        remark: `Retried Telegram notification log ${log.id}`
      });

      return this.toLogResponse(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Telegram retry failed';
      const updated = await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: message,
          retryCount: { increment: 1 }
        }
      });

      this.responseCache.clear();
      return this.toLogResponse(updated);
    }
  }

  private async sendTelegramMessage(config: TelegramConfig, title: string, content: string) {
    const token = this.fieldEncryptionService.decrypt(config.botTokenEncrypted);
    if (!token) {
      throw new BadRequestException('Telegram Bot Token is not configured');
    }

    if (!config.chatId) {
      throw new BadRequestException('Telegram Chat ID is not configured');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: `${title}\n\n${content}`,
        disable_notification: this.isInSilentWindow(config),
        parse_mode: 'HTML'
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(`Telegram send failed: ${response.status} ${body}`.trim());
    }
  }

  private async createNotificationLog(input: {
    ruleId?: string | null;
    eventCode: string;
    module: string;
    channel: string;
    title: string;
    content: string;
    recipient?: string | null;
    recipientUserId?: string | null;
    status?: NotificationLogStatus;
    errorMessage?: string | null;
    payload?: Record<string, unknown> | Prisma.InputJsonValue | null;
  }) {
    const log = await this.prisma.notificationLog.create({
      data: {
        ruleId: input.ruleId,
        eventCode: input.eventCode,
        module: input.module,
        channel: input.channel,
        recipient: input.recipient,
        recipientUserId: input.recipientUserId,
        title: input.title,
        contentDigest: this.digestContent(input.content),
        payload: input.payload ? this.toAuditJson(input.payload) : PrismaNamespace.JsonNull,
        status: input.status ?? 'pending',
        errorMessage: input.errorMessage,
        sentAt: input.status === 'sent' ? new Date() : undefined
      }
    });

    this.responseCache.clear();
    return log;
  }

  private getOperatorCacheKey(namespace: string, operator?: AuthenticatedUser) {
    return `${namespace}:${operator?.id ?? 'anonymous'}`;
  }

  private getInAppWhere(query: ListLogsQuery, operator?: AuthenticatedUser) {
    const keyword = query.keyword?.trim();
    return {
      channel: 'system',
      status: query.status ? this.parseLogStatus(query.status, false) : undefined,
      readAt: query.unread === 'true' ? null : undefined,
      OR: [
        ...(operator?.id
          ? [
              {
                recipientUserId: operator.id
              }
            ]
          : []),
        {
          recipientUserId: null
        }
      ],
      AND: keyword
        ? [
            {
              OR: [
                { title: { contains: keyword, mode: 'insensitive' as const } },
                { contentDigest: { contains: keyword, mode: 'insensitive' as const } }
              ]
            }
          ]
        : undefined
    } satisfies Prisma.NotificationLogWhereInput;
  }

  private getNavBadgeAggregateRows(operator?: AuthenticatedUser) {
    if (typeof this.prisma.$queryRaw !== 'function') {
      return this.getNavBadgeAggregateRowsWithPrisma(operator);
    }

    const recipientFilter = operator?.id
      ? PrismaNamespace.sql`(recipient_user_id = ${operator.id}::uuid OR recipient_user_id IS NULL)`
      : PrismaNamespace.sql`recipient_user_id IS NULL`;

    return this.prisma.$queryRaw<NavBadgeAggregateRow[]>`
      SELECT
        CASE
          WHEN event_code LIKE 'apple.renewal.%' THEN 'workspace'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES.common)}) THEN 'common'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES['id-business'])}) THEN 'id-business'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES.codes)}) THEN 'codes'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES.security)}) THEN 'security'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES['data-audit'])}) THEN 'data-audit'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES['ops-platform'])}) THEN 'ops-platform'
          WHEN module IN (${PrismaNamespace.join(NAV_BADGE_SECTION_MODULES['system-config'])}) THEN 'system-config'
          ELSE 'system-config'
        END AS "sectionKey",
        status::text AS status,
        COUNT(*) AS count
      FROM notification_logs
      WHERE channel = 'system'
        AND read_at IS NULL
        AND status::text IN ('pending', 'sent', 'failed')
        AND ${recipientFilter}
      GROUP BY 1, 2
    `;
  }

  private async getNavBadgeAggregateRowsWithPrisma(
    operator?: AuthenticatedUser
  ): Promise<NavBadgeAggregateRow[]> {
    const rows = await this.prisma.notificationLog.groupBy({
      by: ['module', 'status', 'eventCode'],
      where: {
        ...this.getInAppWhere({ unread: 'true' }, operator),
        status: { in: ['pending', 'sent', 'failed'] }
      },
      _count: { _all: true }
    });

    const aggregate = new Map<string, NavBadgeAggregateRow>();

    for (const row of rows) {
      const sectionKey = this.resolveNavBadgeSection(row.module, row.eventCode);
      const key = `${sectionKey}:${row.status}`;
      const current = aggregate.get(key);
      const count = row._count._all;

      if (current) {
        current.count = Number(current.count) + count;
        continue;
      }

      aggregate.set(key, {
        sectionKey,
        status: row.status,
        count
      });
    }

    return [...aggregate.values()];
  }

  private resolveNavBadgeSection(module: string, eventCode: string): NavBadgeSectionKey {
    if (eventCode.startsWith('apple.renewal.')) {
      return 'workspace';
    }

    return NAV_BADGE_MODULE_SECTION_MAP[module] ?? 'system-config';
  }

  private createNavItemBadge(input: NavItemBadgeInput) {
    const count = Math.max(0, Math.trunc(Number.isFinite(input.count) ? input.count : 0));

    return {
      itemKey: input.itemKey,
      label: input.label,
      count,
      tone: input.tone ?? 'orange',
      description: input.description ?? ''
    };
  }

  private countLaunchChecklistOpenItems(value: unknown) {
    const items = this.resolveLaunchChecklistItems(value);
    const openStatuses = new Set(['pending', 'in_progress', 'blocked']);

    return items.filter((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const status = (item as { status?: unknown }).status;
      return typeof status === 'string' && openStatuses.has(status);
    }).length;
  }

  private resolveLaunchChecklistItems(value: unknown) {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const items = (value as { items?: unknown }).items;
    return Array.isArray(items) ? items : [];
  }

  private async ensureDefaultChannels() {
    await this.prisma.$transaction([
      this.prisma.notificationChannel.upsert({
        where: { code: 'telegram' },
        update: { name: 'Telegram', type: 'telegram' },
        create: {
          name: 'Telegram',
          code: 'telegram',
          type: 'telegram',
          level: 'warning',
          enabled: false
        }
      }),
      this.prisma.notificationChannel.upsert({
        where: { code: 'system' },
        update: { name: '站内通知', type: 'in_app' },
        create: {
          name: '站内通知',
          code: 'system',
          type: 'in_app',
          level: 'info',
          enabled: true
        }
      })
    ]);
  }

  private ensureDefaultChannelsInBackground() {
    if (this.defaultChannelsEnsured || this.defaultChannelsEnsurePromise) {
      return;
    }

    this.defaultChannelsEnsurePromise = this.ensureDefaultChannels()
      .then(() => {
        this.defaultChannelsEnsured = true;
      })
      .catch(() => {})
      .finally(() => {
        this.defaultChannelsEnsurePromise = undefined;
      });
  }

  private async findLogOrThrow(id: string) {
    const logId = this.normalizeRequiredUuid(id, 'id');
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: logId }
    });

    if (!log) {
      throw new NotFoundException('Notification log not found');
    }

    return log;
  }

  private async findTelegramConfigOrThrow(id: string) {
    const configId = this.normalizeRequiredUuid(id, 'id');
    const config = await this.prisma.telegramConfig.findFirst({
      where: { id: configId, deletedAt: null }
    });

    if (!config) {
      throw new NotFoundException('Telegram config not found');
    }

    return config;
  }

  private async findFirstTelegramConfigOrThrow() {
    const config = await this.prisma.telegramConfig.findFirst({
      where: { deletedAt: null },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }]
    });

    if (!config) {
      throw new NotFoundException('Telegram config not found');
    }

    return config;
  }

  private parseLevel(value: unknown, strict: true): NotificationLevel;
  private parseLevel(value: unknown, strict: false): NotificationLevel | undefined;
  private parseLevel(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('level is required');
      return undefined;
    }

    if (value === 'info' || value === 'warning' || value === 'error' || value === 'critical') {
      return value;
    }

    throw new BadRequestException('level is invalid');
  }

  private parseLogStatus(value: unknown, strict: true): NotificationLogStatus;
  private parseLogStatus(value: unknown, strict: false): NotificationLogStatus | undefined;
  private parseLogStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }

    if (value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped') {
      return value;
    }

    throw new BadRequestException('status is invalid');
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'asc' || value === 'desc') {
      return value;
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  private parseChannel(value: unknown, strict: true): 'telegram' | 'system';
  private parseChannel(value: unknown, strict: false): 'telegram' | 'system' | undefined;
  private parseChannel(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('channel is required');
      return undefined;
    }

    if (value === 'telegram' || value === 'system') {
      return value;
    }

    throw new BadRequestException('channel is invalid');
  }

  private normalizeChannels(value: string[] | undefined) {
    const channels = value?.length ? value : ['system'];
    return [...new Set(channels.map((channel) => this.parseChannel(channel, true)))];
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeCode(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);
    if (!/^[a-z0-9._-]+$/i.test(normalized)) {
      throw new BadRequestException(
        `${field} only supports letters, numbers, dots, underscores and hyphens`
      );
    }

    return normalized;
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }

    return normalized;
  }

  private normalizeOptionalUuid(value: string | undefined, field: string) {
    if (!value) return undefined;
    return this.normalizeRequiredUuid(value, field);
  }

  private normalizeRetryCount(value: number | undefined) {
    if (value === undefined || value === null) return 3;
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new BadRequestException('retryCount must be an integer between 0 and 10');
    }

    return value;
  }

  private getTail(value: string | null) {
    return value ? value.slice(-4) : null;
  }

  private isInSilentWindow(config: TelegramConfig) {
    if (!config.silentStartTime || !config.silentEndTime) return false;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (config.silentStartTime <= config.silentEndTime) {
      return current >= config.silentStartTime && current <= config.silentEndTime;
    }

    return current >= config.silentStartTime || current <= config.silentEndTime;
  }

  private shouldSendToTelegramLevel(ruleLevel: NotificationLevel, configLevel: NotificationLevel) {
    const rank: Record<NotificationLevel, number> = {
      info: 1,
      warning: 2,
      error: 3,
      critical: 4
    };

    return rank[ruleLevel] >= rank[configLevel];
  }

  private digestContent(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 500 ? `${normalized.slice(0, 500)}...` : normalized;
  }

  private extractVariables(content: string) {
    return [...content.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)]
      .map((match) => match[1])
      .filter(Boolean);
  }

  private renderText(template: string, payload: Record<string, unknown>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
      const value = payload[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private toNullableJson(value: Record<string, unknown> | null | undefined) {
    return value ? this.toAuditJson(value) : PrismaNamespace.JsonNull;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toTelegramResponse(config: TelegramConfig) {
    return {
      id: config.id,
      notificationName: config.notificationName,
      enabled: config.enabled,
      hasBotToken: Boolean(config.botTokenEncrypted),
      botTokenTail: config.botTokenTail,
      chatId: config.chatId,
      notificationLevel: config.notificationLevel,
      silentStartTime: config.silentStartTime,
      silentEndTime: config.silentEndTime,
      retryCount: config.retryCount,
      lastTestStatus: config.lastTestStatus,
      lastTestError: config.lastTestError,
      lastTestAt: config.lastTestAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  private toLogResponse(log: NotificationLog) {
    return {
      id: log.id,
      ruleId: log.ruleId,
      eventCode: log.eventCode,
      module: log.module,
      channel: log.channel,
      recipient: log.recipient,
      recipientUserId: log.recipientUserId,
      title: log.title,
      contentDigest: log.contentDigest,
      payload: log.payload,
      status: log.status,
      errorMessage: log.errorMessage,
      retryCount: log.retryCount,
      triggeredAt: log.triggeredAt,
      sentAt: log.sentAt,
      readAt: log.readAt,
      createdAt: log.createdAt
    };
  }
}
