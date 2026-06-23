import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CronJobLogStatus,
  ErrorLog,
  ErrorLogLevel,
  OpsHealthStatus,
  PlatformSyncLog,
  PlatformSyncLogStatus,
  Prisma,
  QueueStatusLog,
  SystemHealthSnapshot
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { promisify } from 'node:util';
import Redis from 'ioredis';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const execFileAsync = promisify(execFile);
const PLATFORM_STATS_WINDOW_DAYS = 30;
const PLATFORM_AUTH_PARAMETER_PREFIX = 'platform_auth_';
const PLATFORM_OAUTH_STATE_PARAMETER_PREFIX = 'platform_oauth_state_';
const APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY = 'apple_web_gateway_subscription';
const APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY = 'apple_web_gateway_nodes';
const APPLE_WEB_GATEWAY_GROUP = 'apple_web_gateway';
const PLATFORM_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OPS_STATUS_CACHE_TTL_MS = 120_000;
const OPS_REDIS_HEALTH_TIMEOUT_MS = 250;
const APPLE_WEB_GATEWAY_SYNC_TIMEOUT_MS = 20_000;

interface ListQueueStatusQuery extends PaginationQuery {
  queueName?: string;
  status?: string;
}

interface ListCronJobsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
}

interface ListPlatformSyncQuery extends PaginationQuery {
  platform?: string;
  status?: string;
}

interface ListErrorLogsQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  level?: string;
}

interface ListHealthSnapshotsQuery extends PaginationQuery {
  status?: string;
}

export interface CreateErrorLogInput {
  level?: string;
  module?: string;
  message?: string;
  stack?: string | null;
  context?: unknown;
}

export interface TestPlatformConnectionInput {
  syncType?: string;
  metadata?: unknown;
}

export interface ReauthorizePlatformInput {
  reason?: string | null;
  metadata?: unknown;
}

export interface SavePlatformAuthorizationInput {
  authMode?: 'oauth' | 'manual_token' | 'app_credentials';
  appKey?: string | null;
  appSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | Date | null;
  shopName?: string | null;
  scopes?: string[];
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  redirectUri?: string | null;
  clientIdParam?: string | null;
  clearSecrets?: boolean;
  metadata?: unknown;
}

export interface SaveAppleWebGatewaySubscriptionInput {
  subscriptionUrl?: string | null;
  clearSubscription?: boolean;
}

export interface StartPlatformOAuthInput {
  authorizationUrl?: string | null;
  redirectUri?: string | null;
  scopes?: string[];
  clientIdParam?: string | null;
  extraParams?: Record<string, string>;
}

export interface HandlePlatformOAuthCallbackInput {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface PlatformAuthorizationResponse {
  platform: string;
  displayName: string;
  configured: boolean;
  authMode: 'oauth' | 'manual_token' | 'app_credentials';
  hasAppKey: boolean;
  appKeyTail: string | null;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
  accessTokenTail: string | null;
  hasRefreshToken: boolean;
  refreshTokenTail: string | null;
  tokenExpiresAt: string | null;
  shopName: string | null;
  scopes: string[];
  authorizationUrl: string | null;
  tokenUrl: string | null;
  redirectUri: string | null;
  clientIdParam: string;
  updatedAt: Date | null;
}

export interface PlatformOAuthStartResponse {
  platform: string;
  displayName: string;
  authorizationUrl: string;
  redirectUri: string;
  stateExpiresAt: string;
}

export interface PlatformOAuthCallbackResponse {
  platform: string;
  status: 'received' | 'failed';
  stateValid: boolean;
  codeReceived: boolean;
  message: string;
}

export type AppleWebGatewayNodeStatus = 'available' | 'unavailable' | 'unknown';

export interface AppleWebGatewayNodeResponse {
  id: string;
  name: string;
  countryCode: string;
  protocol: string;
  status: AppleWebGatewayNodeStatus;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  failureReason: string | null;
}

export interface AppleWebGatewayCountrySummary {
  countryCode: string;
  total: number;
  available: number;
  unavailable: number;
  unknown: number;
}

export interface AppleWebGatewayStatusResponse {
  configured: boolean;
  subscriptionHost: string | null;
  subscriptionUrlMasked: string | null;
  updatedAt: Date | null;
  lastSyncedAt: string | null;
  nodeCount: number;
  availableNodeCount: number;
  countrySummary: AppleWebGatewayCountrySummary[];
  nodes: AppleWebGatewayNodeResponse[];
  sidecar: {
    engine: 'sing-box';
    mode: 'external_sidecar';
    managedByApi: false;
    message: string;
  };
}

export interface ComponentStatus {
  name: string;
  status: OpsHealthStatus;
  latencyMs?: number | null;
  message: string;
  checkedAt: string;
  metrics?: Record<string, unknown>;
}

export type QueueStatusLogResponse = QueueStatusLog;
export type PlatformSyncLogResponse = Omit<PlatformSyncLog, 'errorRate'> & { errorRate: string };
export type SystemHealthSnapshotResponse = Omit<SystemHealthSnapshot, 'diskUsage'> & {
  diskUsage: string | null;
};

export interface PlatformInterfaceStatus {
  platform: string;
  displayName: string;
  status: OpsHealthStatus;
  authorizationStatus:
    | 'configured'
    | 'not_configured'
    | 'not_required'
    | 'unknown'
    | 'expiring'
    | 'expired';
  tokenExpiresAt: string | null;
  lastSyncAt: Date | null;
  lastFailureReason: string | null;
  requestCount: number;
  failedRequestCount: number;
  failureLogCount: number;
  lastFailureAt: Date | null;
  retryLogCount: number;
  lastRetryAt: Date | null;
  errorRate: string;
  canReauthorize: boolean;
  canTestConnection: boolean;
  latestLog: PlatformSyncLogResponse | null;
  message: string;
}

interface PlatformLogStats {
  requestCount: number;
  failedRequestCount: number;
  failureLogCount: number;
  lastFailureAt: Date | null;
  retryLogCount: number;
  lastRetryAt: Date | null;
  errorRate: string;
}

interface PlatformLogStatsRow {
  platform: string;
  requestCount: bigint | number | string | null;
  failedRequestCount: bigint | number | string | null;
  failureLogCount: bigint | number | string | null;
  lastFailureAt: Date | null;
  retryLogCount: bigint | number | string | null;
  lastRetryAt: Date | null;
}

interface PlatformDefinition {
  platform: string;
  displayName: string;
  logAliases: string[];
  authorizationStatus: 'required' | 'not_required';
}

interface PlatformAuthorizationValue {
  authMode?: string;
  appKeyEncrypted?: string | null;
  appKeyTail?: string | null;
  appSecretEncrypted?: string | null;
  accessTokenEncrypted?: string | null;
  accessTokenTail?: string | null;
  refreshTokenEncrypted?: string | null;
  refreshTokenTail?: string | null;
  tokenExpiresAt?: string | null;
  shopName?: string | null;
  scopes?: unknown;
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  redirectUri?: string | null;
  clientIdParam?: string | null;
  metadata?: unknown;
}

interface AppleWebGatewaySubscriptionValue {
  subscriptionUrlEncrypted?: string | null;
  subscriptionHost?: string | null;
  subscriptionUrlMasked?: string | null;
  updatedAt?: string | null;
  lastSyncedAt?: string | null;
  nodeCount?: number;
  countryCodes?: unknown;
}

interface AppleWebGatewayNodeValue {
  id: string;
  name: string;
  countryCode: string;
  protocol: string;
  status: AppleWebGatewayNodeStatus;
  latencyMs?: number | null;
  lastCheckedAt?: string | null;
  failureReason?: string | null;
  rawEncrypted?: string | null;
  sourceHash?: string | null;
}

interface AppleWebGatewayNodesValue {
  items: AppleWebGatewayNodeValue[];
  syncedAt: string | null;
  sourceHash: string | null;
}

interface ParsedAppleWebGatewayNode {
  id: string;
  name: string;
  countryCode: string;
  protocol: string;
  raw: string;
  sourceHash: string;
}

@Injectable()
export class OpsService {
  private readonly statusCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async overview() {
    return this.statusCache.getOrSet('overview', OPS_STATUS_CACHE_TTL_MS, async () => {
      const [api, database, redis, fileStorage, disk, queue, recentErrors, cron, platform] =
        await Promise.all([
          this.apiStatus(),
          this.databaseStatus(),
          this.redisStatus(),
          this.fileStorageStatus(),
          this.diskSpace(),
          this.getCurrentQueueStatus(),
          this.getRecentErrors(),
          this.getLatestCronJobs(),
          this.getPlatformCurrentStatus()
        ]);
      const workers = this.toAutomationWorkerStatusFromQueue(queue);

      return {
        components: [
          api,
          database,
          redis,
          fileStorage,
          this.toComponentFromQueue(queue),
          workers,
          disk
        ],
        queue,
        workers,
        cronJobs: cron,
        platformSync: platform,
        recentErrors
      };
    });
  }

  apiStatus(): ComponentStatus {
    return {
      name: 'API',
      status: 'normal',
      latencyMs: 0,
      message: 'API process is running',
      checkedAt: new Date().toISOString(),
      metrics: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeEnv: process.env.NODE_ENV ?? 'development',
        pid: process.pid
      }
    };
  }

