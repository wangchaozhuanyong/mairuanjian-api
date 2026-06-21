import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppAnnouncement,
  AppAnnouncementLevel,
  AppVersion,
  AppVersionStatus,
  FeatureFlag,
  MaintenanceWindow,
  Prisma,
  SystemParameter
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';

interface ListAnnouncementsQuery extends PaginationQuery {
  keyword?: string;
  level?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListAppVersionsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListFeatureFlagsQuery extends PaginationQuery {
  keyword?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListSystemParametersQuery extends PaginationQuery {
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface LaunchChecklistItemInput {
  id?: string;
  category?: string;
  title?: string;
  priority?: string;
  status?: string;
  owner?: string | null;
  evidence?: string | null;
  remark?: string | null;
  updatedAt?: string | null;
}

export interface SaveAnnouncementInput {
  title?: string;
  content?: string;
  level?: string;
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export interface SaveMaintenanceModeInput {
  enabled?: boolean;
  reason?: string;
  allowedRoles?: unknown;
  allowedIps?: unknown;
  startAt?: string | null;
  endAt?: string | null;
}

export interface SaveFeatureFlagInput {
  key?: string;
  name?: string;
  enabled?: boolean;
  config?: unknown;
  remark?: string | null;
}

export interface SaveAppVersionInput {
  version?: string;
  title?: string;
  status?: string;
  releaseNotes?: string;
  impactModules?: unknown;
  releasedAt?: string | null;
}

export interface SaveMaintenanceParameterInput {
  key?: string;
  value?: unknown;
  group?: string;
  remark?: string | null;
}

export interface SaveLaunchChecklistInput {
  items?: unknown;
}

export interface UserSnapshot {
  id: string;
  username: string;
  displayName: string;
}

type AnnouncementWithUsers = AppAnnouncement & {
  createdBy: UserSnapshot | null;
  updatedBy: UserSnapshot | null;
};
type MaintenanceWindowWithUsers = MaintenanceWindow & {
  createdBy: UserSnapshot | null;
  updatedBy: UserSnapshot | null;
};
type FeatureFlagWithUser = FeatureFlag & { updatedBy: UserSnapshot | null };
type AppVersionWithUser = AppVersion & { createdBy: UserSnapshot | null };
type ParameterWithUser = SystemParameter & { updatedBy: UserSnapshot | null };

const MENU_CONFIG_KEY = 'maintenance_menu_config';
const THEME_CONFIG_KEY = 'maintenance_theme_config';
const SYSTEM_PARAMETERS_KEY = 'maintenance_system_parameters';
const LAUNCH_CHECKLIST_KEY = 'maintenance_launch_checklist';
const ANNOUNCEMENT_SORT_FIELDS: Record<
  string,
  keyof Prisma.AppAnnouncementOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
  level: 'level',
  enabled: 'enabled',
  startAt: 'startAt',
  endAt: 'endAt'
};
const FEATURE_FLAG_SORT_FIELDS: Record<string, keyof Prisma.FeatureFlagOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  key: 'key',
  name: 'name',
  enabled: 'enabled',
  remark: 'remark'
};
const APP_VERSION_SORT_FIELDS: Record<string, keyof Prisma.AppVersionOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  releasedAt: 'releasedAt',
  version: 'version',
  title: 'title',
  status: 'status'
};
const SYSTEM_PARAMETER_SORT_FIELDS: Record<
  string,
  keyof Prisma.SystemParameterOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  key: 'key',
  remark: 'remark'
};
const LAUNCH_CHECKLIST_STATUSES = ['pending', 'in_progress', 'passed', 'blocked', 'waived'];
const LAUNCH_CHECKLIST_PRIORITIES = ['P0', 'P1', 'P2'];
const REQUIRED_MANUAL_GATE_IDS = ['telegram_test', 'prod_env', 'git_baseline'];
const DEFAULT_LAUNCH_CHECKLIST_ITEMS = [
  {
    id: 'quality_gate',
    category: '工程质量',
    title: '完整质量门禁 npm run check 通过',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'npm run check',
    remark: '当前基线已通过'
  },
  {
    id: 'prod_config',
    category: '部署',
    title: '生产 Compose 配置校验通过',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'npm run prod:config:example',
    remark: '示例配置已验证'
  },
  {
    id: 'prod_images',
    category: '部署',
    title: 'API/Admin 生产镜像可构建',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: 'docker compose build api admin',
    remark: '本机使用传统 Docker 构建模式验证'
  },
  {
    id: 'special_pages',
    category: '体验',
    title: '403、404、维护模式页可访问且非空白',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: '/403 /404 /system/maintenance-mode',
    remark: '浏览器实际渲染已确认'
  },
  {
    id: 'maintenance_guard',
    category: '安全',
    title: '维护模式接入后台全局访问拦截',
    priority: 'P0',
    status: 'passed',
    owner: '技术',
    evidence: '/maintenance/mode/public + router guard',
    remark: '非允许角色进入维护模式页'
  },
  {
    id: 'apple_e2e',
    category: 'Apple ID',
    title: 'Apple ID 代充业务端到端验收',
    priority: 'P0',
    status: 'pending',
    owner: '业务',
    evidence: '',
    remark: '需用真实样例数据验收订单、成本、续费和报表'
  },
  {
    id: 'code_e2e',
    category: '兑换码',
    title: '兑换码半自动发货端到端验收',
    priority: 'P0',
    status: 'pending',
    owner: '业务',
    evidence: '',
    remark: '需验收导入、去重、锁码、发货、防重复和售后'
  },
  {
    id: 'sensitive_audit',
    category: '安全',
    title: '敏感字段权限、原因和审计回归',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '覆盖 Apple ID、礼品卡代码、兑换码、客户手机号'
  },
  {
    id: 'backup_restore',
    category: '数据',
    title: '数据库备份和恢复演练完成',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '至少在非生产环境完成恢复演练'
  },
  {
    id: 'telegram_test',
    category: '通知',
    title: 'Telegram Bot Token / Chat ID 后补填写',
    priority: 'P1',
    status: 'pending',
    owner: '运营',
    evidence: '',
    remark: '半自动首发可先留空；后续在通知中心填写真实 Bot Token 和 Chat ID 后执行测试发送'
  },
  {
    id: 'prod_env',
    category: '部署',
    title: '生产 .env.production 无占位密钥',
    priority: 'P0',
    status: 'pending',
    owner: '技术',
    evidence: '',
    remark: '上线前替换全部 replace_with/change_me 占位'
  },
  {
    id: 'git_baseline',
    category: '发布',
    title: '确认 Git 基线、提交和推送策略',
    priority: 'P0',
    status: 'pending',
    owner: '负责人',
    evidence: '',
    remark: '未获明确要求前不 commit、不 push'
  }
];
const MAINTENANCE_OVERVIEW_CACHE_TTL_MS = 120_000;