  async databaseStatus(): Promise<ComponentStatus> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'PostgreSQL',
        status: 'normal',
        latencyMs: Date.now() - startedAt,
        message: 'Database connection is healthy',
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'PostgreSQL',
        status: 'critical',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Database connection failed',
        checkedAt: new Date().toISOString()
      };
    }
  }

  async redisStatus(): Promise<ComponentStatus> {
    const startedAt = Date.now();
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      connectTimeout: OPS_REDIS_HEALTH_TIMEOUT_MS,
      commandTimeout: OPS_REDIS_HEALTH_TIMEOUT_MS,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      return {
        name: 'Redis',
        status: pong === 'PONG' ? 'normal' : 'warning',
        latencyMs: Date.now() - startedAt,
        message: pong === 'PONG' ? 'Redis ping is healthy' : `Unexpected Redis response: ${pong}`,
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'Redis',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Redis connection failed',
        checkedAt: new Date().toISOString()
      };
    } finally {
      redis.disconnect();
    }
  }

  async fileStorageStatus(): Promise<ComponentStatus> {
    const storageDir = process.env.ATTACHMENT_STORAGE_DIR || 'uploads';
    const startedAt = Date.now();
    try {
      await access(storageDir, fsConstants.R_OK | fsConstants.W_OK);
      return {
        name: '文件存储',
        status: 'normal',
        latencyMs: Date.now() - startedAt,
        message: `Local storage directory is readable and writable: ${storageDir}`,
        checkedAt: new Date().toISOString(),
        metrics: { storageDir }
      };
    } catch (error) {
      return {
        name: '文件存储',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Local storage check failed',
        checkedAt: new Date().toISOString(),
        metrics: { storageDir }
      };
    }
  }

  async diskSpace(): Promise<ComponentStatus> {
    const startedAt = Date.now();
    try {
      const { stdout } = await execFileAsync('df', ['-k', '.']);
      const lines = stdout.trim().split(/\r?\n/);
      const fields = lines[1]?.trim().split(/\s+/) ?? [];
      const sizeKb = Number(fields[1] ?? 0);
      const usedKb = Number(fields[2] ?? 0);
      const availableKb = Number(fields[3] ?? 0);
      const usagePercent = Number(String(fields[4] ?? '0').replace('%', ''));
      const status = this.getDiskStatus(usagePercent);
      return {
        name: '磁盘空间',
        status,
        latencyMs: Date.now() - startedAt,
        message: `Disk usage is ${usagePercent}%`,
        checkedAt: new Date().toISOString(),
        metrics: {
          sizeKb,
          usedKb,
          availableKb,
          usagePercent,
          mount: fields.slice(5).join(' ')
        }
      };
    } catch (error) {
      return {
        name: '磁盘空间',
        status: 'unknown',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Disk check failed',
        checkedAt: new Date().toISOString()
      };
    }
  }

  async queueStatus(query: ListQueueStatusQuery) {
    const current = await this.getCurrentQueueStatus();
    const pagination = getPagination(query);
    const status = this.parseHealthStatus(query.status, false);
    const where: Prisma.QueueStatusLogWhereInput = {
      queueName: query.queueName || undefined,
      status: status ?? undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.queueStatusLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { checkedAt: 'desc' }
      }),
      this.prisma.queueStatusLog.count({ where })
    ]);

    return {
      current,
      logs: this.toPage(
        items.map((item) => this.toQueueStatusResponse(item)),
        total,
        pagination
      )
    };
  }

  async cronJobs(query: ListCronJobsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseCronStatus(query.status, false);
    const where: Prisma.CronJobLogWhereInput = {
      status: status ?? undefined,
      OR: keyword
        ? [
            { jobName: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cronJobLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.cronJobLog.count({ where })
    ]);

    return this.toPage(items, total, pagination);
  }

  async platformSyncStatus(query: ListPlatformSyncQuery) {
    const current = await this.getPlatformCurrentStatus();
    const pagination = getPagination(query);
    const status = this.parsePlatformSyncStatus(query.status, false);
    const where: Prisma.PlatformSyncLogWhereInput = {
      platform: query.platform || undefined,
      status: status ?? undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformSyncLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.platformSyncLog.count({ where })
    ]);

    return {
      current,
      logs: this.toPage(
        items.map((item) => this.toPlatformSyncResponse(item)),
        total,
        pagination
      )
    };
  }

  async platformStatuses() {
    return this.statusCache.getOrSet('platform-statuses', OPS_STATUS_CACHE_TTL_MS, async () => {
      const platforms = this.getPlatformDefinitions();
      const items = await this.buildPlatformStatuses(platforms);
      this.emitPlatformAuthorizationIncidents(items);
      return { items };
    });
  }

  async platformStatus(platform: string) {
    const status = await this.buildPlatformStatus(this.getPlatformDefinition(platform));
    this.emitPlatformAuthorizationIncidents([status]);
    return status;
  }

  async getAppleWebGateways(): Promise<AppleWebGatewayStatusResponse> {
    const [subscriptionParameter, nodesParameter] = await Promise.all([
      this.getAppleWebGatewaySubscriptionParameter(),
      this.getAppleWebGatewayNodesParameter()
    ]);
    const subscription = this.normalizeAppleWebGatewaySubscriptionValue(
      subscriptionParameter?.value
    );
    const nodes = this.normalizeAppleWebGatewayNodesValue(nodesParameter?.value);

    return this.toAppleWebGatewayStatusResponse(
      subscription,
      subscriptionParameter?.updatedAt ?? null,
      nodes
    );
  }

  async saveAppleWebGatewaySubscription(
    dto: SaveAppleWebGatewaySubscriptionInput,
    operator?: AuthenticatedUser
  ): Promise<AppleWebGatewayStatusResponse> {
    const existing = await this.getAppleWebGatewaySubscriptionParameter();
    const existingValue = this.normalizeAppleWebGatewaySubscriptionValue(existing?.value);
    const clearSubscription = Boolean(dto.clearSubscription);
    const subscriptionUrl =
      dto.subscriptionUrl === undefined
        ? undefined
        : this.normalizeNullableUrl(dto.subscriptionUrl, 'subscriptionUrl');
    const now = new Date();
    const nextValue: AppleWebGatewaySubscriptionValue = {
      ...existingValue,
      updatedAt: now.toISOString()
    };

    if (clearSubscription) {
      nextValue.subscriptionUrlEncrypted = null;
      nextValue.subscriptionHost = null;
      nextValue.subscriptionUrlMasked = null;
      nextValue.lastSyncedAt = null;
      nextValue.nodeCount = 0;
      nextValue.countryCodes = [];
    } else if (subscriptionUrl !== undefined) {
      nextValue.subscriptionUrlEncrypted = subscriptionUrl
        ? this.fieldEncryptionService.encrypt(subscriptionUrl)
        : null;
      nextValue.subscriptionHost = subscriptionUrl ? this.getUrlHost(subscriptionUrl) : null;
      nextValue.subscriptionUrlMasked = subscriptionUrl
        ? this.maskSecretUrl(subscriptionUrl)
        : null;
    }

    const parameter = await this.prisma.systemParameter.upsert({
      where: { key: APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY },
      update: {
        value: this.toNullableJson(nextValue),
        group: APPLE_WEB_GATEWAY_GROUP,
        remark: 'Apple 官网检查 Worker 节点订阅配置',
        updatedByUserId: operator?.id
      },
      create: {
        key: APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY,
        value: this.toNullableJson(nextValue),
        group: APPLE_WEB_GATEWAY_GROUP,
        remark: 'Apple 官网检查 Worker 节点订阅配置',
        updatedByUserId: operator?.id
      }
    });

    if (clearSubscription) {
      await this.saveAppleWebGatewayNodesValue(
        {
          items: [],
          syncedAt: null,
          sourceHash: null
        },
        operator
      );
    }

    const response = await this.getAppleWebGateways();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.apple_web_gateway.subscription.save',
      objectType: 'system_parameter',
      objectId: parameter.id,
      beforeData: existing
        ? this.toAuditJson(
            this.toAppleWebGatewaySubscriptionAuditValue(existingValue, existing.updatedAt)
          )
        : undefined,
      afterData: this.toAuditJson(
        this.toAppleWebGatewaySubscriptionAuditValue(nextValue, parameter.updatedAt)
      ),
      remark: clearSubscription
        ? 'Cleared Apple web gateway subscription'
        : 'Saved Apple web gateway subscription'
    });

    return response;
  }

  async syncAppleWebGateways(operator?: AuthenticatedUser): Promise<AppleWebGatewayStatusResponse> {
    const subscriptionParameter = await this.getAppleWebGatewaySubscriptionParameter();
    const subscription = this.normalizeAppleWebGatewaySubscriptionValue(
      subscriptionParameter?.value
    );
    const subscriptionUrl = this.fieldEncryptionService.decrypt(
      subscription.subscriptionUrlEncrypted
    );

    if (!subscriptionUrl) {
      throw new BadRequestException('Apple web gateway subscription is not configured');
    }

    const startedAt = new Date();
    try {
      const content = await this.fetchAppleWebGatewaySubscription(subscriptionUrl);
      const parsedNodes = this.parseAppleWebGatewaySubscription(content);
      const existingNodes = this.normalizeAppleWebGatewayNodesValue(
        (await this.getAppleWebGatewayNodesParameter())?.value
      );
      const existingById = new Map(existingNodes.items.map((item) => [item.id, item]));
      const nodes: AppleWebGatewayNodeValue[] = parsedNodes.map((node) => {
        const existingNode = existingById.get(node.id);
        return {
          id: node.id,
          name: node.name,
          countryCode: node.countryCode,
          protocol: node.protocol,
          status:
            existingNode?.status ?? (node.countryCode === 'UNKNOWN' ? 'unknown' : 'available'),
          latencyMs: existingNode?.latencyMs ?? null,
          lastCheckedAt: existingNode?.lastCheckedAt ?? null,
          failureReason:
            existingNode?.failureReason ??
            (node.countryCode === 'UNKNOWN' ? '无法从节点名称识别国家' : null),
          rawEncrypted: this.fieldEncryptionService.encrypt(node.raw),
          sourceHash: node.sourceHash
        };
      });
      const syncedAt = new Date().toISOString();
      const nodesValue: AppleWebGatewayNodesValue = {
        items: nodes,
        syncedAt,
        sourceHash: this.hashText(content)
      };

      await this.saveAppleWebGatewayNodesValue(nodesValue, operator);
      await this.prisma.systemParameter.upsert({
        where: { key: APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY },
        update: {
          value: this.toNullableJson({
            ...subscription,
            lastSyncedAt: syncedAt,
            nodeCount: nodes.length,
            countryCodes: this.getAppleWebGatewayCountryCodes(nodes)
          }),
          group: APPLE_WEB_GATEWAY_GROUP,
          remark: 'Apple 官网检查 Worker 节点订阅配置',
          updatedByUserId: operator?.id
        },
        create: {
          key: APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY,
          value: this.toNullableJson({
            ...subscription,
            lastSyncedAt: syncedAt,
            nodeCount: nodes.length,
            countryCodes: this.getAppleWebGatewayCountryCodes(nodes)
          }),
          group: APPLE_WEB_GATEWAY_GROUP,
          remark: 'Apple 官网检查 Worker 节点订阅配置',
          updatedByUserId: operator?.id
        }
      });

      await this.prisma.platformSyncLog.create({
        data: {
          platform: 'apple-web-gateway',
          syncType: 'node_subscription_sync',
          status: 'success',
          requestCount: 1,
          errorRate: new PrismaNamespace.Decimal(0),
          errorMessage: null,
          startedAt,
          finishedAt: new Date(),
          metadata: this.toNullableJson({
            nodeCount: nodes.length,
            countryCodes: this.getAppleWebGatewayCountryCodes(nodes)
          })
        }
      });
      await this.auditLogsService.create({
        userId: operator?.id,
        module: 'ops',
        action: 'ops.apple_web_gateway.nodes.sync',
        objectType: 'system_parameter',
        objectId: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY,
        afterData: this.toAuditJson({
          nodeCount: nodes.length,
          countryCodes: this.getAppleWebGatewayCountryCodes(nodes)
        }),
        remark: `Synced ${nodes.length} Apple web gateway nodes`
      });

      return this.getAppleWebGateways();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple web gateway sync failed';
      await this.prisma.platformSyncLog.create({
        data: {
          platform: 'apple-web-gateway',
          syncType: 'node_subscription_sync',
          status: 'failed',
          requestCount: 1,
          errorRate: new PrismaNamespace.Decimal(1),
          errorMessage: message,
          startedAt,
          finishedAt: new Date(),
          metadata: this.toNullableJson({
            action: 'node_subscription_sync'
          })
        }
      });
      throw new BadRequestException(message);
    }
  }

  async getPlatformAuthorization(platform: string) {
    const definition = this.getPlatformDefinition(platform);
    if (definition.authorizationStatus === 'not_required') {
      throw new BadRequestException('platform does not require authorization');
    }
    return this.getPlatformAuthorizationResponse(definition);
  }

  async savePlatformAuthorization(
    platform: string,
    dto: SavePlatformAuthorizationInput,
    operator?: AuthenticatedUser
  ) {
    const definition = this.getPlatformDefinition(platform);
    if (definition.authorizationStatus === 'not_required') {
      throw new BadRequestException('platform does not require authorization');
    }

    const existing = await this.getPlatformAuthorizationParameter(definition.platform);
    const existingValue = this.normalizePlatformAuthorizationValue(existing?.value);
    const clearSecrets = Boolean(dto.clearSecrets);
    const appKey = dto.appKey === undefined ? undefined : this.normalizeNullableString(dto.appKey);
    const appSecret =
      dto.appSecret === undefined ? undefined : this.normalizeNullableString(dto.appSecret);
    const accessToken =
      dto.accessToken === undefined ? undefined : this.normalizeNullableString(dto.accessToken);
    const refreshToken =
      dto.refreshToken === undefined ? undefined : this.normalizeNullableString(dto.refreshToken);
    const tokenExpiresAt = this.parseOptionalDate(dto.tokenExpiresAt, 'tokenExpiresAt');
    const value: PlatformAuthorizationValue = {
      authMode: this.parseAuthMode(dto.authMode ?? existingValue.authMode ?? 'oauth'),
      appKeyEncrypted: this.resolveEncryptedField(
        existingValue.appKeyEncrypted,
        appKey,
        clearSecrets
      ),
      appKeyTail: this.resolveSecretTail(existingValue.appKeyTail, appKey, clearSecrets),
      appSecretEncrypted: this.resolveEncryptedField(
        existingValue.appSecretEncrypted,
        appSecret,
        clearSecrets
      ),
      accessTokenEncrypted: this.resolveEncryptedField(
        existingValue.accessTokenEncrypted,
        accessToken,
        clearSecrets
      ),
      accessTokenTail: this.resolveSecretTail(
        existingValue.accessTokenTail,
        accessToken,
        clearSecrets
      ),
      refreshTokenEncrypted: this.resolveEncryptedField(
        existingValue.refreshTokenEncrypted,
        refreshToken,
        clearSecrets
      ),
      refreshTokenTail: this.resolveSecretTail(
        existingValue.refreshTokenTail,
        refreshToken,
        clearSecrets
      ),
      tokenExpiresAt:
        dto.tokenExpiresAt === undefined
          ? (existingValue.tokenExpiresAt ?? null)
          : (tokenExpiresAt?.toISOString() ?? null),
      shopName:
        dto.shopName === undefined
          ? (existingValue.shopName ?? null)
          : this.normalizeNullableString(dto.shopName),
      authorizationUrl:
        dto.authorizationUrl === undefined
          ? (existingValue.authorizationUrl ?? null)
          : this.normalizeNullableUrl(dto.authorizationUrl, 'authorizationUrl'),
      tokenUrl:
        dto.tokenUrl === undefined
          ? (existingValue.tokenUrl ?? null)
          : this.normalizeNullableUrl(dto.tokenUrl, 'tokenUrl'),
      redirectUri:
        dto.redirectUri === undefined
          ? (existingValue.redirectUri ?? null)
          : this.normalizeNullableUrl(dto.redirectUri, 'redirectUri'),
      clientIdParam:
        dto.clientIdParam === undefined
          ? (existingValue.clientIdParam ?? 'client_id')
          : this.normalizeOAuthParamName(dto.clientIdParam || 'client_id', 'clientIdParam'),
      scopes:
        dto.scopes === undefined
          ? this.normalizeStringArray(existingValue.scopes)
          : this.normalizeStringArray(dto.scopes),
      metadata:
        dto.metadata === undefined
          ? (existingValue.metadata ?? {})
          : (this.toObject(dto.metadata) ?? {})
    };

    const parameter = await this.prisma.systemParameter.upsert({
      where: { key: this.getPlatformAuthorizationParameterKey(definition.platform) },
      update: {
        value: this.toNullableJson(value),
        group: 'platform_auth',
        remark: `${definition.displayName}平台授权配置`,
        updatedByUserId: operator?.id
      },
      create: {
        key: this.getPlatformAuthorizationParameterKey(definition.platform),
        value: this.toNullableJson(value),
        group: 'platform_auth',
        remark: `${definition.displayName}平台授权配置`,
        updatedByUserId: operator?.id
      }
    });
    const response = this.toPlatformAuthorizationResponse(definition, value, parameter.updatedAt);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.platform.authorization.save',
      objectType: 'system_parameter',
      objectId: parameter.id,
      beforeData: existing
        ? this.toAuditJson(
            this.toPlatformAuthorizationResponse(definition, existingValue, existing.updatedAt)
          )
        : undefined,
      afterData: this.toAuditJson(response),
      remark: `Saved platform authorization ${definition.platform}`
    });

    await this.prisma.platformSyncLog.create({
      data: {
        platform: definition.platform,
        syncType: 'authorization_config',
        status: response.configured ? 'success' : 'failed',
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(response.configured ? 0 : 1),
        errorMessage: response.configured ? null : 'Platform authorization secrets are empty',
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: this.toNullableJson({
          action: 'authorization_config',
          authMode: response.authMode,
          hasAppKey: response.hasAppKey,
          hasAccessToken: response.hasAccessToken,
          hasRefreshToken: response.hasRefreshToken,
          tokenExpiresAt: response.tokenExpiresAt,
          authorizationUrlConfigured: Boolean(response.authorizationUrl),
          redirectUriConfigured: Boolean(response.redirectUri)
        })
      }
    });

    return response;
  }

  async startPlatformOAuth(
    platform: string,
    dto: StartPlatformOAuthInput = {},
    operator?: AuthenticatedUser
  ): Promise<PlatformOAuthStartResponse> {
    const definition = this.getPlatformDefinition(platform);
    if (definition.authorizationStatus === 'not_required') {
      throw new BadRequestException('platform does not require authorization');
    }

    const parameter = await this.getPlatformAuthorizationParameter(definition.platform);
    const value = this.normalizePlatformAuthorizationValue(parameter?.value);
    const appKey = this.fieldEncryptionService.decrypt(value.appKeyEncrypted);
    if (!appKey) {
      throw new BadRequestException('platform appKey is required before OAuth authorization');
    }

    const authorizationUrl = this.normalizeUrl(
      dto.authorizationUrl ?? value.authorizationUrl,
      'authorizationUrl'
    );
    const redirectUri = this.normalizeUrl(
      dto.redirectUri ?? value.redirectUri ?? this.getDefaultOAuthRedirectUri(definition.platform),
      'redirectUri'
    );
    const scopes =
      dto.scopes === undefined
        ? this.normalizeStringArray(value.scopes)
        : this.normalizeStringArray(dto.scopes);
    const clientIdParam = this.normalizeOAuthParamName(
      dto.clientIdParam ?? value.clientIdParam ?? 'client_id',
      'clientIdParam'
    );
    const state = randomBytes(24).toString('base64url');
    const stateHash = this.hashRequired(state, 'state');
    const stateExpiresAt = new Date(Date.now() + PLATFORM_OAUTH_STATE_TTL_MS);
    const stateParameter = await this.prisma.systemParameter.upsert({
      where: { key: this.getPlatformOAuthStateParameterKey(definition.platform, stateHash) },
      update: {
        value: this.toNullableJson({
          platform: definition.platform,
          stateHash,
          redirectUri,
          scopes,
          status: 'pending',
          createdByUserId: operator?.id ?? null,
          expiresAt: stateExpiresAt.toISOString()
        }),
        group: 'platform_oauth_state',
        remark: `${definition.displayName} OAuth state`,
        updatedByUserId: operator?.id
      },
      create: {
        key: this.getPlatformOAuthStateParameterKey(definition.platform, stateHash),
        value: this.toNullableJson({
          platform: definition.platform,
          stateHash,
          redirectUri,
          scopes,
          status: 'pending',
          createdByUserId: operator?.id ?? null,
          expiresAt: stateExpiresAt.toISOString()
        }),
        group: 'platform_oauth_state',
        remark: `${definition.displayName} OAuth state`,
        updatedByUserId: operator?.id
      }
    });
    const url = new URL(authorizationUrl);
    url.searchParams.set(clientIdParam, appKey);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    if (scopes.length) url.searchParams.set('scope', scopes.join(' '));
    for (const [key, rawValue] of Object.entries(dto.extraParams ?? {})) {
      if (typeof rawValue === 'string' && rawValue.trim()) {
        url.searchParams.set(this.normalizeOAuthParamName(key, 'extraParams'), rawValue.trim());
      }
    }

    const response: PlatformOAuthStartResponse = {
      platform: definition.platform,
      displayName: definition.displayName,
      authorizationUrl: url.toString(),
      redirectUri,
      stateExpiresAt: stateExpiresAt.toISOString()
    };
    await this.prisma.platformSyncLog.create({
      data: {
        platform: definition.platform,
        syncType: 'oauth_start',
        status: 'success',
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(0),
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: this.toNullableJson({
          action: 'oauth_start',
          redirectUri,
          scopes,
          stateParameterId: stateParameter.id
        })
      }
    });
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.platform.oauth.start',
      objectType: 'system_parameter',
      objectId: stateParameter.id,
      afterData: this.toAuditJson({
        platform: response.platform,
        redirectUri: response.redirectUri,
        stateExpiresAt: response.stateExpiresAt,
        scopes
      }),
      remark: `Started platform OAuth ${definition.platform}`
    });

    return response;
  }

  async handlePlatformOAuthCallback(
    platform: string,
    dto: HandlePlatformOAuthCallbackInput
  ): Promise<PlatformOAuthCallbackResponse> {
    const definition = this.getPlatformDefinition(platform);
    if (definition.authorizationStatus === 'not_required') {
      throw new BadRequestException('platform does not require authorization');
    }

    const state = this.normalizeRequiredString(dto.state, 'state');
    const stateHash = this.hashRequired(state, 'state');
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: this.getPlatformOAuthStateParameterKey(definition.platform, stateHash) }
    });
    const stateValue = this.toObject(parameter?.value);
    const expiresAt = this.parseOptionalDate(stateValue?.expiresAt, 'expiresAt');
    const expiresAtTime = expiresAt?.getTime() ?? 0;
    const stateValid =
      Boolean(parameter) && stateValue?.status === 'pending' && expiresAtTime >= Date.now();
    const errorMessage =
      this.normalizeNullableString(dto.errorDescription) ?? this.normalizeNullableString(dto.error);
    const code = this.normalizeNullableString(dto.code);
    const status: PlatformOAuthCallbackResponse['status'] =
      stateValid && code && !errorMessage ? 'received' : 'failed';
    const message =
      status === 'received'
        ? 'OAuth callback received. Token exchange is waiting for real platform adapter.'
        : errorMessage || 'OAuth callback failed or expired';

    if (parameter) {
      await this.prisma.systemParameter.update({
        where: { id: parameter.id },
        data: {
          value: this.toNullableJson({
            ...(stateValue ?? {}),
            status,
            receivedAt: new Date().toISOString(),
            errorMessage,
            authorizationCodeEncrypted:
              status === 'received' ? this.fieldEncryptionService.encrypt(code) : null,
            authorizationCodeTail: status === 'received' ? this.getTail(code) : null
          }),
          updatedByUserId: null
        }
      });
    }

    const log = await this.prisma.platformSyncLog.create({
      data: {
        platform: definition.platform,
        syncType: 'oauth_callback',
        status: status === 'received' ? 'success' : 'failed',
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(status === 'received' ? 0 : 1),
        errorMessage: status === 'received' ? null : message,
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: this.toNullableJson({
          action: 'oauth_callback',
          stateValid,
          codeReceived: Boolean(code),
          status
        })
      }
    });
    await this.auditLogsService.create({
      module: 'ops',
      action: 'ops.platform.oauth.callback',
      objectType: 'platform_sync_log',
      objectId: log.id,
      afterData: this.toAuditJson({
        platform: definition.platform,
        status,
        stateValid,
        codeReceived: Boolean(code),
        message
      }),
      remark: `Handled platform OAuth callback ${definition.platform}`
    });

    return {
      platform: definition.platform,
      status,
      stateValid,
      codeReceived: Boolean(code),
      message
    };
  }

  async automationWorkers(): Promise<ComponentStatus> {
    const [waitingCount, runningCount, failedCount, manualCount] = await this.prisma.$transaction([
      this.prisma.automationTask.count({ where: { status: { in: ['pending', 'queued'] } } }),
      this.prisma.automationTask.count({ where: { status: 'running' } }),
      this.prisma.automationTask.count({ where: { status: 'failed' } }),
      this.prisma.automationTask.count({
        where: { status: { in: ['waiting_manual_verify', 'need_review'] } }
      })
    ]);
    const status =
      failedCount > 0 ? 'error' : waitingCount + runningCount > 0 ? 'warning' : 'normal';

    return {
      name: '自动化 Worker',
      status,
      latencyMs: null,
      message:
        status === 'normal'
          ? 'No pending automation workload'
          : '真实 Apple ID 自动化 Worker 尚未接入，请关注待处理任务',
      checkedAt: new Date().toISOString(),
      metrics: {
        waitingCount,
        runningCount,
        failedCount,
        manualCount,
        workerMode: 'placeholder'
      }
    };
  }

  async errorLogs(query: ListErrorLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const level = this.parseErrorLevel(query.level, false);
    const where: Prisma.ErrorLogWhereInput = {
      module: query.module || undefined,
      level: level ?? undefined,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { message: { contains: keyword, mode: 'insensitive' } },
            { stack: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.errorLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { occurredAt: 'desc' }
      }),
      this.prisma.errorLog.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toErrorLogResponse(item)),
      total,
      pagination
    );
  }

  async createErrorLog(dto: CreateErrorLogInput, operator?: AuthenticatedUser) {
    const log = await this.prisma.errorLog.create({
      data: {
        level: this.parseErrorLevel(dto.level ?? 'error', true),
        module: this.normalizeRequiredString(dto.module, 'module'),
        message: this.normalizeRequiredString(dto.message, 'message'),
        stack: this.normalizeNullableString(dto.stack),
        context: this.toNullableJson(dto.context)
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.error_log.create',
      objectType: 'error_log',
      objectId: log.id,
      afterData: this.toAuditJson(this.toErrorLogResponse(log)),
      remark: `Created error log ${log.id}`
    });

    return this.toErrorLogResponse(log);
  }

  async healthSnapshots(query: ListHealthSnapshotsQuery) {
    const pagination = getPagination(query);
    const status = this.parseHealthStatus(query.status, false);
    const where: Prisma.SystemHealthSnapshotWhereInput = status
      ? {
          OR: [
            { apiStatus: status },
            { dbStatus: status },
            { redisStatus: status },
            { storageStatus: status },
            { queueStatus: status },
            { workerStatus: status }
          ]
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.systemHealthSnapshot.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { checkedAt: 'desc' }
      }),
      this.prisma.systemHealthSnapshot.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toHealthSnapshotResponse(item)),
      total,
      pagination
    );
  }

  async captureHealthSnapshot(operator?: AuthenticatedUser) {
    const [api, database, redis, fileStorage, disk, queue, worker] = await Promise.all([
      this.apiStatus(),
      this.databaseStatus(),
      this.redisStatus(),
      this.fileStorageStatus(),
      this.diskSpace(),
      this.getCurrentQueueStatus(),
      this.automationWorkers()
    ]);
    const diskUsage = this.getMetricNumber(disk.metrics?.usagePercent);
    const snapshot = await this.prisma.systemHealthSnapshot.create({
      data: {
        apiStatus: api.status,
        dbStatus: database.status,
        redisStatus: redis.status,
        storageStatus: fileStorage.status,
        queueStatus: queue.status,
        workerStatus: worker.status,
        diskUsage:
          diskUsage === null ? undefined : new PrismaNamespace.Decimal(diskUsage.toFixed(4)),
        metrics: this.toNullableJson({
          api,
          database,
          redis,
          fileStorage,
          disk,
          queue,
          worker
        })
      }
    });
    const queueLog = await this.prisma.queueStatusLog.create({
      data: {
        queueName: queue.queueName,
        waitingCount: queue.waitingCount,
        activeCount: queue.activeCount,
        failedCount: queue.failedCount,
        delayedCount: queue.delayedCount,
        status: queue.status
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.health_snapshot.create',
      objectType: 'system_health_snapshot',
      objectId: snapshot.id,
      afterData: this.toAuditJson(this.toHealthSnapshotResponse(snapshot)),
      remark: `Captured health snapshot ${snapshot.id}`
    });
    await this.notifyOpsIncidents({ database, queue, disk });

    return {
      snapshot: this.toHealthSnapshotResponse(snapshot),
      queueLog: this.toQueueStatusResponse(queueLog)
    };
  }

  async testPlatformConnection(
    platform: string,
    dto: TestPlatformConnectionInput,
    operator?: AuthenticatedUser
  ) {
    const definition = this.getPlatformDefinition(platform);
    const normalizedPlatform = definition.platform;
    const syncType = this.normalizeCode(dto.syncType || 'test', 'syncType');
    const startedAt = new Date();
    const result = await this.getPlatformTestResult(normalizedPlatform);
    const finishedAt = new Date();
    const log = await this.prisma.platformSyncLog.create({
      data: {
        platform: normalizedPlatform,
        syncType,
        status: result.status,
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(result.status === 'success' ? 0 : 1),
        errorMessage: result.errorMessage,
        startedAt,
        finishedAt,
        metadata: this.toNullableJson({
          ...(this.toObject(dto.metadata) ?? {}),
          message: result.message,
          status: result.healthStatus
        })
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.platform.test_connection',
      objectType: 'platform_sync_log',
      objectId: log.id,
      afterData: this.toAuditJson(this.toPlatformSyncResponse(log)),
      remark: `Tested platform connection ${normalizedPlatform}`
    });

    return {
      platform: normalizedPlatform,
      syncType,
      status: result.healthStatus,
      message: result.message,
      log: this.toPlatformSyncResponse(log)
    };
  }

  async reauthorizePlatform(
    platform: string,
    dto: ReauthorizePlatformInput,
    operator?: AuthenticatedUser
  ) {
    const definition = this.getPlatformDefinition(platform);
    const startedAt = new Date();
    const finishedAt = new Date();
    const unsupportedMessage =
      definition.authorizationStatus === 'not_required'
        ? `${definition.displayName} 不需要重新授权`
        : `${definition.displayName} 真实重新授权流程尚未接入，请在平台后台完成授权后回到本页测试连接`;
    const log = await this.prisma.platformSyncLog.create({
      data: {
        platform: definition.platform,
        syncType: 'reauthorize',
        status: 'failed',
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(1),
        errorMessage: unsupportedMessage,
        startedAt,
        finishedAt,
        metadata: this.toNullableJson({
          ...(this.toObject(dto.metadata) ?? {}),
          reason: this.normalizeNullableString(dto.reason),
          action: 'reauthorize',
          supported: false
        })
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'ops',
      action: 'ops.platform.reauthorize',
      objectType: 'platform_sync_log',
      objectId: log.id,
      afterData: this.toAuditJson(this.toPlatformSyncResponse(log)),
      remark: `Requested platform reauthorization ${definition.platform}`
    });

    return {
      platform: definition.platform,
      supported: false,
      status: 'manual_required',
      message: unsupportedMessage,
      log: this.toPlatformSyncResponse(log)
    };
  }

  private async getRecentErrors() {
    const items = await this.prisma.errorLog.findMany({
      take: 8,
      orderBy: { occurredAt: 'desc' }
    });
    return items.map((item) => this.toErrorLogResponse(item));
  }

  private async getLatestCronJobs() {
    return this.prisma.cronJobLog.findMany({
      take: 8,
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  private async getCurrentQueueStatus() {
    const [waitingCount, activeCount, failedCount, delayedCount] = await this.prisma.$transaction([
      this.prisma.automationTask.count({ where: { status: { in: ['pending', 'queued'] } } }),
      this.prisma.automationTask.count({ where: { status: 'running' } }),
      this.prisma.automationTask.count({ where: { status: 'failed' } }),
      this.prisma.automationTask.count({
        where: { status: { in: ['waiting_manual_verify', 'need_review'] } }
      })
    ]);
    return {
      queueName: 'apple_automation',
      waitingCount,
      activeCount,
      failedCount,
      delayedCount,
      status: this.getQueueStatus(waitingCount, activeCount, failedCount, delayedCount),
      checkedAt: new Date().toISOString()
    };
  }

  private async getPlatformCurrentStatus() {
    const platforms = this.getPlatformDefinitions();
    const aliases = platforms.flatMap((platform) => platform.logAliases);
    const statsWindowStart = this.getPlatformStatsWindowStart();
    const [latestLogs, statsByAlias] = await Promise.all([
      this.prisma.platformSyncLog.findMany({
        where: { platform: { in: aliases } },
        take: 50,
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.getPlatformStatsByAlias(aliases, statsWindowStart)
    ]);
    return platforms.map((platform) => {
      const latest = latestLogs.find((log) => platform.logAliases.includes(log.platform));
      const stats = this.getPlatformStatsForDefinition(statsByAlias, platform);
      if (!latest) {
        return {
          platform: platform.platform,
          status: 'unknown' as OpsHealthStatus,
          syncType: null,
          lastCheckedAt: null,
          requestCount: 0,
          failedRequestCount: 0,
          failureLogCount: 0,
          lastFailureAt: null,
          retryLogCount: 0,
          lastRetryAt: null,
          errorRate: '0',
          errorMessage: '尚未测试连接或同步'
        };
      }
      return {
        platform: platform.platform,
        status: latest.status === 'success' ? 'normal' : 'error',
        syncType: latest.syncType,
        lastCheckedAt: latest.finishedAt ?? latest.createdAt,
        requestCount: stats.requestCount,
        failedRequestCount: stats.failedRequestCount,
        failureLogCount: stats.failureLogCount,
        lastFailureAt: stats.lastFailureAt,
        retryLogCount: stats.retryLogCount,
        lastRetryAt: stats.lastRetryAt,
        errorRate: stats.errorRate,
        errorMessage: latest.errorMessage
      };
    });
  }

  private toComponentFromQueue(queue: Awaited<ReturnType<OpsService['getCurrentQueueStatus']>>) {
    return {
      name: '队列',
      status: queue.status,
      latencyMs: null,
      message:
        queue.status === 'normal'
          ? 'Queue workload is normal'
          : `Queue waiting ${queue.waitingCount}, failed ${queue.failedCount}`,
      checkedAt: queue.checkedAt,
      metrics: {
        waitingCount: queue.waitingCount,
        activeCount: queue.activeCount,
        failedCount: queue.failedCount,
        delayedCount: queue.delayedCount
      }
    };
  }

  private toAutomationWorkerStatusFromQueue(
    queue: Awaited<ReturnType<OpsService['getCurrentQueueStatus']>>
  ): ComponentStatus {
    const waitingCount = queue.waitingCount;
    const runningCount = queue.activeCount;
    const failedCount = queue.failedCount;
    const manualCount = queue.delayedCount;
    const status =
      failedCount > 0 ? 'error' : waitingCount + runningCount > 0 ? 'warning' : 'normal';

    return {
      name: '自动化 Worker',
      status,
      latencyMs: null,
      message:
        status === 'normal'
          ? 'No pending automation workload'
          : '真实 Apple ID 自动化 Worker 尚未接入，请关注待处理任务',
      checkedAt: queue.checkedAt,
      metrics: {
        waitingCount,
        runningCount,
        failedCount,
        manualCount,
        workerMode: 'placeholder'
      }
    };
  }

  private async notifyOpsIncidents(input: {
    database: ComponentStatus;
    queue: Awaited<ReturnType<OpsService['getCurrentQueueStatus']>>;
    disk: ComponentStatus;
  }) {
    const events: Array<{ eventCode: string; title: string; summary: string; detail: string }> = [];
    if (input.database.status === 'error' || input.database.status === 'critical') {
      events.push({
        eventCode: 'ops.database.connection_abnormal',
        title: '数据库连接异常',
        summary: '数据库健康检查失败',
        detail: input.database.message
      });
    }
    if (input.queue.status === 'warning' || input.queue.status === 'error') {
      events.push({
        eventCode: 'ops.queue.backlog',
        title: '队列积压严重',
        summary: `队列 ${input.queue.queueName} 状态异常`,
        detail: `waiting=${input.queue.waitingCount}, failed=${input.queue.failedCount}, delayed=${input.queue.delayedCount}`
      });
    }
    if (input.disk.status === 'critical') {
      events.push({
        eventCode: 'ops.disk.low',
        title: '磁盘空间不足',
        summary: '磁盘空间已达到高风险阈值',
        detail: input.disk.message
      });
    }

    for (const event of events) {
      try {
        await this.notificationsService.triggerEvent({
          eventCode: event.eventCode,
          module: 'ops',
          title: event.title,
          content: event.summary,
          payload: {
            title: event.title,
            summary: event.summary,
            detail: event.detail
          }
        });
      } catch {
        // 运维快照不能因为系统通知异常而写入失败。
      }
    }
  }

  private getAppleWebGatewaySubscriptionParameter() {
    return this.prisma.systemParameter.findUnique({
      where: { key: APPLE_WEB_GATEWAY_SUBSCRIPTION_PARAMETER_KEY }
    });
  }

  private getAppleWebGatewayNodesParameter() {
    return this.prisma.systemParameter.findUnique({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY }
    });
  }

  private async saveAppleWebGatewayNodesValue(
    value: AppleWebGatewayNodesValue,
    operator?: AuthenticatedUser
  ) {
    return this.prisma.systemParameter.upsert({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY },
      update: {
        value: this.toNullableJson(value),
        group: APPLE_WEB_GATEWAY_GROUP,
        remark: 'Apple 官网检查 Worker 节点池',
        updatedByUserId: operator?.id
      },
      create: {
        key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY,
        value: this.toNullableJson(value),
        group: APPLE_WEB_GATEWAY_GROUP,
        remark: 'Apple 官网检查 Worker 节点池',
        updatedByUserId: operator?.id
      }
    });
  }

  private normalizeAppleWebGatewaySubscriptionValue(
    value: unknown
  ): AppleWebGatewaySubscriptionValue {
    const data = this.toObject(value) ?? {};
    return {
      subscriptionUrlEncrypted: this.getNullableString(data.subscriptionUrlEncrypted),
      subscriptionHost: this.getNullableString(data.subscriptionHost),
      subscriptionUrlMasked: this.getNullableString(data.subscriptionUrlMasked),
      updatedAt: this.getNullableString(data.updatedAt),
      lastSyncedAt: this.getNullableString(data.lastSyncedAt),
      nodeCount: this.getMetricNumber(data.nodeCount) ?? 0,
      countryCodes: this.normalizeStringArray(data.countryCodes)
    };
  }

  private normalizeAppleWebGatewayNodesValue(value: unknown): AppleWebGatewayNodesValue {
    const data = this.toObject(value) ?? {};
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems
      .map((item) => this.normalizeAppleWebGatewayNodeValue(item))
      .filter((item): item is AppleWebGatewayNodeValue => Boolean(item));

    return {
      items,
      syncedAt: this.getNullableString(data.syncedAt),
      sourceHash: this.getNullableString(data.sourceHash)
    };
  }

  private normalizeAppleWebGatewayNodeValue(value: unknown): AppleWebGatewayNodeValue | null {
    const data = this.toObject(value);
    if (!data) return null;
    const id = this.getNullableString(data.id);
    const name = this.getNullableString(data.name);
    const countryCode = this.getNullableString(data.countryCode);
    const protocol = this.getNullableString(data.protocol);
    if (!id || !name || !countryCode || !protocol) return null;

    return {
      id,
      name,
      countryCode: countryCode.toUpperCase(),
      protocol: protocol.toLowerCase(),
      status: this.parseAppleWebGatewayNodeStatus(data.status),
      latencyMs: this.getMetricNumber(data.latencyMs),
      lastCheckedAt: this.getNullableString(data.lastCheckedAt),
      failureReason: this.getNullableString(data.failureReason),
      rawEncrypted: this.getNullableString(data.rawEncrypted),
      sourceHash: this.getNullableString(data.sourceHash)
    };
  }

  private parseAppleWebGatewayNodeStatus(value: unknown): AppleWebGatewayNodeStatus {
    if (value === 'available' || value === 'unavailable' || value === 'unknown') return value;
    return 'unknown';
  }

  private toAppleWebGatewayStatusResponse(
    subscription: AppleWebGatewaySubscriptionValue,
    updatedAt: Date | null,
    nodesValue: AppleWebGatewayNodesValue
  ): AppleWebGatewayStatusResponse {
    const nodes = nodesValue.items
      .map((node) => this.toAppleWebGatewayNodeResponse(node))
      .sort((left, right) =>
        `${left.countryCode}:${left.name}`.localeCompare(`${right.countryCode}:${right.name}`)
      );

    return {
      configured: Boolean(subscription.subscriptionUrlEncrypted),
      subscriptionHost: subscription.subscriptionHost ?? null,
      subscriptionUrlMasked: subscription.subscriptionUrlMasked ?? null,
      updatedAt,
      lastSyncedAt: subscription.lastSyncedAt ?? nodesValue.syncedAt,
      nodeCount: nodes.length,
      availableNodeCount: nodes.filter((node) => node.status === 'available').length,
      countrySummary: this.buildAppleWebGatewayCountrySummary(nodes),
      nodes,
      sidecar: {
        engine: 'sing-box',
        mode: 'external_sidecar',
        managedByApi: false,
        message: '当前后台只管理节点订阅和节点分配，sing-box sidecar 由服务器部署脚本管理。'
      }
    };
  }

  private toAppleWebGatewayNodeResponse(
    node: AppleWebGatewayNodeValue
  ): AppleWebGatewayNodeResponse {
    return {
      id: node.id,
      name: node.name,
      countryCode: node.countryCode,
      protocol: node.protocol,
      status: node.status,
      latencyMs: node.latencyMs ?? null,
      lastCheckedAt: node.lastCheckedAt ?? null,
      failureReason: node.failureReason ?? null
    };
  }

  private buildAppleWebGatewayCountrySummary(
    nodes: AppleWebGatewayNodeResponse[]
  ): AppleWebGatewayCountrySummary[] {
    const summary = new Map<string, AppleWebGatewayCountrySummary>();
    for (const node of nodes) {
      const item =
        summary.get(node.countryCode) ??
        ({
          countryCode: node.countryCode,
          total: 0,
          available: 0,
          unavailable: 0,
          unknown: 0
        } satisfies AppleWebGatewayCountrySummary);
      item.total += 1;
      item[node.status] += 1;
      summary.set(node.countryCode, item);
    }

    return Array.from(summary.values()).sort((left, right) =>
      left.countryCode.localeCompare(right.countryCode)
    );
  }

  private toAppleWebGatewaySubscriptionAuditValue(
    value: AppleWebGatewaySubscriptionValue,
    updatedAt: Date | null
  ) {
    return {
      configured: Boolean(value.subscriptionUrlEncrypted),
      subscriptionHost: value.subscriptionHost ?? null,
      subscriptionUrlMasked: value.subscriptionUrlMasked ?? null,
      lastSyncedAt: value.lastSyncedAt ?? null,
      nodeCount: value.nodeCount ?? 0,
      countryCodes: this.normalizeStringArray(value.countryCodes),
      updatedAt: updatedAt?.toISOString() ?? value.updatedAt ?? null
    };
  }

  private async fetchAppleWebGatewaySubscription(subscriptionUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APPLE_WEB_GATEWAY_SYNC_TIMEOUT_MS);
    try {
      const response = await fetch(subscriptionUrl, {
        signal: controller.signal,
        headers: {
          'user-agent': 'AppleBusinessGatewaySync/1.0'
        }
      });
      if (!response.ok) {
        throw new BadRequestException(
          `Apple web gateway subscription returned HTTP ${response.status}`
        );
      }
      const text = await response.text();
      if (!text.trim()) {
        throw new BadRequestException('Apple web gateway subscription is empty');
      }
      return text;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Apple web gateway subscription sync timed out'
          : 'Apple web gateway subscription sync failed';
      throw new BadRequestException(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseAppleWebGatewaySubscription(content: string): ParsedAppleWebGatewayNode[] {
    const candidates = new Map<string, ParsedAppleWebGatewayNode>();
    const variants = [content, this.tryDecodeSubscriptionBase64(content)].filter(
      (item): item is string => Boolean(item)
    );

    for (const variant of variants) {
      for (const uri of this.extractAppleWebGatewayUris(variant)) {
        const node = this.parseAppleWebGatewayUri(uri);
        if (node) candidates.set(node.id, node);
      }
      for (const node of this.extractClashAppleWebGatewayNodes(variant)) {
        candidates.set(node.id, node);
      }
    }

    const nodes = Array.from(candidates.values()).sort((left, right) =>
      `${left.countryCode}:${left.name}`.localeCompare(`${right.countryCode}:${right.name}`)
    );
    if (!nodes.length) {
      throw new BadRequestException('No supported Apple web gateway nodes were found');
    }
    return nodes;
  }

  private extractAppleWebGatewayUris(content: string) {
    const supportedSchemes = '(?:vmess|vless|trojan|ss|ssr|hysteria2|hy2)';
    const uris = new Set<string>();
    for (const line of content.split(/\r?\n/)) {
      const matches = line.match(new RegExp(`${supportedSchemes}:\\/\\/[^\\s"']+`, 'gi')) ?? [];
      for (const match of matches) {
        uris.add(match.replace(/[),\]}]+$/g, '').trim());
      }
    }
    return Array.from(uris);
  }

  private parseAppleWebGatewayUri(raw: string): ParsedAppleWebGatewayNode | null {
    const schemeMatch = raw.match(/^([a-zA-Z0-9+.-]+):\/\//);
    if (!schemeMatch) return null;
    const protocol = this.normalizeAppleWebGatewayProtocol(schemeMatch[1]);
    const parsed =
      protocol === 'vmess' ? this.parseVmessGatewayUri(raw) : this.parseUrlStyleGatewayUri(raw);

    const displayName = this.sanitizeGatewayNodeName(
      parsed.name ?? parsed.server ?? `${protocol.toUpperCase()} 节点`
    );
    const countryCode = this.inferAppleWebGatewayCountryCode(displayName, parsed.server);
    const sourceHash = this.hashText(raw);

    return {
      id: `awg_${sourceHash.slice(0, 16)}`,
      name: displayName,
      countryCode,
      protocol,
      raw,
      sourceHash
    };
  }

  private parseVmessGatewayUri(raw: string) {
    const encoded = raw.replace(/^vmess:\/\//i, '');
    const decoded = this.decodeBase64Loose(encoded);
    const data = decoded ? this.safeJsonParse(decoded) : null;
    return {
      name:
        this.getNullableString(data?.ps) ??
        this.getNullableString(data?.name) ??
        this.getNullableString(data?.remarks),
      server: this.getNullableString(data?.add) ?? this.getNullableString(data?.server)
    };
  }

  private parseUrlStyleGatewayUri(raw: string) {
    try {
      const url = new URL(raw);
      const name = url.hash ? decodeURIComponent(url.hash.slice(1).replace(/\+/g, ' ')) : null;
      return {
        name: this.getNullableString(name),
        server: this.getNullableString(url.hostname)
      };
    } catch {
      const nameMatch = raw.match(/#(.+)$/);
      return {
        name: nameMatch ? this.getNullableString(decodeURIComponent(nameMatch[1])) : null,
        server: null
      };
    }
  }

  private extractClashAppleWebGatewayNodes(content: string): ParsedAppleWebGatewayNode[] {
    const nodes: ParsedAppleWebGatewayNode[] = [];
    const inlineMatches = content.matchAll(/-\s*\{([^}]+)\}/g);
    for (const match of inlineMatches) {
      const node = this.toParsedAppleWebGatewayNodeFromMap(
        this.parseInlineGatewayNodeMap(match[1] ?? ''),
        match[0]
      );
      if (node) nodes.push(node);
    }

    const blocks = this.parseBlockGatewayNodeMaps(content);
    for (const block of blocks) {
      const node = this.toParsedAppleWebGatewayNodeFromMap(block, JSON.stringify(block));
      if (node) nodes.push(node);
    }

    return nodes;
  }

  private parseInlineGatewayNodeMap(value: string) {
    return value.split(',').reduce<Record<string, string>>((result, item) => {
      const [rawKey, ...rawValueParts] = item.split(':');
      const key = rawKey?.trim();
      const rawValue = rawValueParts.join(':').trim();
      if (key && rawValue) result[key] = this.cleanGatewayNodeMapValue(rawValue);
      return result;
    }, {});
  }

  private parseBlockGatewayNodeMaps(content: string) {
    const blocks: Record<string, string>[] = [];
    let current: Record<string, string> | null = null;

    for (const line of content.split(/\r?\n/)) {
      const start = line.match(/^\s*-\s*name:\s*(.+)$/);
      if (start) {
        if (current) blocks.push(current);
        current = { name: this.cleanGatewayNodeMapValue(start[1] ?? '') };
        continue;
      }

      if (!current) continue;
      const entry = line.match(/^\s+([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (entry) {
        current[entry[1] ?? ''] = this.cleanGatewayNodeMapValue(entry[2] ?? '');
      } else if (/^\s*-\s+/.test(line)) {
        blocks.push(current);
        current = null;
      }
    }

    if (current) blocks.push(current);
    return blocks;
  }

  private cleanGatewayNodeMapValue(value: string) {
    return value.trim().replace(/^['"]|['"]$/g, '');
  }

  private toParsedAppleWebGatewayNodeFromMap(
    data: Record<string, string>,
    raw: string
  ): ParsedAppleWebGatewayNode | null {
    const protocol = this.normalizeAppleWebGatewayProtocol(data.type ?? data.protocol ?? '');
    if (!protocol) return null;
    const name = this.sanitizeGatewayNodeName(data.name ?? data.ps ?? data.remarks ?? '');
    if (!name) return null;
    const server = this.getNullableString(data.server) ?? this.getNullableString(data.add);
    const countryCode = this.inferAppleWebGatewayCountryCode(name, server);
    const sourceHash = this.hashText(raw);

    return {
      id: `awg_${sourceHash.slice(0, 16)}`,
      name,
      countryCode,
      protocol,
      raw,
      sourceHash
    };
  }

  private normalizeAppleWebGatewayProtocol(value: string | undefined) {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'hy2') return 'hysteria2';
    if (
      normalized === 'vmess' ||
      normalized === 'vless' ||
      normalized === 'trojan' ||
      normalized === 'ss' ||
      normalized === 'ssr' ||
      normalized === 'hysteria2'
    ) {
      return normalized;
    }
    return '';
  }

  private inferAppleWebGatewayCountryCode(name: string, server?: string | null) {
    const text = `${name} ${server ?? ''}`.toLowerCase();
    const countries = [
      {
        code: 'HK',
        keywords: ['香港', 'hong kong', 'hongkong'],
        tokens: ['hk', 'hkg']
      },
      {
        code: 'US',
        keywords: [
          '美国',
          '美國',
          'united states',
          'america',
          'los angeles',
          'new york',
          'dallas',
          'chicago',
          'san jose',
          'seattle',
          'ashburn',
          'silicon valley',
          '洛杉矶',
          '洛杉磯',
          '圣何塞'
        ],
        tokens: ['us', 'usa', 'la', 'ny']
      },
      {
        code: 'MY',
        keywords: ['马来西亚', '馬來西亞', '马来', '馬來', '大马', 'malaysia', 'kuala lumpur'],
        tokens: ['my', 'mys']
      },
      { code: 'SG', keywords: ['新加坡', 'singapore'], tokens: ['sg', 'sin'] },
      { code: 'JP', keywords: ['日本', 'japan', 'tokyo', 'osaka'], tokens: ['jp', 'jpn'] },
      { code: 'KR', keywords: ['韩国', '韓國', 'korea', 'seoul'], tokens: ['kr', 'kor'] },
      { code: 'TW', keywords: ['台湾', '台灣', 'taiwan', 'taipei'], tokens: ['tw', 'twn'] },
      {
        code: 'CN',
        keywords: ['中国大陆', '中國大陸', '中国', '中國', 'china'],
        tokens: ['cn', 'chn']
      },
      {
        code: 'GB',
        keywords: ['英国', '英國', 'united kingdom', 'london'],
        tokens: ['uk', 'gb', 'gbr']
      },
      { code: 'CA', keywords: ['加拿大', 'canada', 'toronto', 'vancouver'], tokens: ['ca', 'can'] },
      { code: 'AU', keywords: ['澳大利亚', '澳洲', 'australia', 'sydney'], tokens: ['au', 'aus'] },
      { code: 'DE', keywords: ['德国', '德國', 'germany', 'frankfurt'], tokens: ['de', 'deu'] },
      { code: 'FR', keywords: ['法国', '法國', 'france', 'paris'], tokens: ['fr', 'fra'] },
      { code: 'NL', keywords: ['荷兰', '荷蘭', 'netherlands', 'amsterdam'], tokens: ['nl', 'nld'] },
      { code: 'TH', keywords: ['泰国', '泰國', 'thailand', 'bangkok'], tokens: ['th', 'tha'] },
      { code: 'VN', keywords: ['越南', 'vietnam'], tokens: ['vn', 'vnm'] },
      {
        code: 'ID',
        keywords: ['印尼', '印度尼西亚', 'indonesia', 'jakarta'],
        tokens: ['id', 'idn']
      },
      {
        code: 'PH',
        keywords: ['菲律宾', '菲律賓', 'philippines', 'manila'],
        tokens: ['ph', 'phl']
      },
      { code: 'IN', keywords: ['印度', 'india', 'mumbai', 'delhi'], tokens: ['in', 'ind'] }
    ];

    for (const country of countries) {
      if (country.keywords.some((keyword) => text.includes(keyword))) return country.code;
      if (country.tokens.some((token) => this.hasGatewayCountryToken(text, token))) {
        return country.code;
      }
    }

    return 'UNKNOWN';
  }

  private hasGatewayCountryToken(text: string, token: string) {
    return new RegExp(`(^|[\\s_\\-\\[\\]().|#/])${token}($|[\\s_\\-\\[\\]().|#/])`, 'i').test(text);
  }

  private sanitizeGatewayNodeName(value: string) {
    return (value || '')
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 120);
  }

  private tryDecodeSubscriptionBase64(content: string) {
    const compact = content.trim().replace(/\s+/g, '');
    if (compact.length < 12 || !/^[a-zA-Z0-9+/=_-]+$/.test(compact)) return null;
    const decoded = this.decodeBase64Loose(compact);
    if (!decoded) return null;
    return decoded.includes('://') || decoded.includes('proxies:') ? decoded : null;
  }

  private decodeBase64Loose(value: string) {
    try {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  private safeJsonParse(value: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(value);
      return this.toObject(parsed);
    } catch {
      return null;
    }
  }

  private getAppleWebGatewayCountryCodes(nodes: AppleWebGatewayNodeValue[]) {
    return Array.from(new Set(nodes.map((node) => node.countryCode).filter(Boolean))).sort();
  }

  private getUrlHost(value: string) {
    return new URL(value).host;
  }

  private maskSecretUrl(value: string) {
    const url = new URL(value);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    for (const key of Array.from(url.searchParams.keys())) {
      url.searchParams.set(key, '***');
    }
    return url.toString();
  }

  private hashText(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async getPlatformAuthorizationResponse(
    definition: PlatformDefinition
  ): Promise<PlatformAuthorizationResponse> {
    const parameter = await this.getPlatformAuthorizationParameter(definition.platform);
    const value = this.normalizePlatformAuthorizationValue(parameter?.value);
    return this.toPlatformAuthorizationResponse(definition, value, parameter?.updatedAt ?? null);
  }

  private getPlatformAuthorizationParameter(platform: string) {
    return this.prisma.systemParameter.findUnique({
      where: { key: this.getPlatformAuthorizationParameterKey(platform) }
    });
  }

  private getPlatformAuthorizationParameterKey(platform: string) {
    return `${PLATFORM_AUTH_PARAMETER_PREFIX}${platform}`;
  }

  private normalizePlatformAuthorizationValue(value: unknown): PlatformAuthorizationValue {
    const data = this.toObject(value) ?? {};
    return {
      authMode: this.parseAuthMode(data.authMode),
      appKeyEncrypted: this.getNullableString(data.appKeyEncrypted),
      appKeyTail: this.getNullableString(data.appKeyTail),
      appSecretEncrypted: this.getNullableString(data.appSecretEncrypted),
      accessTokenEncrypted: this.getNullableString(data.accessTokenEncrypted),
      accessTokenTail: this.getNullableString(data.accessTokenTail),
      refreshTokenEncrypted: this.getNullableString(data.refreshTokenEncrypted),
      refreshTokenTail: this.getNullableString(data.refreshTokenTail),
      tokenExpiresAt: this.getNullableString(data.tokenExpiresAt),
      shopName: this.getNullableString(data.shopName),
      scopes: this.normalizeStringArray(data.scopes),
      authorizationUrl: this.getNullableString(data.authorizationUrl),
      tokenUrl: this.getNullableString(data.tokenUrl),
      redirectUri: this.getNullableString(data.redirectUri),
      clientIdParam: this.getNullableString(data.clientIdParam) ?? 'client_id',
      metadata: this.toObject(data.metadata) ?? {}
    };
  }

  private toPlatformAuthorizationResponse(
    definition: PlatformDefinition,
    value: PlatformAuthorizationValue,
    updatedAt: Date | null
  ): PlatformAuthorizationResponse {
    const hasAppKey = Boolean(value.appKeyEncrypted);
    const hasAppSecret = Boolean(value.appSecretEncrypted);
    const hasAccessToken = Boolean(value.accessTokenEncrypted);
    const hasRefreshToken = Boolean(value.refreshTokenEncrypted);
    return {
      platform: definition.platform,
      displayName: definition.displayName,
      configured: hasAppKey || hasAppSecret || hasAccessToken || hasRefreshToken,
      authMode: this.parseAuthMode(value.authMode),
      hasAppKey,
      appKeyTail: value.appKeyTail ?? null,
      hasAppSecret,
      hasAccessToken,
      accessTokenTail: value.accessTokenTail ?? null,
      hasRefreshToken,
      refreshTokenTail: value.refreshTokenTail ?? null,
      tokenExpiresAt: value.tokenExpiresAt ?? null,
      shopName: value.shopName ?? null,
      scopes: this.normalizeStringArray(value.scopes),
      authorizationUrl: value.authorizationUrl ?? null,
      tokenUrl: value.tokenUrl ?? null,
      redirectUri: value.redirectUri ?? null,
      clientIdParam: value.clientIdParam ?? 'client_id',
      updatedAt
    };
  }

  private resolveEncryptedField(
    existingValue: string | null | undefined,
    newValue: string | null | undefined,
    clearSecrets: boolean
  ) {
    if (clearSecrets) return null;
    if (newValue === undefined) return existingValue ?? null;
    return this.fieldEncryptionService.encrypt(newValue);
  }

  private resolveSecretTail(
    existingValue: string | null | undefined,
    newValue: string | null | undefined,
    clearSecrets: boolean
  ) {
    if (clearSecrets) return null;
    if (newValue === undefined) return existingValue ?? null;
    return this.getTail(newValue);
  }

  private parseAuthMode(value: unknown): 'oauth' | 'manual_token' | 'app_credentials' {
    if (value === undefined || value === null || value === '') return 'oauth';
    if (value === 'oauth' || value === 'manual_token' || value === 'app_credentials') return value;
    throw new BadRequestException('authMode is invalid');
  }

  private parseOptionalDate(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string') throw new BadRequestException(`${field} is invalid`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} is invalid`);
    return date;
  }

  private normalizeNullableUrl(value: string | null | undefined, field: string) {
    const normalized = this.normalizeNullableString(value);
    return normalized ? this.normalizeUrl(normalized, field) : null;
  }

  private normalizeUrl(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    try {
      return new URL(value.trim()).toString();
    } catch {
      throw new BadRequestException(`${field} must be a valid URL`);
    }
  }

  private normalizeOAuthParamName(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const normalized = value.trim();
    if (!/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
      throw new BadRequestException(`${field} format is invalid`);
    }
    return normalized;
  }

  private getDefaultOAuthRedirectUri(platform: string) {
    const publicUrl =
      process.env.APP_PUBLIC_URL || `http://localhost:${process.env.APP_PORT ?? 3000}`;
    return new URL(`/api/ops/platforms/${platform}/oauth/callback`, publicUrl).toString();
  }

  private getPlatformOAuthStateParameterKey(platform: string, stateHash: string) {
    return `${PLATFORM_OAUTH_STATE_PARAMETER_PREFIX}${platform}_${stateHash.slice(0, 64)}`;
  }

  private hashRequired(value: string, field: string) {
    const hash = this.fieldEncryptionService.hash(value);
    if (!hash) throw new BadRequestException(`${field} is required`);
    return hash;
  }

  private normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getNullableString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private getTail(value: string | null | undefined) {
    if (!value) return null;
    return value.slice(-4);
  }

  private async getPlatformTestResult(platform: string): Promise<{
    status: PlatformSyncLogStatus;
    healthStatus: OpsHealthStatus;
    message: string;
    errorMessage: string | null;
  }> {
    const definition = this.getPlatformDefinition(platform);
    if (definition.platform === 'file-storage') {
      const storage = await this.fileStorageStatus();
      return {
        status: storage.status === 'normal' ? 'success' : 'failed',
        healthStatus: storage.status,
        message: storage.message,
        errorMessage: storage.status === 'normal' ? null : storage.message
      };
    }
    if (definition.platform === 'automation-service') {
      const worker = await this.automationWorkers();
      return {
        status: worker.status === 'error' ? 'failed' : 'success',
        healthStatus: worker.status,
        message: worker.message,
        errorMessage: worker.status === 'error' ? worker.message : null
      };
    }
    if (definition.platform === 'telegram') {
      const enabledConfig = await this.prisma.telegramConfig.count({
        where: { enabled: true, deletedAt: null }
      });
      const ok = enabledConfig > 0;
      return {
        status: ok ? 'success' : 'failed',
        healthStatus: ok ? 'normal' : 'warning',
        message: ok ? 'Telegram config exists' : '未启用 Telegram 配置',
        errorMessage: ok ? null : '未启用 Telegram 配置'
      };
    }
    return {
      status: 'failed',
      healthStatus: 'warning',
      message: `${definition.displayName} 真实开放平台授权尚未接入`,
      errorMessage: `${definition.displayName} 真实开放平台授权尚未接入`
    };
  }

  private async buildPlatformStatus(
    definition: PlatformDefinition
  ): Promise<PlatformInterfaceStatus> {
    const statsWindowStart = this.getPlatformStatsWindowStart();
    const [
      latestLog,
      latestFailure,
      statsByAlias,
      componentStatus,
      baseAuthorizationStatus,
      platformAuthorization
    ] = await Promise.all([
      this.prisma.platformSyncLog.findFirst({
        where: { platform: { in: definition.logAliases } },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.platformSyncLog.findFirst({
        where: { platform: { in: definition.logAliases }, status: 'failed' },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.getPlatformStatsByAlias(definition.logAliases, statsWindowStart),
      this.getPlatformLiveComponentStatus(definition),
      this.getPlatformAuthorizationStatus(definition),
      definition.authorizationStatus === 'not_required'
        ? Promise.resolve(null)
        : this.getPlatformAuthorizationResponse(definition)
    ]);
    const stats = this.getPlatformStatsForDefinition(statsByAlias, definition);

    const tokenExpiresAtDate =
      this.extractTokenExpiresAt(latestLog?.metadata) ??
      this.parseOptionalDate(platformAuthorization?.tokenExpiresAt, 'tokenExpiresAt');
    const authorizationStatus = this.applyTokenAuthorizationStatus(
      baseAuthorizationStatus,
      tokenExpiresAtDate
    );
    const rawStatus = latestLog
      ? latestLog.status === 'success'
        ? 'normal'
        : 'error'
      : componentStatus.status;
    const status =
      authorizationStatus === 'expired'
        ? 'error'
        : authorizationStatus === 'expiring' && rawStatus === 'normal'
          ? 'warning'
          : rawStatus;
    const authorizationMessage = this.getAuthorizationMessage(definition, authorizationStatus);
    const message = authorizationMessage ?? latestLog?.errorMessage ?? componentStatus.message;

    return {
      platform: definition.platform,
      displayName: definition.displayName,
      status,
      authorizationStatus,
      tokenExpiresAt: tokenExpiresAtDate?.toISOString() ?? null,
      lastSyncAt: latestLog?.finishedAt ?? latestLog?.createdAt ?? null,
      lastFailureReason: latestFailure?.errorMessage ?? null,
      requestCount: stats.requestCount,
      failedRequestCount: stats.failedRequestCount,
      failureLogCount: stats.failureLogCount,
      lastFailureAt: stats.lastFailureAt,
      retryLogCount: stats.retryLogCount,
      lastRetryAt: stats.lastRetryAt,
      errorRate: stats.errorRate,
      canReauthorize: definition.authorizationStatus !== 'not_required',
      canTestConnection: true,
      latestLog: latestLog ? this.toPlatformSyncResponse(latestLog) : null,
      message
    };
  }

  private async buildPlatformStatuses(
    definitions: PlatformDefinition[]
  ): Promise<PlatformInterfaceStatus[]> {
    const aliases = definitions.flatMap((definition) => definition.logAliases);
    const statsWindowStart = this.getPlatformStatsWindowStart();
    const authorizationKeys = definitions
      .filter((definition) => definition.authorizationStatus !== 'not_required')
      .map((definition) => this.getPlatformAuthorizationParameterKey(definition.platform));

    const [
      latestLogs,
      latestFailures,
      statsByAlias,
      authorizationParameters,
      telegramEnabledCount,
      fileStorageStatus,
      automationWorkerStatus
    ] = await Promise.all([
      this.prisma.platformSyncLog.findMany({
        where: { platform: { in: aliases } },
        take: 50,
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.platformSyncLog.findMany({
        where: { platform: { in: aliases }, status: 'failed' },
        take: 50,
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.getPlatformStatsByAlias(aliases, statsWindowStart),
      authorizationKeys.length
        ? this.prisma.systemParameter.findMany({
            where: { key: { in: authorizationKeys } }
          })
        : Promise.resolve([]),
      this.prisma.telegramConfig.count({
        where: { enabled: true, deletedAt: null }
      }),
      this.fileStorageStatus(),
      this.automationWorkers()
    ]);

    const authorizationParameterByKey = new Map(
      authorizationParameters.map((parameter) => [parameter.key, parameter])
    );
    const componentStatusByPlatform = new Map<string, ComponentStatus>([
      [
        'telegram',
        {
          name: 'Telegram',
          status: telegramEnabledCount > 0 ? 'normal' : 'warning',
          latencyMs: null,
          message: telegramEnabledCount > 0 ? 'Telegram 配置已启用' : '未启用 Telegram 配置',
          checkedAt: new Date().toISOString()
        }
      ],
      ['file-storage', fileStorageStatus],
      ['automation-service', automationWorkerStatus]
    ]);

    return definitions.map((definition) =>
      this.buildPlatformStatusFromSnapshot({
        definition,
        latestLogs,
        latestFailures,
        statsByAlias,
        authorizationParameterByKey,
        telegramEnabledCount,
        componentStatusByPlatform
      })
    );
  }

  private buildPlatformStatusFromSnapshot(input: {
    definition: PlatformDefinition;
    latestLogs: PlatformSyncLog[];
    latestFailures: PlatformSyncLog[];
    statsByAlias: Map<string, PlatformLogStats>;
    authorizationParameterByKey: Map<string, { value: Prisma.JsonValue; updatedAt: Date }>;
    telegramEnabledCount: number;
    componentStatusByPlatform: Map<string, ComponentStatus>;
  }): PlatformInterfaceStatus {
    const {
      definition,
      latestLogs,
      latestFailures,
      statsByAlias,
      authorizationParameterByKey,
      telegramEnabledCount,
      componentStatusByPlatform
    } = input;
    const latestLog = latestLogs.find((log) => definition.logAliases.includes(log.platform));
    const latestFailure = latestFailures.find((log) =>
      definition.logAliases.includes(log.platform)
    );
    const stats = this.getPlatformStatsForDefinition(statsByAlias, definition);
    const authorizationParameter = authorizationParameterByKey.get(
      this.getPlatformAuthorizationParameterKey(definition.platform)
    );
    const platformAuthorization =
      definition.authorizationStatus === 'not_required'
        ? null
        : this.toPlatformAuthorizationResponse(
            definition,
            this.normalizePlatformAuthorizationValue(authorizationParameter?.value),
            authorizationParameter?.updatedAt ?? null
          );
    const baseAuthorizationStatus = this.getPlatformAuthorizationStatusFromSnapshot({
      definition,
      authorization: platformAuthorization,
      telegramEnabledCount
    });
    const componentStatus = componentStatusByPlatform.get(definition.platform) ?? {
      name: definition.displayName,
      status: 'unknown' as OpsHealthStatus,
      latencyMs: null,
      message: `${definition.displayName} 真实开放平台授权尚未接入`,
      checkedAt: new Date().toISOString()
    };
    const tokenExpiresAtDate =
      this.extractTokenExpiresAt(latestLog?.metadata) ??
      this.parseOptionalDate(platformAuthorization?.tokenExpiresAt, 'tokenExpiresAt');
    const authorizationStatus = this.applyTokenAuthorizationStatus(
      baseAuthorizationStatus,
      tokenExpiresAtDate
    );
    const rawStatus = latestLog
      ? latestLog.status === 'success'
        ? 'normal'
        : 'error'
      : componentStatus.status;
    const status =
      authorizationStatus === 'expired'
        ? 'error'
        : authorizationStatus === 'expiring' && rawStatus === 'normal'
          ? 'warning'
          : rawStatus;
    const authorizationMessage = this.getAuthorizationMessage(definition, authorizationStatus);
    const message = authorizationMessage ?? latestLog?.errorMessage ?? componentStatus.message;

    return {
      platform: definition.platform,
      displayName: definition.displayName,
      status,
      authorizationStatus,
      tokenExpiresAt: tokenExpiresAtDate?.toISOString() ?? null,
      lastSyncAt: latestLog?.finishedAt ?? latestLog?.createdAt ?? null,
      lastFailureReason: latestFailure?.errorMessage ?? null,
      requestCount: stats.requestCount,
      failedRequestCount: stats.failedRequestCount,
      failureLogCount: stats.failureLogCount,
      lastFailureAt: stats.lastFailureAt,
      retryLogCount: stats.retryLogCount,
      lastRetryAt: stats.lastRetryAt,
      errorRate: stats.errorRate,
      canReauthorize: definition.authorizationStatus !== 'not_required',
      canTestConnection: true,
      latestLog: latestLog ? this.toPlatformSyncResponse(latestLog) : null,
      message
    };
  }

  private getPlatformAuthorizationStatusFromSnapshot(input: {
    definition: PlatformDefinition;
    authorization: PlatformAuthorizationResponse | null;
    telegramEnabledCount: number;
  }): PlatformInterfaceStatus['authorizationStatus'] {
    const { definition, authorization, telegramEnabledCount } = input;

    if (definition.authorizationStatus === 'not_required') return 'not_required';
    if (definition.platform === 'telegram') {
      return telegramEnabledCount > 0 ? 'configured' : 'not_configured';
    }
    return authorization?.configured ? 'configured' : 'not_configured';
  }

  private async notifyPlatformAuthorizationIncidents(statuses: PlatformInterfaceStatus[]) {
    const invalidPlatforms = statuses.filter(
      (status) =>
        status.canReauthorize &&
        (status.authorizationStatus === 'not_configured' ||
          status.authorizationStatus === 'expired')
    );
    const expiringPlatforms = statuses.filter(
      (status) => status.canReauthorize && status.authorizationStatus === 'expiring'
    );

    await this.triggerPlatformAuthorizationNotification({
      eventCode: 'platform.auth.invalid',
      title: '平台授权已失效',
      content: this.formatPlatformAuthorizationContent(invalidPlatforms, '授权未配置或已失效'),
      platforms: invalidPlatforms
    });
    await this.triggerPlatformAuthorizationNotification({
      eventCode: 'platform.auth.expiring',
      title: '平台授权即将过期',
      content: this.formatPlatformAuthorizationContent(expiringPlatforms, '授权将在 7 天内过期'),
      platforms: expiringPlatforms
    });
  }

  private emitPlatformAuthorizationIncidents(statuses: PlatformInterfaceStatus[]) {
    void this.notifyPlatformAuthorizationIncidents(statuses).catch(() => undefined);
  }

  private async triggerPlatformAuthorizationNotification(input: {
    eventCode: string;
    title: string;
    content: string;
    platforms: PlatformInterfaceStatus[];
  }) {
    if (!input.platforms.length) return;
    if (await this.isNotificationRecentlyTriggered(input.eventCode)) return;

    try {
      await this.notificationsService.triggerEvent({
        eventCode: input.eventCode,
        module: 'platform',
        title: input.title,
        content: input.content,
        payload: {
          title: input.title,
          summary: input.content,
          platforms: input.platforms.map((platform) => ({
            platform: platform.platform,
            displayName: platform.displayName,
            authorizationStatus: platform.authorizationStatus,
            tokenExpiresAt: platform.tokenExpiresAt,
            message: platform.message
          }))
        }
      });
    } catch {
      // 平台状态页不能因为系统通知异常而加载失败。
    }
  }

  private async isNotificationRecentlyTriggered(eventCode: string) {
    const rule = await this.prisma.notificationRule.findUnique({
      where: { eventCode },
      select: { lastTriggeredAt: true }
    });
    if (!rule?.lastTriggeredAt) return false;
    return Date.now() - rule.lastTriggeredAt.getTime() < 60 * 60 * 1000;
  }

  private formatPlatformAuthorizationContent(platforms: PlatformInterfaceStatus[], reason: string) {
    if (!platforms.length) return '';
    return `${platforms.map((platform) => platform.displayName).join('、')} ${reason}`;
  }

  private applyTokenAuthorizationStatus(
    status: PlatformInterfaceStatus['authorizationStatus'],
    tokenExpiresAt: Date | null
  ): PlatformInterfaceStatus['authorizationStatus'] {
    if (status !== 'configured' || !tokenExpiresAt) return status;
    const diffMs = tokenExpiresAt.getTime() - Date.now();
    if (diffMs <= 0) return 'expired';
    return diffMs <= 7 * 24 * 60 * 60 * 1000 ? 'expiring' : status;
  }

  private getAuthorizationMessage(
    definition: PlatformDefinition,
    status: PlatformInterfaceStatus['authorizationStatus']
  ) {
    if (status === 'not_configured') return `${definition.displayName} 授权未配置`;
    if (status === 'expired') return `${definition.displayName} 授权已过期`;
    if (status === 'expiring') return `${definition.displayName} 授权即将过期`;
    return null;
  }

  private extractTokenExpiresAt(metadata: unknown) {
    const data = this.toObject(metadata);
    const value = data?.tokenExpiresAt ?? data?.token_expires_at;
    if (typeof value !== 'string' && !(value instanceof Date)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async getPlatformLiveComponentStatus(
    definition: PlatformDefinition
  ): Promise<ComponentStatus> {
    if (definition.platform === 'file-storage') return this.fileStorageStatus();
    if (definition.platform === 'automation-service') return this.automationWorkers();
    if (definition.platform === 'telegram') {
      const count = await this.prisma.telegramConfig.count({
        where: { enabled: true, deletedAt: null }
      });
      return {
        name: definition.displayName,
        status: count > 0 ? 'normal' : 'warning',
        latencyMs: null,
        message: count > 0 ? 'Telegram 配置已启用' : '未启用 Telegram 配置',
        checkedAt: new Date().toISOString()
      };
    }
    return {
      name: definition.displayName,
      status: 'unknown',
      latencyMs: null,
      message: `${definition.displayName} 接口状态等待真实连接数据`,
      checkedAt: new Date().toISOString()
    };
  }

  private async getPlatformAuthorizationStatus(
    definition: PlatformDefinition
  ): Promise<PlatformInterfaceStatus['authorizationStatus']> {
    if (definition.authorizationStatus === 'not_required') return 'not_required';
    if (definition.platform === 'telegram') {
      const count = await this.prisma.telegramConfig.count({
        where: { enabled: true, deletedAt: null }
      });
      return count > 0 ? 'configured' : 'not_configured';
    }
    const authorization = await this.getPlatformAuthorizationResponse(definition);
    return authorization.configured ? 'configured' : 'not_configured';
  }

  private getPlatformStatsWindowStart() {
    return new Date(Date.now() - PLATFORM_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  private async getPlatformStatsByAlias(aliases: string[], statsWindowStart: Date) {
    if (!aliases.length) return new Map<string, PlatformLogStats>();
    if (typeof this.prisma.$queryRaw !== 'function') {
      return this.getPlatformStatsByAliasWithPrisma(aliases, statsWindowStart);
    }

    try {
      const retryCondition = PrismaNamespace.sql`(
        lower(sync_type) LIKE '%retry%'
        OR lower(COALESCE(metadata->>'action', '')) = 'retry'
        OR COALESCE(metadata->>'retry', '') = 'true'
        OR (
          COALESCE(metadata->>'retryCount', '') ~ '^[0-9]+$'
          AND (metadata->>'retryCount')::int > 0
        )
        OR (
          COALESCE(metadata->>'retry_count', '') ~ '^[0-9]+$'
          AND (metadata->>'retry_count')::int > 0
        )
        OR (
          COALESCE(metadata->>'attempt', '') ~ '^[0-9]+$'
          AND (metadata->>'attempt')::int > 1
        )
        OR (
          COALESCE(metadata->>'attemptNo', '') ~ '^[0-9]+$'
          AND (metadata->>'attemptNo')::int > 1
        )
        OR (
          COALESCE(metadata->>'attempt_no', '') ~ '^[0-9]+$'
          AND (metadata->>'attempt_no')::int > 1
        )
      )`;
      const rows = await this.prisma.$queryRaw<PlatformLogStatsRow[]>`
        SELECT
          platform,
          COALESCE(SUM(GREATEST(request_count, 0)), 0) AS "requestCount",
          COALESCE(
            SUM(
              CASE
                WHEN request_count <= 0 THEN 0
                WHEN ROUND(request_count * LEAST(GREATEST(error_rate::numeric, 0), 1)) > 0
                  THEN ROUND(request_count * LEAST(GREATEST(error_rate::numeric, 0), 1))::int
                WHEN status::text = 'failed' THEN request_count
                ELSE 0
              END
            ),
            0
          ) AS "failedRequestCount",
          COUNT(*) FILTER (WHERE status::text = 'failed') AS "failureLogCount",
          MAX(CASE WHEN status::text = 'failed' THEN COALESCE(finished_at, created_at) END) AS "lastFailureAt",
          COUNT(*) FILTER (WHERE ${retryCondition}) AS "retryLogCount",
          MAX(CASE WHEN ${retryCondition} THEN COALESCE(finished_at, created_at) END) AS "lastRetryAt"
        FROM platform_sync_logs
        WHERE platform IN (${PrismaNamespace.join(aliases)})
          AND created_at >= ${statsWindowStart}
        GROUP BY platform
      `;
      if (!Array.isArray(rows) || rows.some((row) => typeof row.platform !== 'string')) {
        throw new Error('Unexpected platform stats row shape');
      }
      return new Map(rows.map((row) => [row.platform, this.toPlatformLogStatsFromRow(row)]));
    } catch {
      return this.getPlatformStatsByAliasWithPrisma(aliases, statsWindowStart);
    }
  }

  private async getPlatformStatsByAliasWithPrisma(aliases: string[], statsWindowStart: Date) {
    const logs = await this.prisma.platformSyncLog.findMany({
      where: {
        platform: { in: aliases },
        createdAt: { gte: statsWindowStart }
      },
      orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }]
    });
    return this.buildPlatformStatsByAliasFromLogs(logs);
  }

  private buildPlatformStatsByAliasFromLogs(logs: PlatformSyncLog[]) {
    const logsByAlias = new Map<string, PlatformSyncLog[]>();
    for (const log of logs) {
      const items = logsByAlias.get(log.platform) ?? [];
      items.push(log);
      logsByAlias.set(log.platform, items);
    }
    return new Map(
      Array.from(logsByAlias.entries()).map(([alias, items]) => [
        alias,
        this.calculatePlatformLogStats(items)
      ])
    );
  }

  private getPlatformStatsForDefinition(
    statsByAlias: Map<string, PlatformLogStats>,
    definition: PlatformDefinition
  ): PlatformLogStats {
    let requestCount = 0;
    let failedRequestCount = 0;
    let failureLogCount = 0;
    let lastFailureAt: Date | null = null;
    let retryLogCount = 0;
    let lastRetryAt: Date | null = null;

    for (const alias of definition.logAliases) {
      const stats = statsByAlias.get(alias);
      if (!stats) continue;
      requestCount += stats.requestCount;
      failedRequestCount += stats.failedRequestCount;
      failureLogCount += stats.failureLogCount;
      lastFailureAt = this.pickLatestDate(lastFailureAt, stats.lastFailureAt);
      retryLogCount += stats.retryLogCount;
      lastRetryAt = this.pickLatestDate(lastRetryAt, stats.lastRetryAt);
    }

    return {
      requestCount,
      failedRequestCount,
      failureLogCount,
      lastFailureAt,
      retryLogCount,
      lastRetryAt,
      errorRate: this.formatRatio(requestCount === 0 ? 0 : failedRequestCount / requestCount)
    };
  }

  private toPlatformLogStatsFromRow(row: PlatformLogStatsRow): PlatformLogStats {
    const requestCount = this.getCountNumber(row.requestCount);
    const failedRequestCount = this.getCountNumber(row.failedRequestCount);
    return {
      requestCount,
      failedRequestCount,
      failureLogCount: this.getCountNumber(row.failureLogCount),
      lastFailureAt: row.lastFailureAt,
      retryLogCount: this.getCountNumber(row.retryLogCount),
      lastRetryAt: row.lastRetryAt,
      errorRate: this.formatRatio(requestCount === 0 ? 0 : failedRequestCount / requestCount)
    };
  }

  private calculatePlatformLogStats(logs: PlatformSyncLog[]): PlatformLogStats {
    let requestCount = 0;
    let failedRequestCount = 0;
    let failureLogCount = 0;
    let lastFailureAt: Date | null = null;
    let retryLogCount = 0;
    let lastRetryAt: Date | null = null;

    for (const log of logs) {
      const currentRequestCount = Math.max(0, log.requestCount);
      const currentFailedRequestCount = this.getFailedRequestCount(log);
      const logTime = log.finishedAt ?? log.createdAt;
      const isFailure = log.status === 'failed';
      const isRetry = this.isRetryPlatformLog(log);

      requestCount += currentRequestCount;
      failedRequestCount += currentFailedRequestCount;
      if (isFailure) {
        failureLogCount += 1;
        lastFailureAt = this.pickLatestDate(lastFailureAt, logTime);
      }
      if (isRetry) {
        retryLogCount += 1;
        lastRetryAt = this.pickLatestDate(lastRetryAt, logTime);
      }
    }

    return {
      requestCount,
      failedRequestCount,
      failureLogCount,
      lastFailureAt,
      retryLogCount,
      lastRetryAt,
      errorRate: this.formatRatio(requestCount === 0 ? 0 : failedRequestCount / requestCount)
    };
  }

  private getFailedRequestCount(log: PlatformSyncLog) {
    const requestCount = Math.max(0, log.requestCount);
    if (requestCount === 0) return 0;
    const errorRate = this.clampRatio(this.getDecimalNumber(log.errorRate));
    const failedByRate = Math.round(requestCount * errorRate);
    if (failedByRate > 0) return failedByRate;
    return log.status === 'failed' ? requestCount : 0;
  }

  private isRetryPlatformLog(log: PlatformSyncLog) {
    const syncType = log.syncType.toLowerCase();
    const metadata = this.toObject(log.metadata);
    const action = typeof metadata?.action === 'string' ? metadata.action.toLowerCase() : '';
    const retryCount = Number(metadata?.retryCount ?? metadata?.retry_count ?? 0);
    const attempt = Number(metadata?.attempt ?? metadata?.attemptNo ?? metadata?.attempt_no ?? 1);

    return (
      syncType.includes('retry') ||
      action === 'retry' ||
      metadata?.retry === true ||
      retryCount > 0 ||
      attempt > 1
    );
  }

  private pickLatestDate(current: Date | null, candidate: Date | null) {
    if (!candidate) return current;
    if (!current) return candidate;
    return candidate.getTime() > current.getTime() ? candidate : current;
  }

  private getDecimalNumber(value: unknown) {
    const numberValue =
      value && typeof value === 'object' && 'toString' in value
        ? Number(value.toString())
        : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private clampRatio(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  private formatRatio(value: number) {
    return this.clampRatio(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  private getPlatformDefinition(platform: string) {
    const normalizedPlatform = this.normalizeCode(platform, 'platform');
    const definition = this.getPlatformDefinitions().find((item) =>
      item.logAliases.includes(normalizedPlatform)
    );
    if (!definition) throw new BadRequestException('platform is invalid');
    return definition;
  }

  private getPlatformDefinitions(): PlatformDefinition[] {
    return [
      {
        platform: 'telegram',
        displayName: 'Telegram',
        logAliases: ['telegram'],
        authorizationStatus: 'required'
      },
      {
        platform: 'file-storage',
        displayName: '文件存储',
        logAliases: ['file-storage', 'storage'],
        authorizationStatus: 'not_required'
      },
      {
        platform: 'automation-service',
        displayName: '自动化服务',
        logAliases: ['automation-service', 'automation'],
        authorizationStatus: 'not_required'
      }
    ];
  }

  private getQueueStatus(
    waitingCount: number,
    activeCount: number,
    failedCount: number,
    delayedCount: number
  ): OpsHealthStatus {
    if (failedCount > 0) return 'error';
    if (waitingCount >= 100 || delayedCount >= 20) return 'warning';
    if (activeCount >= 20) return 'warning';
    return 'normal';
  }

  private getDiskStatus(usagePercent: number): OpsHealthStatus {
    if (!Number.isFinite(usagePercent)) return 'unknown';
    if (usagePercent >= 90) return 'critical';
    if (usagePercent >= 80) return 'warning';
    return 'normal';
  }

  private parseHealthStatus(value: unknown, strict: true): OpsHealthStatus;
  private parseHealthStatus(value: unknown, strict?: false): OpsHealthStatus | undefined;
  private parseHealthStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (
      value === 'normal' ||
      value === 'warning' ||
      value === 'error' ||
      value === 'critical' ||
      value === 'unknown'
    ) {
      return value;
    }
    throw new BadRequestException('status is invalid');
  }

  private parseCronStatus(value: unknown, strict: true): CronJobLogStatus;
  private parseCronStatus(value: unknown, strict?: false): CronJobLogStatus | undefined;
  private parseCronStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (value === 'running' || value === 'success' || value === 'failed' || value === 'skipped') {
      return value;
    }
    throw new BadRequestException('cron status is invalid');
  }

  private parsePlatformSyncStatus(value: unknown, strict: true): PlatformSyncLogStatus;
  private parsePlatformSyncStatus(
    value: unknown,
    strict?: false
  ): PlatformSyncLogStatus | undefined;
  private parsePlatformSyncStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (value === 'success' || value === 'failed') return value;
    throw new BadRequestException('platform sync status is invalid');
  }

  private parseErrorLevel(value: unknown, strict: true): ErrorLogLevel;
  private parseErrorLevel(value: unknown, strict?: false): ErrorLogLevel | undefined;
  private parseErrorLevel(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('level is required');
      return undefined;
    }
    if (value === 'info' || value === 'warn' || value === 'error' || value === 'fatal') {
      return value;
    }
    throw new BadRequestException('level is invalid');
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

  private getMetricNumber(value: unknown) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private getCountNumber(value: bigint | number | string | null) {
    const numberValue = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
    if (!Number.isFinite(numberValue)) return 0;
    return Math.max(0, Math.trunc(numberValue));
  }

  private getCountNumberValue(value: unknown) {
    const numberValue = Number(value ?? 0);
    if (!Number.isFinite(numberValue)) return 0;
    return Math.max(0, Math.trunc(numberValue));
  }

  private getNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private toNullableJson(value: unknown) {
    if (value === undefined || value === null) return PrismaNamespace.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private toObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toQueueStatusResponse(log: QueueStatusLog): QueueStatusLogResponse {
    return log;
  }

  private toPlatformSyncResponse(log: PlatformSyncLog): PlatformSyncLogResponse {
    return {
      ...log,
      errorRate: log.errorRate.toString()
    };
  }

  private toHealthSnapshotResponse(snapshot: SystemHealthSnapshot): SystemHealthSnapshotResponse {
    return {
      ...snapshot,
      diskUsage: snapshot.diskUsage?.toString() ?? null
    };
  }

  private toErrorLogResponse(log: ErrorLog) {
    return log;
  }

  private toPage<T>(items: T[], total: number, pagination: { page: number; pageSize: number }) {
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }
}