@Injectable()
export class MaintenanceService {
  private readonly overviewCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async overview() {
    return this.overviewCache.getOrSet('overview', MAINTENANCE_OVERVIEW_CACHE_TTL_MS, async () => {
      const [
        enabledAnnouncementCount,
        activeMaintenanceWindow,
        enabledFeatureFlagCount,
        latestVersion,
        recentAnnouncements,
        recentVersions
      ] = await Promise.all([
        this.prisma.appAnnouncement.count({ where: { enabled: true, deletedAt: null } }),
        this.prisma.maintenanceWindow.findFirst({
          where: { deletedAt: null },
          include: this.getMaintenanceWindowInclude(),
          orderBy: { updatedAt: 'desc' }
        }),
        this.prisma.featureFlag.count({ where: { enabled: true, deletedAt: null } }),
        this.prisma.appVersion.findFirst({
          include: this.getAppVersionInclude(),
          orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }]
        }),
        this.prisma.appAnnouncement.findMany({
          where: { deletedAt: null },
          include: this.getAnnouncementInclude(),
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.appVersion.findMany({
          include: this.getAppVersionInclude(),
          take: 5,
          orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }]
        })
      ]);

      return {
        enabledAnnouncementCount,
        maintenanceModeEnabled: activeMaintenanceWindow?.enabled ?? false,
        activeMaintenanceWindow: activeMaintenanceWindow
          ? this.toMaintenanceWindowResponse(activeMaintenanceWindow)
          : this.getDefaultMaintenanceMode(),
        enabledFeatureFlagCount,
        latestVersion: latestVersion ? this.toAppVersionResponse(latestVersion) : null,
        recentAnnouncements: recentAnnouncements.map((item) => this.toAnnouncementResponse(item)),
        recentVersions: recentVersions.map((item) => this.toAppVersionResponse(item))
      };
    });
  }

  async listAnnouncements(query: ListAnnouncementsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const level = this.parseAnnouncementLevel(query.level, false);
    const enabled = this.parseBoolean(query.enabled);
    const where: Prisma.AppAnnouncementWhereInput = {
      deletedAt: null,
      level: level ?? undefined,
      enabled,
      OR: keyword
        ? [
            { title: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await Promise.all([
      this.prisma.appAnnouncement.findMany({
        where,
        include: this.getAnnouncementInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildAnnouncementOrderBy(query)
      }),
      this.prisma.appAnnouncement.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toAnnouncementResponse(item)),
      total,
      pagination
    );
  }

  private buildAnnouncementOrderBy(
    query: ListAnnouncementsQuery
  ): Prisma.AppAnnouncementOrderByWithRelationInput[] {
    const sortField = query.sortBy ? ANNOUNCEMENT_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createAnnouncement(dto: SaveAnnouncementInput, operator?: AuthenticatedUser) {
    const announcement = await this.prisma.appAnnouncement.create({
      data: {
        title: this.normalizeRequiredString(dto.title, 'title'),
        content: this.normalizeRequiredString(dto.content, 'content'),
        level: this.parseAnnouncementLevel(dto.level ?? 'info', true),
        enabled: dto.enabled ?? true,
        startAt: this.parseNullableDate(dto.startAt, 'startAt'),
        endAt: this.parseNullableDate(dto.endAt, 'endAt'),
        createdById: operator?.id,
        updatedByUserId: operator?.id
      },
      include: this.getAnnouncementInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.announcement.create',
      'app_announcement',
      announcement.id,
      undefined,
      this.toAnnouncementResponse(announcement)
    );
    return this.toAnnouncementResponse(announcement);
  }

  async updateAnnouncement(
    id: string,
    dto: Partial<SaveAnnouncementInput>,
    operator?: AuthenticatedUser
  ) {
    const announcement = await this.findAnnouncementOrThrow(id);
    const updated = await this.prisma.appAnnouncement.update({
      where: { id: announcement.id },
      data: {
        title:
          dto.title === undefined ? undefined : this.normalizeRequiredString(dto.title, 'title'),
        content:
          dto.content === undefined
            ? undefined
            : this.normalizeRequiredString(dto.content, 'content'),
        level: dto.level === undefined ? undefined : this.parseAnnouncementLevel(dto.level, true),
        enabled: dto.enabled,
        startAt:
          dto.startAt === undefined ? undefined : this.parseNullableDate(dto.startAt, 'startAt'),
        endAt: dto.endAt === undefined ? undefined : this.parseNullableDate(dto.endAt, 'endAt'),
        updatedByUserId: operator?.id
      },
      include: this.getAnnouncementInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.announcement.update',
      'app_announcement',
      announcement.id,
      this.toAnnouncementResponse(announcement),
      this.toAnnouncementResponse(updated)
    );
    return this.toAnnouncementResponse(updated);
  }

  async removeAnnouncement(id: string, operator?: AuthenticatedUser) {
    const announcement = await this.findAnnouncementOrThrow(id);
    const updated = await this.prisma.appAnnouncement.update({
      where: { id: announcement.id },
      data: {
        deletedAt: new Date(),
        enabled: false,
        updatedByUserId: operator?.id
      },
      include: this.getAnnouncementInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.announcement.delete',
      'app_announcement',
      announcement.id,
      this.toAnnouncementResponse(announcement),
      this.toAnnouncementResponse(updated)
    );
    return { deleted: true };
  }

  async getMaintenanceMode() {
    const window = await this.prisma.maintenanceWindow.findFirst({
      where: { deletedAt: null },
      include: this.getMaintenanceWindowInclude(),
      orderBy: { updatedAt: 'desc' }
    });
    return window ? this.toMaintenanceWindowResponse(window) : this.getDefaultMaintenanceMode();
  }

  async getPublicMaintenanceMode() {
    const mode = await this.getMaintenanceMode();

    return {
      enabled: mode.enabled,
      reason: mode.reason,
      allowedRoles: mode.allowedRoles,
      startAt: mode.startAt,
      endAt: mode.endAt
    };
  }

  async saveMaintenanceMode(dto: SaveMaintenanceModeInput, operator?: AuthenticatedUser) {
    const current = await this.prisma.maintenanceWindow.findFirst({
      where: { deletedAt: null },
      include: this.getMaintenanceWindowInclude(),
      orderBy: { updatedAt: 'desc' }
    });
    const data = {
      enabled: dto.enabled ?? false,
      reason: this.normalizeRequiredString(dto.reason ?? '系统维护中', 'reason'),
      allowedRoles: this.normalizeStringArray(dto.allowedRoles, 'allowedRoles'),
      allowedIps: this.normalizeStringArray(dto.allowedIps, 'allowedIps'),
      startAt: this.parseNullableDate(dto.startAt, 'startAt'),
      endAt: this.parseNullableDate(dto.endAt, 'endAt'),
      updatedByUserId: operator?.id
    };
    const window = current
      ? await this.prisma.maintenanceWindow.update({
          where: { id: current.id },
          data,
          include: this.getMaintenanceWindowInclude()
        })
      : await this.prisma.maintenanceWindow.create({
          data: {
            ...data,
            createdById: operator?.id
          },
          include: this.getMaintenanceWindowInclude()
        });

    await this.writeAudit(
      operator,
      'maintenance.mode.update',
      'maintenance_window',
      window.id,
      current ? this.toMaintenanceWindowResponse(current) : undefined,
      this.toMaintenanceWindowResponse(window)
    );
    return this.toMaintenanceWindowResponse(window);
  }

  async listAppVersions(query: ListAppVersionsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseAppVersionStatus(query.status, false);
    const where: Prisma.AppVersionWhereInput = {
      status: status ?? undefined,
      OR: keyword
        ? [
            { version: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { releaseNotes: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await Promise.all([
      this.prisma.appVersion.findMany({
        where,
        include: this.getAppVersionInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildAppVersionOrderBy(query)
      }),
      this.prisma.appVersion.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toAppVersionResponse(item)),
      total,
      pagination
    );
  }

  private buildAppVersionOrderBy(
    query: ListAppVersionsQuery
  ): Prisma.AppVersionOrderByWithRelationInput[] {
    const sortField = query.sortBy ? APP_VERSION_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ releasedAt: 'desc' }, { createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createAppVersion(dto: SaveAppVersionInput, operator?: AuthenticatedUser) {
    const version = this.normalizeCode(dto.version, 'version');
    const existing = await this.prisma.appVersion.findUnique({ where: { version } });
    if (existing) throw new ConflictException('App version already exists');

    const appVersion = await this.prisma.appVersion.create({
      data: {
        version,
        title: this.normalizeRequiredString(dto.title, 'title'),
        status: this.parseAppVersionStatus(dto.status ?? 'draft', true),
        releaseNotes: this.normalizeRequiredString(dto.releaseNotes, 'releaseNotes'),
        impactModules: this.normalizeStringArray(dto.impactModules, 'impactModules'),
        releasedAt: this.parseNullableDate(dto.releasedAt, 'releasedAt'),
        createdById: operator?.id
      },
      include: this.getAppVersionInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.version.create',
      'app_version',
      appVersion.id,
      undefined,
      this.toAppVersionResponse(appVersion)
    );
    return this.toAppVersionResponse(appVersion);
  }

  async listFeatureFlags(query: ListFeatureFlagsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const enabled = this.parseBoolean(query.enabled);
    const where: Prisma.FeatureFlagWhereInput = {
      deletedAt: null,
      enabled,
      OR: keyword
        ? [
            { key: { contains: keyword, mode: 'insensitive' } },
            { name: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await Promise.all([
      this.prisma.featureFlag.findMany({
        where,
        include: this.getFeatureFlagInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildFeatureFlagOrderBy(query)
      }),
      this.prisma.featureFlag.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toFeatureFlagResponse(item)),
      total,
      pagination
    );
  }

  private buildFeatureFlagOrderBy(
    query: ListFeatureFlagsQuery
  ): Prisma.FeatureFlagOrderByWithRelationInput[] {
    const sortField = query.sortBy ? FEATURE_FLAG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ enabled: 'desc' }, { key: 'asc' }];
    }

    return [{ [sortField]: sortOrder }, { key: 'asc' }];
  }

  async createFeatureFlag(dto: SaveFeatureFlagInput, operator?: AuthenticatedUser) {
    const key = this.normalizeCode(dto.key, 'key');
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (existing && !existing.deletedAt) throw new ConflictException('Feature flag already exists');

    const featureFlag = existing
      ? await this.prisma.featureFlag.update({
          where: { id: existing.id },
          data: {
            name: this.normalizeRequiredString(dto.name, 'name'),
            enabled: dto.enabled ?? false,
            config: this.toOptionalJson(dto.config),
            remark: this.normalizeNullableString(dto.remark),
            deletedAt: null,
            updatedByUserId: operator?.id
          },
          include: this.getFeatureFlagInclude()
        })
      : await this.prisma.featureFlag.create({
          data: {
            key,
            name: this.normalizeRequiredString(dto.name, 'name'),
            enabled: dto.enabled ?? false,
            config: this.toOptionalJson(dto.config),
            remark: this.normalizeNullableString(dto.remark),
            updatedByUserId: operator?.id
          },
          include: this.getFeatureFlagInclude()
        });

    await this.writeAudit(
      operator,
      'maintenance.feature_flag.create',
      'feature_flag',
      featureFlag.id,
      existing ? this.toFeatureFlagResponse(existing as FeatureFlagWithUser) : undefined,
      this.toFeatureFlagResponse(featureFlag)
    );
    return this.toFeatureFlagResponse(featureFlag);
  }

  async updateFeatureFlag(
    id: string,
    dto: Partial<SaveFeatureFlagInput>,
    operator?: AuthenticatedUser
  ) {
    const featureFlag = await this.findFeatureFlagOrThrow(id);
    const updated = await this.prisma.featureFlag.update({
      where: { id: featureFlag.id },
      data: {
        name: dto.name === undefined ? undefined : this.normalizeRequiredString(dto.name, 'name'),
        enabled: dto.enabled,
        config: dto.config === undefined ? undefined : this.toOptionalJson(dto.config),
        remark: dto.remark === undefined ? undefined : this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getFeatureFlagInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.feature_flag.update',
      'feature_flag',
      featureFlag.id,
      this.toFeatureFlagResponse(featureFlag),
      this.toFeatureFlagResponse(updated)
    );
    return this.toFeatureFlagResponse(updated);
  }

  async getConfig(key: string) {
    const normalizedKey = this.normalizeAllowedConfigKey(key);
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: normalizedKey },
      include: this.getParameterInclude()
    });
    if (parameter) return this.toParameterResponse(parameter);
    return {
      id: null,
      key: normalizedKey,
      value: this.getDefaultConfigValue(normalizedKey),
      group: 'maintenance',
      remark: null,
      updatedByUserId: null,
      createdAt: null,
      updatedAt: null,
      updatedBy: null
    };
  }

  async saveConfig(key: string, dto: SaveMaintenanceParameterInput, operator?: AuthenticatedUser) {
    const normalizedKey = this.normalizeAllowedConfigKey(key);
    return this.saveParameter(
      normalizedKey,
      {
        value: dto.value ?? this.getDefaultConfigValue(normalizedKey),
        group: 'maintenance',
        remark: dto.remark ?? this.getDefaultConfigRemark(normalizedKey)
      },
      operator,
      `maintenance.${this.toConfigActionName(normalizedKey)}.update`
    );
  }

  async getLaunchChecklist() {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: LAUNCH_CHECKLIST_KEY },
      include: this.getParameterInclude()
    });

    return {
      items: this.normalizeLaunchChecklistItems(parameter?.value ?? DEFAULT_LAUNCH_CHECKLIST_ITEMS),
      updatedAt: parameter?.updatedAt ?? null,
      updatedBy: parameter?.updatedBy ?? null
    };
  }

  async saveLaunchChecklist(dto: SaveLaunchChecklistInput, operator?: AuthenticatedUser) {
    const items = this.normalizeLaunchChecklistItems(dto.items ?? DEFAULT_LAUNCH_CHECKLIST_ITEMS);
    this.assertRequiredManualGatesAreNotWaived(items);
    const parameter = await this.saveParameter(
      LAUNCH_CHECKLIST_KEY,
      {
        value: items,
        group: 'maintenance',
        remark: '上线检查清单'
      },
      operator,
      'maintenance.launch_checklist.update'
    );

    return {
      items,
      updatedAt: parameter.updatedAt,
      updatedBy: parameter.updatedBy
    };
  }

  async listSystemParameters(query: ListSystemParametersQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.SystemParameterWhereInput = {
      group: 'maintenance',
      OR: keyword
        ? [
            { key: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await Promise.all([
      this.prisma.systemParameter.findMany({
        where,
        include: this.getParameterInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildSystemParameterOrderBy(query)
      }),
      this.prisma.systemParameter.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toParameterResponse(item)),
      total,
      pagination
    );
  }

  private buildSystemParameterOrderBy(
    query: ListSystemParametersQuery
  ): Prisma.SystemParameterOrderByWithRelationInput[] {
    const sortField = query.sortBy ? SYSTEM_PARAMETER_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ key: 'asc' }];
    }

    return [{ [sortField]: sortOrder }, { key: 'asc' }];
  }

  async createSystemParameter(dto: SaveMaintenanceParameterInput, operator?: AuthenticatedUser) {
    const key = this.normalizeCode(dto.key, 'key');
    const existing = await this.prisma.systemParameter.findUnique({ where: { key } });
    if (existing) throw new ConflictException('System parameter already exists');

    const parameter = await this.prisma.systemParameter.create({
      data: {
        key,
        value: this.toRequiredJson(dto.value),
        group: 'maintenance',
        remark: this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getParameterInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.system_parameter.create',
      'system_parameter',
      parameter.id,
      undefined,
      this.toParameterResponse(parameter)
    );
    return this.toParameterResponse(parameter);
  }

  async updateSystemParameter(
    id: string,
    dto: Partial<SaveMaintenanceParameterInput>,
    operator?: AuthenticatedUser
  ) {
    const parameter = await this.findSystemParameterOrThrow(id);
    const updated = await this.prisma.systemParameter.update({
      where: { id: parameter.id },
      data: {
        value: dto.value === undefined ? undefined : this.toRequiredJson(dto.value),
        group: 'maintenance',
        remark: dto.remark === undefined ? undefined : this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getParameterInclude()
    });

    await this.writeAudit(
      operator,
      'maintenance.system_parameter.update',
      'system_parameter',
      parameter.id,
      this.toParameterResponse(parameter),
      this.toParameterResponse(updated)
    );
    return this.toParameterResponse(updated);
  }

  private async saveParameter(
    key: string,
    dto: SaveMaintenanceParameterInput,
    operator: AuthenticatedUser | undefined,
    action: string
  ) {
    const previous = await this.prisma.systemParameter.findUnique({
      where: { key },
      include: this.getParameterInclude()
    });
    const parameter = await this.prisma.systemParameter.upsert({
      where: { key },
      update: {
        value: this.toRequiredJson(dto.value),
        group: dto.group ? this.normalizeCode(dto.group, 'group') : 'maintenance',
        remark: dto.remark === undefined ? undefined : this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      create: {
        key,
        value: this.toRequiredJson(dto.value),
        group: dto.group ? this.normalizeCode(dto.group, 'group') : 'maintenance',
        remark: this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getParameterInclude()
    });

    await this.writeAudit(
      operator,
      action,
      'system_parameter',
      parameter.id,
      previous ? this.toParameterResponse(previous) : undefined,
      this.toParameterResponse(parameter)
    );
    return this.toParameterResponse(parameter);
  }

  private async writeAudit(
    operator: AuthenticatedUser | undefined,
    action: string,
    objectType: string,
    objectId: string,
    beforeData: unknown,
    afterData: unknown
  ) {
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'maintenance',
      action,
      objectType,
      objectId,
      beforeData: beforeData === undefined ? undefined : this.toAuditJson(beforeData),
      afterData: afterData === undefined ? undefined : this.toAuditJson(afterData),
      remark: `${action} ${objectType} ${objectId}`
    });
  }

  private async findAnnouncementOrThrow(id: string) {
    const announcement = await this.prisma.appAnnouncement.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getAnnouncementInclude()
    });
    if (!announcement || announcement.deletedAt) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  private async findFeatureFlagOrThrow(id: string) {
    const featureFlag = await this.prisma.featureFlag.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getFeatureFlagInclude()
    });
    if (!featureFlag || featureFlag.deletedAt) {
      throw new NotFoundException('Feature flag not found');
    }
    return featureFlag;
  }

  private async findSystemParameterOrThrow(id: string) {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getParameterInclude()
    });
    if (!parameter || parameter.group !== 'maintenance') {
      throw new NotFoundException('System parameter not found');
    }
    return parameter;
  }

  private getUserSelect() {
    return {
      id: true,
      username: true,
      displayName: true
    };
  }

  private getAnnouncementInclude() {
    return {
      createdBy: {
        select: this.getUserSelect()
      },
      updatedBy: {
        select: this.getUserSelect()
      }
    } satisfies Prisma.AppAnnouncementInclude;
  }

  private getMaintenanceWindowInclude() {
    return {
      createdBy: {
        select: this.getUserSelect()
      },
      updatedBy: {
        select: this.getUserSelect()
      }
    } satisfies Prisma.MaintenanceWindowInclude;
  }

  private getFeatureFlagInclude() {
    return {
      updatedBy: {
        select: this.getUserSelect()
      }
    } satisfies Prisma.FeatureFlagInclude;
  }

  private getAppVersionInclude() {
    return {
      createdBy: {
        select: this.getUserSelect()
      }
    } satisfies Prisma.AppVersionInclude;
  }

  private getParameterInclude() {
    return {
      updatedBy: {
        select: this.getUserSelect()
      }
    } satisfies Prisma.SystemParameterInclude;
  }

  private getDefaultMaintenanceMode() {
    return {
      id: null,
      enabled: false,
      reason: '系统正常运行',
      allowedRoles: ['admin'],
      allowedIps: [],
      startAt: null,
      endAt: null,
      createdById: null,
      updatedByUserId: null,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
      createdBy: null,
      updatedBy: null
    };
  }

  private toAnnouncementResponse(announcement: AnnouncementWithUsers) {
    return announcement;
  }

  private toMaintenanceWindowResponse(window: MaintenanceWindowWithUsers) {
    return window;
  }

  private toFeatureFlagResponse(featureFlag: FeatureFlagWithUser) {
    return featureFlag;
  }

  private toAppVersionResponse(appVersion: AppVersionWithUser) {
    return appVersion;
  }

  private toParameterResponse(parameter: ParameterWithUser) {
    return parameter;
  }

  private toPage<T>(items: T[], total: number, pagination: { page: number; pageSize: number }) {
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  private parseAnnouncementLevel(value: unknown, strict: true): AppAnnouncementLevel;
  private parseAnnouncementLevel(value: unknown, strict?: false): AppAnnouncementLevel | undefined;
  private parseAnnouncementLevel(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('level is required');
      return undefined;
    }
    if (value === 'info' || value === 'warning' || value === 'error') return value;
    throw new BadRequestException('level is invalid');
  }

  private parseAppVersionStatus(value: unknown, strict: true): AppVersionStatus;
  private parseAppVersionStatus(value: unknown, strict?: false): AppVersionStatus | undefined;
  private parseAppVersionStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (value === 'draft' || value === 'released' || value === 'deprecated') return value;
    throw new BadRequestException('status is invalid');
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
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

  private parseNullableDate(value: string | null | undefined, field: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
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
    if (!/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
      throw new BadRequestException(`${field} format is invalid`);
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

  private normalizeStringArray(value: unknown, field: string) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException(`${field} must be an array`);
    return value.map((item, index) => this.normalizeRequiredString(item, `${field}[${index}]`));
  }

  private normalizeLaunchChecklistItems(value: unknown) {
    const items =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as { items?: unknown }).items
        : value;

    if (!Array.isArray(items)) {
      throw new BadRequestException('items must be an array');
    }

    return items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`items[${index}] must be an object`);
      }

      const input = item as LaunchChecklistItemInput;
      const status = this.normalizeLaunchChecklistStatus(input.status ?? 'pending', index);
      const priority = this.normalizeLaunchChecklistPriority(input.priority ?? 'P0', index);

      return {
        id: this.normalizeCode(input.id ?? `item_${index + 1}`, `items[${index}].id`),
        category: this.normalizeRequiredString(
          input.category ?? '上线检查',
          `items[${index}].category`
        ),
        title: this.normalizeRequiredString(input.title, `items[${index}].title`),
        priority,
        status,
        owner: this.normalizeNullableString(input.owner),
        evidence: this.normalizeNullableString(input.evidence),
        remark: this.normalizeNullableString(input.remark),
        updatedAt:
          input.updatedAt === undefined || input.updatedAt === null || input.updatedAt === ''
            ? new Date().toISOString()
            : this.parseNullableDate(input.updatedAt, `items[${index}].updatedAt`)?.toISOString()
      };
    });
  }

  private normalizeLaunchChecklistStatus(value: unknown, index: number) {
    const status = this.normalizeCode(value, `items[${index}].status`);
    if (!LAUNCH_CHECKLIST_STATUSES.includes(status)) {
      throw new BadRequestException(`items[${index}].status is invalid`);
    }
    return status;
  }

  private assertRequiredManualGatesAreNotWaived(items: Array<{ id: string; status: string }>) {
    const waivedGate = items.find(
      (item) => REQUIRED_MANUAL_GATE_IDS.includes(item.id) && item.status === 'waived'
    );
    if (waivedGate) {
      throw new BadRequestException(
        `${waivedGate.id} is a first-release P0 gate and cannot be waived`
      );
    }
  }

  private normalizeLaunchChecklistPriority(value: unknown, index: number) {
    const priority = this.normalizeRequiredString(value, `items[${index}].priority`).toUpperCase();
    if (!LAUNCH_CHECKLIST_PRIORITIES.includes(priority)) {
      throw new BadRequestException(`items[${index}].priority is invalid`);
    }
    return priority;
  }

  private toOptionalJson(value: unknown) {
    if (value === undefined || value === null) return {};
    return value as Prisma.InputJsonValue;
  }

  private toRequiredJson(value: unknown) {
    if (value === undefined || value === null) return {};
    return value as Prisma.InputJsonValue;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private normalizeAllowedConfigKey(key: string) {
    const normalizedKey = this.normalizeCode(key, 'key');
    if (
      normalizedKey !== MENU_CONFIG_KEY &&
      normalizedKey !== THEME_CONFIG_KEY &&
      normalizedKey !== SYSTEM_PARAMETERS_KEY
    ) {
      throw new BadRequestException('config key is invalid');
    }
    return normalizedKey;
  }

  private getDefaultConfigValue(key: string) {
    if (key === MENU_CONFIG_KEY) {
      return {
        collapsedByDefault: false,
        showBadges: true,
        hiddenModules: [],
        pinnedModules: ['dashboard', 'renewal']
      };
    }
    if (key === THEME_CONFIG_KEY) {
      return {
        primaryColor: '#2563eb',
        density: 'comfortable',
        darkSidebar: true,
        tableStripe: false
      };
    }
    return {
      enableMaintenanceBanner: true,
      requireVersionConfirm: false,
      supportContact: ''
    };
  }

  private getDefaultConfigRemark(key: string) {
    if (key === MENU_CONFIG_KEY) return '网站维护菜单配置';
    if (key === THEME_CONFIG_KEY) return '网站维护主题配置';
    return '网站维护系统参数';
  }

  private toConfigActionName(key: string) {
    if (key === MENU_CONFIG_KEY) return 'menu_config';
    if (key === THEME_CONFIG_KEY) return 'theme_config';
    return 'system_parameter';
  }
}
