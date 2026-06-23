import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppleAccount,
  AutomationTask,
  AutomationTaskBatch,
  AutomationTaskLog,
  AutomationTaskLogLevel,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTaskType,
  Prisma
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AutomationTaskResultDto } from './dto/automation-task-result.dto';
import type { BatchBalanceCheckDto } from './dto/batch-balance-check.dto';
import type { BatchStatusCheckDto } from './dto/batch-status-check.dto';
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';
import type { WebCheckGatewayAttemptDto } from './dto/web-check-gateway-attempt.dto';

interface ListAutomationTasksQuery extends PaginationQuery {
  keyword?: string;
  taskType?: string;
  status?: string;
  priority?: string;
  appleAccountId?: string;
  manualRequired?: string;
  sortBy?: string;
  sortOrder?: string;
}

const AUTOMATION_TASK_SORT_FIELDS: Record<
  string,
  keyof Prisma.AutomationTaskOrderByWithRelationInput
> = {
  taskType: 'taskType',
  priority: 'priority',
  status: 'status',
  manualRequired: 'manualRequired',
  retryCount: 'retryCount',
  queueJobId: 'queueJobId',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY = 'apple_web_gateway_nodes';

interface AppleWebCheckRegionProfile {
  countryCode: string;
  locale: string;
  timezone: string;
  appleCountryUrl: string;
  appleAccountSignInUrl: string;
}

interface AppleWebCheckExecutionPlan extends AppleWebCheckRegionProfile {
  adapterVersion: string;
  accountRegion: string;
  exitCountry: string;
  gatewayProfileCode: string | null;
  gatewayNodeId: string | null;
  gatewayNodeName: string | null;
  gatewayNodeCandidates: AppleWebGatewayNodeCandidate[];
  gatewayConfigured: boolean;
  regionMatched: boolean;
  manualChallengeMode: 'operator_prompt';
}

export interface AppleWebGatewayNodeCandidate {
  id: string;
  name: string;
  countryCode: string;
  status: 'available' | 'unknown' | 'unavailable';
}

interface AppleWebGatewayStoredNode extends AppleWebGatewayNodeCandidate {
  protocol: string;
  rawEncrypted: string | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  failureReason: string | null;
}

export interface AppleWebGatewayCandidateResponse extends AppleWebGatewayNodeCandidate {
  protocol: string | null;
  hasEncryptedConfig: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  failureReason: string | null;
}

const APPLE_WEB_CHECK_REGION_PROFILES: Record<string, AppleWebCheckRegionProfile> = {
  US: {
    countryCode: 'US',
    locale: 'en-US',
    timezone: 'America/Los_Angeles',
    appleCountryUrl: 'https://www.apple.com/',
    appleAccountSignInUrl: 'https://account.apple.com/sign-in'
  },
  MY: {
    countryCode: 'MY',
    locale: 'en-MY',
    timezone: 'Asia/Kuala_Lumpur',
    appleCountryUrl: 'https://www.apple.com/my/',
    appleAccountSignInUrl: 'https://account.apple.com/sign-in'
  },
  CN: {
    countryCode: 'CN',
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    appleCountryUrl: 'https://www.apple.com.cn/',
    appleAccountSignInUrl: 'https://account.apple.com/sign-in'
  }
};

type AutomationTaskWithRelations = AutomationTask & {
  appleAccount?: Pick<
    AppleAccount,
    'id' | 'appleId' | 'region' | 'currency' | 'currentBalance' | 'status'
  > | null;
  customer?: {
    id: string;
    name: string;
    wechat?: string | null;
  } | null;
  service?: {
    id: string;
    name: string;
    category: string;
    currency: string;
  } | null;
  activation?: {
    id: string;
    expireTime?: Date | null;
    status: string;
    autoRenewStatus: string;
    renewalDecision: string;
  } | null;
  screenshotAttachment?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
  } | null;
  createdBy?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  logs?: AutomationTaskLogWithRelations[];
};

type AutomationTaskBatchWithRelations = AutomationTaskBatch & {
  createdBy?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
};

type AutomationTaskLogWithRelations = AutomationTaskLog & {
  screenshotAttachment?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
  } | null;
};

@Injectable()
export class AppleAutomationTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async list(query: ListAutomationTasksQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim().toLowerCase();
    const taskType = this.parseTaskType(query.taskType, false);
    const status = this.parseStatus(query.status, false);
    const priority = this.parsePriority(query.priority, false);
    const manualRequired = this.parseBoolean(query.manualRequired);
    const where: Prisma.AutomationTaskWhereInput = {
      taskType: taskType ?? undefined,
      status: status ?? undefined,
      priority: priority ?? undefined,
      manualRequired,
      appleAccountId:
        this.normalizeOptionalUuid(query.appleAccountId, 'appleAccountId') ?? undefined,
      OR: keyword
        ? [
            { errorCode: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } },
            { queueJobId: { contains: keyword, mode: 'insensitive' } },
            { appleAccount: { appleIdNormalized: { contains: keyword, mode: 'insensitive' } } },
            { customer: { name: { contains: keyword, mode: 'insensitive' } } },
            { service: { name: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationTask.findMany({
        where,
        include: this.getInclude(false),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.automationTask.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const task = await this.findTaskOrThrow(id, true);
    return this.toResponse(task);
  }

  async create(dto: CreateAutomationTaskDto, operator?: AuthenticatedUser) {
    const taskType = this.parseTaskType(dto.taskType, true);
    const requiresAppleAccount = taskType !== 'official_price_check';
    const appleAccountId = dto.appleAccountId
      ? this.normalizeRequiredUuid(dto.appleAccountId, 'appleAccountId')
      : null;

    if (requiresAppleAccount && !appleAccountId) {
      throw new BadRequestException('appleAccountId is required');
    }

    const priority = this.parsePriority(dto.priority ?? 'medium', true);
    const inputPayloadEncrypted = this.encryptPayload(dto.inputPayload);
    const queueJobId = this.createQueueJobId(taskType);

    const created = await this.prisma.$transaction(async (tx) => {
      if (appleAccountId) {
        const appleAccount = await tx.appleAccount.findFirst({
          where: { id: appleAccountId, deletedAt: null },
          select: { id: true }
        });

        if (!appleAccount) {
          throw new NotFoundException('Apple account not found');
        }
      }

      const task = await tx.automationTask.create({
        data: {
          taskType,
          appleAccountId,
          customerId: this.normalizeOptionalUuid(dto.customerId ?? undefined, 'customerId'),
          serviceId: this.normalizeOptionalUuid(dto.serviceId ?? undefined, 'serviceId'),
          activationId: this.normalizeOptionalUuid(dto.activationId ?? undefined, 'activationId'),
          priority,
          status: 'queued',
          inputPayloadEncrypted,
          queueJobId,
          createdByUserId: operator?.id
        },
        include: this.getInclude(false)
      });

      await this.createLog(tx, task.id, 'info', '自动化任务已创建并进入队列', {
        queueJobId,
        taskType
      });

      return task;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.create',
      objectType: 'automation_task',
      objectId: created.id,
      afterData: this.toAuditJson({
        id: created.id,
        taskType,
        appleAccountId,
        priority,
        queueJobId,
        hasInputPayload: Boolean(inputPayloadEncrypted)
      }),
      remark: `Created Apple automation task ${created.id}`
    });

    return this.toResponse(created);
  }

  async batchStatusCheck(dto: BatchStatusCheckDto, operator?: AuthenticatedUser) {
    const appleAccountIds = this.normalizeAccountIdList(dto.appleAccountIds);
    const priority = this.parsePriority(dto.priority ?? 'medium', true);
    const gatewayRegion = this.normalizeOptionalRegionCode(dto.gatewayRegion);
    const note = this.normalizeNullableString(dto.note);
    const accounts = await this.prisma.appleAccount.findMany({
      where: {
        id: { in: appleAccountIds },
        deletedAt: null
      },
      select: {
        id: true,
        region: true
      }
    });
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const missingIds = appleAccountIds.filter((id) => !accountsById.has(id));

    if (missingIds.length) {
      throw new NotFoundException(`Apple account not found: ${missingIds.join(', ')}`);
    }

    const gatewayNodeCandidatesByCountry = await this.getAppleWebGatewayNodeCandidatesByCountry();
    const created = await this.prisma.$transaction(async (tx) => {
      const tasks: AutomationTaskWithRelations[] = [];

      for (const appleAccountId of appleAccountIds) {
        const account = accountsById.get(appleAccountId)!;
        const executionPlan = this.buildWebCheckExecutionPlan(
          account.region,
          gatewayRegion,
          gatewayNodeCandidatesByCountry
        );
        const status: AutomationTaskStatus = executionPlan.gatewayConfigured
          ? 'queued'
          : 'waiting_manual_verify';
        const queueJobId = this.createQueueJobId('check_status');
        const inputPayloadEncrypted = this.encryptPayload({
          automationIntent: 'apple_web_status_check',
          operatorNote: note,
          executionPlan,
          expectedResultStatuses: [
            'normal',
            'need_verify',
            'locked',
            'password_error',
            'risk',
            'unknown'
          ],
          safety: {
            prefersStableExitCountry: true,
            requiresMatchingExitCountry: false,
            manualChallengeMode: executionPlan.manualChallengeMode,
            doNotBypassTwoFactor: true
          }
        });
        const errorMessage = executionPlan.gatewayConfigured
          ? null
          : `缺少 ${executionPlan.countryCode} 国家/地区出口 IP 配置，已转人工验证`;

        const task = await tx.automationTask.create({
          data: {
            taskType: 'check_status',
            appleAccountId,
            priority,
            status,
            inputPayloadEncrypted,
            resultPayload: this.toAuditJson({
              executionPlan,
              workerStatus: executionPlan.gatewayConfigured
                ? 'ready_for_real_worker'
                : 'blocked_by_gateway',
              officialSiteUpdateRisk: 'Apple 官网登录流程更新后，需要更新 Playwright Worker 适配器'
            }),
            errorCode: executionPlan.gatewayConfigured ? null : 'gateway_region_not_configured',
            errorMessage,
            manualRequired: !executionPlan.gatewayConfigured,
            queueJobId,
            createdByUserId: operator?.id
          },
          include: this.getInclude(false)
        });

        await this.createLog(
          tx,
          task.id,
          executionPlan.gatewayConfigured ? 'info' : 'warning',
          executionPlan.gatewayConfigured
            ? 'Apple 官网状态检查任务已按账号地区进入队列'
            : 'Apple 官网状态检查缺少同国家出口 IP，已转人工验证',
          {
            queueJobId,
            accountRegion: executionPlan.accountRegion,
            exitCountry: executionPlan.exitCountry,
            requiredExitCountry: executionPlan.countryCode,
            regionMatched: executionPlan.regionMatched,
            gatewayConfigured: executionPlan.gatewayConfigured,
            gatewayProfileCode: executionPlan.gatewayProfileCode,
            gatewayNodeId: executionPlan.gatewayNodeId,
            gatewayNodeCandidates: executionPlan.gatewayNodeCandidates.map((node) => node.id),
            locale: executionPlan.locale,
            timezone: executionPlan.timezone
          }
        );

        tasks.push(task);
      }

      return tasks;
    });

    const queuedCount = created.filter((task) => task.status === 'queued').length;
    const manualRequiredCount = created.filter((task) => task.manualRequired).length;
    const regions = Array.from(
      new Set(created.map((task) => task.appleAccount?.region).filter(Boolean))
    ).sort();

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.batch_status_check',
      objectType: 'automation_task',
      objectId: created[0]?.id,
      afterData: this.toAuditJson({
        createdCount: created.length,
        queuedCount,
        manualRequiredCount,
        regions,
        gatewayRegion: gatewayRegion ?? 'account_region_default',
        hasOperatorNote: Boolean(note)
      }),
      remark: `Created ${created.length} Apple web status check tasks`
    });

    return {
      createdCount: created.length,
      queuedCount,
      manualRequiredCount,
      items: created.map((task) => this.toResponse(task))
    };
  }

  async createStatusCheckBatch(dto: BatchStatusCheckDto, operator?: AuthenticatedUser) {
    const appleAccountIds = this.normalizeAccountIdList(dto.appleAccountIds);
    const note = this.normalizeNullableString(dto.note);
    const startedAt = new Date();
    const batch = await this.prisma.automationTaskBatch.create({
      data: {
        batchType: 'status_check',
        status: 'queued',
        totalCount: appleAccountIds.length,
        note,
        createdByUserId: operator?.id,
        startedAt
      },
      include: this.getBatchInclude()
    });

    try {
      const result = await this.batchStatusCheck({ ...dto, appleAccountIds, note }, operator);
      const taskIds = result.items.map((item) => item.id);

      if (taskIds.length) {
        await this.prisma.automationTask.updateMany({
          where: { id: { in: taskIds } },
          data: { batchId: batch.id }
        });
      }

      await this.refreshBatchStats(batch.id);
      return this.getBatchResults(batch.id);
    } catch (error) {
      await this.prisma.automationTaskBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          failedCount: appleAccountIds.length,
          finishedAt: new Date(),
          note: note ?? (error instanceof Error ? error.message : '批量状态查询失败')
        }
      });
      throw error;
    }
  }

  async createBalanceCheckBatch(dto: BatchBalanceCheckDto, operator?: AuthenticatedUser) {
    const appleAccountIds = this.normalizeAccountIdList(dto.appleAccountIds);
    const priority = this.parsePriority(dto.priority ?? 'medium', true);
    const note = this.normalizeNullableString(dto.note);
    const accounts = await this.prisma.appleAccount.findMany({
      where: {
        id: { in: appleAccountIds },
        deletedAt: null
      },
      select: {
        id: true,
        appleId: true,
        region: true,
        currency: true,
        currentBalance: true,
        status: true
      }
    });
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const missingIds = appleAccountIds.filter((id) => !accountsById.has(id));

    if (missingIds.length) {
      throw new NotFoundException(`Apple account not found: ${missingIds.join(', ')}`);
    }

    const now = new Date();
    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.automationTaskBatch.create({
        data: {
          batchType: 'balance_check',
          status: 'success',
          totalCount: appleAccountIds.length,
          successCount: appleAccountIds.length,
          note,
          createdByUserId: operator?.id,
          startedAt: now,
          finishedAt: now
        },
        include: this.getBatchInclude()
      });

      for (const appleAccountId of appleAccountIds) {
        const account = accountsById.get(appleAccountId)!;
        const queueJobId = this.createQueueJobId('check_balance');
        const payload = this.toAuditJson({
          balanceSnapshot: account.currentBalance.toString(),
          currency: account.currency,
          source: 'system_snapshot'
        });
        const task = await tx.automationTask.create({
          data: {
            batchId: createdBatch.id,
            taskType: 'check_balance',
            appleAccountId,
            priority,
            status: 'success',
            inputPayloadEncrypted: this.encryptPayload({
              automationIntent: 'apple_balance_snapshot',
              operatorNote: note
            }),
            resultPayload: payload,
            manualRequired: false,
            queueJobId,
            createdByUserId: operator?.id,
            startedAt: now,
            finishedAt: now
          },
          include: this.getInclude(false)
        });

        await this.createLog(tx, task.id, 'success', '批量余额查询已使用系统当前余额快照完成', {
          queueJobId,
          balanceSnapshot: account.currentBalance.toString(),
          currency: account.currency,
          source: 'system_snapshot'
        });
      }

      return createdBatch;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.batch_balance_check',
      objectType: 'automation_task_batch',
      objectId: batch.id,
      afterData: this.toAuditJson({
        batchId: batch.id,
        createdCount: appleAccountIds.length,
        source: 'system_snapshot',
        hasOperatorNote: Boolean(note)
      }),
      remark: `Created ${appleAccountIds.length} Apple balance check tasks`
    });

    return this.getBatchResults(batch.id);
  }

  async getBatch(id: string) {
    const batch = await this.findBatchOrThrow(id);
    return this.toBatchResponse(batch);
  }

  async getBatchResults(id: string) {
    const batch = await this.findBatchOrThrow(id);
    const tasks = await this.prisma.automationTask.findMany({
      where: { batchId: batch.id },
      include: this.getInclude(false),
      orderBy: [{ createdAt: 'asc' }]
    });

    return {
      batch: this.toBatchResponse(batch),
      items: tasks.map((task) => this.toBatchResultResponse(task))
    };
  }

  async workbenchStatus() {
    const [storedNodes, taskCounts] = await Promise.all([
      this.getAppleWebGatewayStoredNodes(),
      this.prisma.automationTask.groupBy({
        by: ['taskType', 'status'],
        _count: { _all: true },
        where: {
          taskType: { in: ['check_status', 'check_balance', 'official_price_check'] },
          status: { in: ['pending', 'queued', 'running', 'waiting_manual_verify', 'failed'] }
        }
      })
    ]);
    const configuredRegions = Array.from(this.getConfiguredWebCheckGatewayRegions()).sort();
    const availableGatewayCountries = Array.from(
      new Set(
        storedNodes
          .filter((node) => node.status !== 'unavailable')
          .map((node) => node.countryCode)
          .filter(Boolean)
      )
    ).sort();
    const gatewayCountries = Array.from(
      new Set([...configuredRegions, ...availableGatewayCountries])
    ).sort();
    const statusWorkerEnabled = process.env.APPLE_WEB_CHECK_WORKER_ENABLED === 'true';
    const gatewayConfigured = gatewayCountries.length > 0;
    const statusReady = statusWorkerEnabled && gatewayConfigured;
    const statusCounts = this.getTaskCountSnapshot(taskCounts, 'check_status');
    const balanceCounts = this.getTaskCountSnapshot(taskCounts, 'check_balance');
    const officialCounts = this.getTaskCountSnapshot(taskCounts, 'official_price_check');

    return {
      checkedAt: new Date().toISOString(),
      statusCheck: {
        mode: 'apple_web_worker',
        enabled: statusWorkerEnabled,
        ready: statusReady,
        gatewayConfigured,
        configuredRegions,
        availableGatewayCountries,
        workerIntervalMs: this.getNumberFromEnv('APPLE_WEB_CHECK_WORKER_INTERVAL_MS', 60000),
        workerMaxBatch: this.getNumberFromEnv('APPLE_WEB_CHECK_WORKER_MAX_BATCH', 3),
        queuedCount: statusCounts.queuedCount,
        runningCount: statusCounts.runningCount,
        manualRequiredCount: statusCounts.manualRequiredCount,
        failedCount: statusCounts.failedCount,
        message: statusReady
          ? '真实 Apple 官网状态查询 Worker 已就绪'
          : statusWorkerEnabled
            ? '真实 Worker 已开启，但还缺少 Apple 出口节点或网关国家配置'
            : '真实 Worker 未开启；状态查询会进入队列或人工处理'
      },
      balanceCheck: {
        mode: 'system_snapshot',
        enabled: true,
        ready: true,
        queuedCount: balanceCounts.queuedCount,
        runningCount: balanceCounts.runningCount,
        manualRequiredCount: balanceCounts.manualRequiredCount,
        failedCount: balanceCounts.failedCount,
        message: '余额查询当前返回系统记录的余额快照，不伪装成 Apple 官网实时余额'
      },
      officialPriceCheck: {
        mode: 'official_price_sources',
        enabled: true,
        ready: true,
        queuedCount: officialCounts.queuedCount,
        runningCount: officialCounts.runningCount,
        manualRequiredCount: officialCounts.manualRequiredCount,
        failedCount: officialCounts.failedCount,
        message: '官方价格巡检按已配置来源执行；有变动后需要人工确认同步'
      }
    };
  }

  async runPlaceholder(id: string, operator?: AuthenticatedUser) {
    const task = await this.findTaskOrThrow(id, false);

    if (!['pending', 'queued', 'failed', 'need_review'].includes(task.status)) {
      throw new ConflictException('Only pending, queued, failed, or need_review tasks can run');
    }

    const now = new Date();
    await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: 'running',
        startedAt: now,
        finishedAt: null,
        manualRequired: false,
        errorCode: null,
        errorMessage: null
      }
    });

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'info',
        message: '占位 Worker 开始执行任务',
        payload: this.toAuditJson({
          taskType: task.taskType,
          operatorId: operator?.id ?? null
        })
      }
    });

    if (!task.appleAccountId) {
      const message =
        task.taskType === 'official_price_check'
          ? '官方价格巡检请从 Apple ID 业务设置里的巡检入口执行，避免没有官方来源就乱改价格。'
          : '这个自动化任务缺少 Apple ID，已转人工确认。';
      const updated = await this.prisma.automationTask.update({
        where: { id: task.id },
        data: {
          status: 'waiting_manual_verify',
          manualRequired: true,
          errorCode: 'apple_account_not_bound',
          errorMessage: message,
          finishedAt: new Date()
        },
        include: this.getInclude(true)
      });

      await this.prisma.automationTaskLog.create({
        data: {
          taskId: task.id,
          level: 'warning',
          message,
          payload: this.toAuditJson({
            taskType: task.taskType,
            operatorId: operator?.id ?? null
          })
        }
      });

      await this.refreshBatchStats(task.batchId);
      return this.toResponse(updated);
    }

    const account = await this.prisma.appleAccount.findFirst({
      where: { id: task.appleAccountId, deletedAt: null },
      select: {
        id: true,
        currentBalance: true,
        currency: true,
        status: true
      }
    });

    if (!account) {
      throw new NotFoundException('Apple account not found');
    }

    const result = await this.buildPlaceholderResult(task.taskType, account, operator);
    const updated = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: result.status,
        resultPayload: result.payload,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        manualRequired: result.manualRequired,
        finishedAt: new Date()
      },
      include: this.getInclude(true)
    });

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: result.status === 'success' ? 'success' : 'warning',
        message: result.message,
        payload: result.payload
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.run_placeholder',
      objectType: 'automation_task',
      objectId: task.id,
      afterData: this.toAuditJson({
        id: task.id,
        taskType: task.taskType,
        status: updated.status,
        manualRequired: updated.manualRequired
      }),
      remark: `Ran placeholder automation task ${task.id}`
    });

    await this.refreshBatchStats(task.batchId);
    return this.toResponse(updated);
  }

  async cancel(id: string, operator?: AuthenticatedUser) {
    const task = await this.findTaskOrThrow(id, false);

    if (['success', 'cancelled'].includes(task.status)) {
      throw new ConflictException('Completed or cancelled automation task cannot be cancelled');
    }

    const updated = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: 'cancelled',
        finishedAt: new Date(),
        manualRequired: false
      },
      include: this.getInclude(true)
    });

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'warning',
        message: '自动化任务已取消',
        payload: this.toAuditJson({ operatorId: operator?.id ?? null })
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.cancel',
      objectType: 'automation_task',
      objectId: task.id,
      afterData: this.toAuditJson({ id: task.id, status: 'cancelled' }),
      remark: `Cancelled automation task ${task.id}`
    });

    await this.refreshBatchStats(task.batchId);
    return this.toResponse(updated);
  }

  async retry(id: string, operator?: AuthenticatedUser) {
    const task = await this.findTaskOrThrow(id, false);

    if (!['failed', 'need_review', 'waiting_manual_verify', 'cancelled'].includes(task.status)) {
      throw new ConflictException(
        'Only failed, need_review, waiting_manual_verify, or cancelled tasks can retry'
      );
    }

    const queueJobId = this.createQueueJobId(task.taskType);
    const updated = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
        queueJobId,
        manualRequired: false,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null
      },
      include: this.getInclude(true)
    });

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'info',
        message: '自动化任务已重新进入队列',
        payload: this.toAuditJson({
          queueJobId,
          operatorId: operator?.id ?? null
        })
      }
    });

    await this.refreshBatchStats(task.batchId);
    return this.toResponse(updated);
  }

  async markManual(id: string, dto: MarkAutomationTaskManualDto, operator?: AuthenticatedUser) {
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const task = await this.findTaskOrThrow(id, false);
    const updated = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: 'waiting_manual_verify',
        manualRequired: true,
        errorCode: 'manual_required',
        errorMessage: reason,
        finishedAt: new Date()
      },
      include: this.getInclude(true)
    });

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'warning',
        message: '自动化任务已转人工验证',
        payload: this.toAuditJson({ reason, operatorId: operator?.id ?? null })
      }
    });

    await this.refreshBatchStats(task.batchId);
    return this.toResponse(updated);
  }

  async writeResult(id: string, dto: AutomationTaskResultDto, operator?: AuthenticatedUser) {
    const task = await this.findTaskOrThrow(id, false);
    const status = this.parseWritableStatus(dto.status ?? 'success');
    const resultPayload = dto.resultPayload ? this.toAuditJson(dto.resultPayload) : null;
    const screenshotAttachmentId = this.normalizeOptionalUuid(
      dto.screenshotAttachmentId ?? undefined,
      'screenshotAttachmentId'
    );
    const errorCode = this.normalizeNullableString(dto.errorCode);
    const errorMessage = this.normalizeNullableString(dto.errorMessage);

    await this.prisma.$transaction(async (tx) => {
      await tx.automationTask.update({
        where: { id: task.id },
        data: {
          status,
          resultPayload: resultPayload ?? PrismaNamespace.JsonNull,
          screenshotAttachmentId,
          errorCode: status === 'success' ? null : errorCode,
          errorMessage: status === 'success' ? null : errorMessage,
          manualRequired: status !== 'success',
          finishedAt: new Date()
        }
      });

      await this.createLog(
        tx,
        task.id,
        status === 'success' ? 'success' : 'warning',
        '自动化任务结果已回写',
        {
          status,
          resultPayload,
          errorCode,
          errorMessage
        },
        screenshotAttachmentId
      );

      if (status === 'success' && task.taskType === 'check_status' && task.appleAccountId) {
        const resultStatus = this.getResultStatus(dto.resultPayload);
        if (resultStatus) {
          await tx.appleAccountStatusCheck.create({
            data: {
              appleAccountId: task.appleAccountId,
              checkType: 'automation',
              resultStatus,
              remark: '自动化任务结果回写',
              evidenceAttachmentId: screenshotAttachmentId ?? undefined,
              operatorId: operator?.id
            }
          });
          await tx.appleAccount.update({
            where: { id: task.appleAccountId },
            data: {
              status: resultStatus,
              updatedByUserId: operator?.id
            }
          });
        }
      }
    });

    const updated = await this.findTaskOrThrow(task.id, true);
    await this.refreshBatchStats(task.batchId);
    return this.toResponse(updated);
  }

  async webCheckGateways(id: string) {
    const task = await this.findTaskOrThrow(id, false);
    const executionPlan = this.getWebCheckExecutionPlanFromTask(task);
    const storedNodes = await this.getAppleWebGatewayStoredNodes();
    const candidates = this.resolveWebCheckGatewayCandidates(executionPlan, storedNodes);

    return {
      taskId: task.id,
      queueJobId: task.queueJobId,
      accountRegion: executionPlan.accountRegion,
      exitCountry: executionPlan.exitCountry,
      gatewayConfigured: executionPlan.gatewayConfigured,
      gatewayProfileCode: executionPlan.gatewayProfileCode,
      selectedNodeId: executionPlan.gatewayNodeId,
      fallbackGatewayProfileCode:
        executionPlan.gatewayNodeId || candidates.length ? null : executionPlan.gatewayProfileCode,
      canRunWithSyncedNode: candidates.some(
        (node) => node.hasEncryptedConfig && node.status !== 'unavailable'
      ),
      candidates
    };
  }

  async recordWebCheckGatewayAttempt(
    id: string,
    dto: WebCheckGatewayAttemptDto,
    operator?: AuthenticatedUser
  ) {
    const task = await this.findTaskOrThrow(id, false);
    const executionPlan = this.getWebCheckExecutionPlanFromTask(task);
    const nodeId = this.normalizeOptionalNodeId(dto.nodeId);
    const attemptStatus = this.parseGatewayAttemptStatus(dto.status);
    const detectedExitCountry = this.normalizeOptionalRegionCode(dto.exitCountry);
    const latencyMs = this.parseOptionalLatency(dto.latencyMs);
    const failureReason = this.normalizeNullableString(dto.failureReason);
    const expectedExitCountry = executionPlan.countryCode;
    const exitCountryMatched = !detectedExitCountry || detectedExitCountry === expectedExitCountry;
    const effectiveStatus =
      attemptStatus === 'success' && exitCountryMatched ? 'success' : 'failed';
    const effectiveFailureReason =
      attemptStatus === 'success' && !exitCountryMatched
        ? `出口国家不匹配：期望 ${expectedExitCountry}，实际 ${detectedExitCountry}`
        : failureReason;

    if (nodeId) {
      await this.updateAppleWebGatewayNodeAttempt(nodeId, {
        status: effectiveStatus,
        latencyMs,
        failureReason: effectiveFailureReason
      });
    }

    const storedNodes = await this.getAppleWebGatewayStoredNodes();
    const remainingCandidates = this.resolveWebCheckGatewayCandidates(executionPlan, storedNodes)
      .filter((node) => node.id !== nodeId && node.status !== 'unavailable')
      .map((node) => node.id);
    const shouldManual = effectiveStatus === 'failed' && !remainingCandidates.length;
    const checkedAt = new Date();
    const gatewayAttempt = {
      nodeId,
      status: effectiveStatus,
      expectedExitCountry,
      detectedExitCountry,
      exitCountryMatched,
      latencyMs,
      failureReason: effectiveFailureReason,
      exitIpProvided: Boolean(this.normalizeNullableString(dto.exitIp)),
      remainingCandidateIds: remainingCandidates,
      checkedAt: checkedAt.toISOString()
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.automationTask.update({
        where: { id: task.id },
        data: {
          status: shouldManual ? 'waiting_manual_verify' : 'running',
          startedAt: task.startedAt ?? checkedAt,
          finishedAt: shouldManual ? checkedAt : null,
          manualRequired: shouldManual,
          errorCode: shouldManual ? 'gateway_exit_check_failed' : null,
          errorMessage: shouldManual
            ? (effectiveFailureReason ?? `Apple 官网检查缺少可用的 ${expectedExitCountry} 出口节点`)
            : null,
          resultPayload: this.mergeTaskResultPayload(task.resultPayload, {
            gatewayAttempt,
            workerStatus: shouldManual ? 'blocked_by_gateway' : 'gateway_checked'
          })
        },
        include: this.getInclude(true)
      });

      await this.createLog(
        tx,
        task.id,
        effectiveStatus === 'success' ? 'success' : 'warning',
        effectiveStatus === 'success'
          ? 'Apple 官网 Worker 出口 IP 检测通过'
          : shouldManual
            ? 'Apple 官网 Worker 出口节点不可用，已转人工验证'
            : 'Apple 官网 Worker 出口节点失败，准备切换同国家候选节点',
        gatewayAttempt
      );

      return updatedTask;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.web_check_gateway_attempt',
      objectType: 'automation_task',
      objectId: task.id,
      afterData: this.toAuditJson(gatewayAttempt),
      remark: `Recorded Apple web gateway attempt for task ${task.id}`
    });

    await this.refreshBatchStats(task.batchId);
    return {
      task: this.toResponse(updated),
      gatewayAttempt,
      remainingCandidateIds: remainingCandidates
    };
  }

  async listLogs(id: string) {
    const taskId = this.normalizeRequiredUuid(id, 'id');
    await this.assertTaskExists(taskId);
    const logs = await this.prisma.automationTaskLog.findMany({
      where: { taskId },
      include: this.getLogInclude(),
      orderBy: { createdAt: 'desc' }
    });

    return {
      items: logs.map((log) => this.toLogResponse(log))
    };
  }

  private async findBatchOrThrow(id: string) {
    const batchId = this.normalizeRequiredUuid(id, 'id');
    const batch = await this.prisma.automationTaskBatch.findUnique({
      where: { id: batchId },
      include: this.getBatchInclude()
    });

    if (!batch) {
      throw new NotFoundException('Automation task batch not found');
    }

    return batch;
  }

  private async refreshBatchStats(batchId?: string | null) {
    if (!batchId) return;

    const tasks = await this.prisma.automationTask.findMany({
      where: { batchId },
      select: {
        status: true,
        manualRequired: true
      }
    });

    const totalCount = tasks.length;
    const queuedCount = tasks.filter((task) => ['pending', 'queued'].includes(task.status)).length;
    const runningCount = tasks.filter((task) => task.status === 'running').length;
    const successCount = tasks.filter((task) => task.status === 'success').length;
    const failedCount = tasks.filter((task) =>
      ['failed', 'need_review'].includes(task.status)
    ).length;
    const manualRequiredCount = tasks.filter(
      (task) => task.manualRequired || task.status === 'waiting_manual_verify'
    ).length;
    const status = this.getBatchStatus({
      totalCount,
      queuedCount,
      runningCount,
      successCount,
      failedCount,
      manualRequiredCount
    });

    await this.prisma.automationTaskBatch.update({
      where: { id: batchId },
      data: {
        status,
        totalCount,
        queuedCount,
        runningCount,
        successCount,
        failedCount,
        manualRequiredCount,
        finishedAt:
          totalCount > 0 && queuedCount === 0 && runningCount === 0 ? new Date() : undefined
      }
    });
  }

  private getBatchStatus(input: {
    totalCount: number;
    queuedCount: number;
    runningCount: number;
    successCount: number;
    failedCount: number;
    manualRequiredCount: number;
  }): AutomationTaskStatus {
    if (input.runningCount > 0) return 'running';
    if (input.queuedCount > 0) return 'queued';
    if (input.failedCount > 0) return 'failed';
    if (input.manualRequiredCount > 0) return 'waiting_manual_verify';
    if (input.totalCount > 0 && input.successCount >= input.totalCount) return 'success';
    return 'pending';
  }

  private getTaskCountSnapshot(
    items: Array<{
      taskType: AutomationTaskType;
      status: AutomationTaskStatus;
      _count: { _all: number };
    }>,
    taskType: AutomationTaskType
  ) {
    const filtered = items.filter((item) => item.taskType === taskType);
    const countByStatus = new Map(
      filtered.map((item) => [item.status, Number(item._count._all || 0)])
    );
    return {
      queuedCount: (countByStatus.get('pending') ?? 0) + (countByStatus.get('queued') ?? 0),
      runningCount: countByStatus.get('running') ?? 0,
      manualRequiredCount: countByStatus.get('waiting_manual_verify') ?? 0,
      failedCount: countByStatus.get('failed') ?? 0
    };
  }

  private async buildPlaceholderResult(
    taskType: AutomationTaskType,
    account: Pick<AppleAccount, 'id' | 'currentBalance' | 'currency' | 'status'>,
    operator?: AuthenticatedUser
  ) {
    if (taskType === 'check_balance') {
      return {
        status: 'success' as const,
        manualRequired: false,
        errorCode: null,
        errorMessage: null,
        message: '查询余额占位任务已使用系统当前余额快照完成',
        payload: this.toAuditJson({
          balanceSnapshot: account.currentBalance.toString(),
          currency: account.currency,
          source: 'system_snapshot'
        })
      };
    }

    if (taskType === 'check_status') {
      await this.prisma.appleAccountStatusCheck.create({
        data: {
          appleAccountId: account.id,
          checkType: 'automation',
          resultStatus: account.status,
          balanceSnapshot: account.currentBalance,
          remark: '自动化状态检测占位任务使用系统当前状态快照',
          operatorId: operator?.id
        }
      });

      return {
        status: 'success' as const,
        manualRequired: false,
        errorCode: null,
        errorMessage: null,
        message: '检测状态占位任务已使用系统当前状态快照完成',
        payload: this.toAuditJson({
          resultStatus: account.status,
          balanceSnapshot: account.currentBalance.toString(),
          source: 'system_snapshot'
        })
      };
    }

    return {
      status: 'waiting_manual_verify' as const,
      manualRequired: true,
      errorCode: 'worker_not_configured',
      errorMessage: '真实 Apple ID 自动化 Worker 尚未接入，需要人工验证',
      message: '该任务类型需要真实自动化 Worker，当前已转人工验证',
      payload: this.toAuditJson({
        source: 'placeholder_worker',
        taskType
      })
    };
  }

  private async findTaskOrThrow(id: string, includeLogs: boolean) {
    const taskId = this.normalizeRequiredUuid(id, 'id');
    const task = await this.prisma.automationTask.findUnique({
      where: { id: taskId },
      include: this.getInclude(includeLogs)
    });

    if (!task) {
      throw new NotFoundException('Automation task not found');
    }

    return task;
  }

  private async assertTaskExists(id: string) {
    const task = await this.prisma.automationTask.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!task) {
      throw new NotFoundException('Automation task not found');
    }
  }

  private async createLog(
    tx: Prisma.TransactionClient,
    taskId: string,
    level: AutomationTaskLogLevel,
    message: string,
    payload?: Record<string, unknown> | Prisma.InputJsonValue | null,
    screenshotAttachmentId?: string | null
  ) {
    return tx.automationTaskLog.create({
      data: {
        taskId,
        level,
        message,
        payload: payload ? this.toAuditJson(payload) : undefined,
        screenshotAttachmentId
      }
    });
  }

  private getInclude(includeLogs: boolean) {
    return {
      appleAccount: {
        select: {
          id: true,
          appleId: true,
          region: true,
          currency: true,
          currentBalance: true,
          status: true
        }
      },
      customer: {
        select: {
          id: true,
          name: true,
          wechat: true
        }
      },
      service: {
        select: {
          id: true,
          name: true,
          category: true,
          currency: true
        }
      },
      activation: {
        select: {
          id: true,
          expireTime: true,
          status: true,
          autoRenewStatus: true,
          renewalDecision: true
        }
      },
      screenshotAttachment: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true
        }
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      },
      logs: includeLogs
        ? {
            include: this.getLogInclude(),
            orderBy: {
              createdAt: 'desc'
            },
            take: 20
          }
        : false
    } satisfies Prisma.AutomationTaskInclude;
  }

  private getBatchInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.AutomationTaskBatchInclude;
  }

  private getLogInclude() {
    return {
      screenshotAttachment: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true
        }
      }
    } satisfies Prisma.AutomationTaskLogInclude;
  }

  private parseTaskType(value: unknown, strict: true): AutomationTaskType;
  private parseTaskType(value: unknown, strict: false): AutomationTaskType | undefined;
  private parseTaskType(value: unknown, strict: boolean): AutomationTaskType | undefined {
    if (value === undefined || value === null || value === '') {
      if (strict) {
        throw new BadRequestException('taskType is required');
      }
      return undefined;
    }

    if (
      value === 'check_status' ||
      value === 'check_balance' ||
      value === 'topup' ||
      value === 'cancel_subscription' ||
      value === 'change_phone' ||
      value === 'change_security' ||
      value === 'check_renewal' ||
      value === 'official_price_check'
    ) {
      return value;
    }

    throw new BadRequestException('taskType is invalid');
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'pending' ||
      value === 'queued' ||
      value === 'running' ||
      value === 'waiting_manual_verify' ||
      value === 'success' ||
      value === 'failed' ||
      value === 'skipped' ||
      value === 'cancelled' ||
      value === 'need_review'
    ) {
      return value satisfies AutomationTaskStatus;
    }

    if (strict) {
      throw new BadRequestException('status is invalid');
    }

    return undefined;
  }

  private parseWritableStatus(value: unknown) {
    if (value === 'success' || value === 'failed' || value === 'need_review') {
      return value;
    }

    throw new BadRequestException('status is invalid');
  }

  private parsePriority(value: unknown, strict: true): AutomationTaskPriority;
  private parsePriority(value: unknown, strict: false): AutomationTaskPriority | undefined;
  private parsePriority(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      if (strict) {
        throw new BadRequestException('priority is required');
      }
      return undefined;
    }

    if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') {
      return value;
    }

    throw new BadRequestException('priority is invalid');
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  }

  private buildOrderBy(
    query: ListAutomationTasksQuery
  ): Prisma.AutomationTaskOrderByWithRelationInput[] {
    const sortField = query.sortBy ? AUTOMATION_TASK_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ priority: 'desc' }, { createdAt: 'desc' }];
    }

    return sortField === 'createdAt'
      ? [{ createdAt: sortOrder }]
      : [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'asc' || value === 'desc') {
      return value;
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }

    return normalized;
  }

  private normalizeAccountIdList(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('appleAccountIds is required');
    }

    if (value.length > 50) {
      throw new BadRequestException('appleAccountIds cannot exceed 50 items');
    }

    const normalized = value.map((item, index) =>
      this.normalizeRequiredUuid(item, `appleAccountIds[${index}]`)
    );

    return Array.from(new Set(normalized));
  }

  private normalizeOptionalUuid(value: string | undefined, field: string) {
    if (!value) {
      return undefined;
    }

    return this.normalizeRequiredUuid(value, field);
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private encryptPayload(value: Record<string, unknown> | null | undefined) {
    if (!value || Object.keys(value).length === 0) {
      return null;
    }

    return this.fieldEncryptionService.encrypt(JSON.stringify(value));
  }

  private createQueueJobId(taskType: AutomationTaskType) {
    return `apple-${taskType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildWebCheckExecutionPlan(
    region: string,
    gatewayRegion?: string | null,
    gatewayNodeCandidatesByCountry: Map<string, AppleWebGatewayNodeCandidate[]> = new Map()
  ): AppleWebCheckExecutionPlan {
    const accountRegion = this.normalizeRegionCode(region);
    const exitCountry = this.normalizeRegionCode(gatewayRegion) || accountRegion;
    const profile = APPLE_WEB_CHECK_REGION_PROFILES[exitCountry] ?? {
      countryCode: exitCountry || 'UNKNOWN',
      locale: 'en-US',
      timezone: 'UTC',
      appleCountryUrl: 'https://www.apple.com/',
      appleAccountSignInUrl: 'https://account.apple.com/sign-in'
    };
    const configuredRegions = this.getConfiguredWebCheckGatewayRegions();
    const gatewayNodeCandidates = gatewayNodeCandidatesByCountry.get(profile.countryCode) ?? [];
    const selectedGatewayNode = gatewayNodeCandidates[0] ?? null;
    const gatewayConfigured =
      Boolean(selectedGatewayNode) || configuredRegions.has(profile.countryCode);

    return {
      ...profile,
      accountRegion,
      exitCountry,
      adapterVersion: process.env.APPLE_WEB_CHECK_ADAPTER_VERSION || 'apple-web-v1',
      gatewayProfileCode:
        selectedGatewayNode?.id ??
        (gatewayConfigured ? `apple-${profile.countryCode.toLowerCase()}-web` : null),
      gatewayNodeId: selectedGatewayNode?.id ?? null,
      gatewayNodeName: selectedGatewayNode?.name ?? null,
      gatewayNodeCandidates,
      gatewayConfigured,
      regionMatched: accountRegion === exitCountry,
      manualChallengeMode: 'operator_prompt'
    };
  }

  private getConfiguredWebCheckGatewayRegions() {
    return new Set(
      (process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS || '')
        .split(',')
        .map((item) => this.normalizeRegionCode(item))
        .filter(Boolean)
    );
  }

  private getNumberFromEnv(key: string, fallback: number) {
    const value = Number(process.env[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  private async getAppleWebGatewayNodeCandidatesByCountry() {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY }
    });
    const data = this.toObject(parameter?.value);
    const items = Array.isArray(data?.items) ? data.items : [];
    const result = new Map<string, AppleWebGatewayNodeCandidate[]>();

    for (const item of items) {
      const node = this.toObject(item);
      const id = this.getObjectString(node, 'id');
      const name = this.getObjectString(node, 'name');
      const countryCode = this.normalizeRegionCode(this.getObjectString(node, 'countryCode'));
      const status = this.getObjectString(node, 'status');

      if (!id || !name || !countryCode || countryCode === 'UNKNOWN') continue;
      if (status === 'unavailable') continue;

      const candidates = result.get(countryCode) ?? [];
      candidates.push({
        id,
        name,
        countryCode,
        status: status === 'available' ? 'available' : 'unknown'
      });
      result.set(countryCode, candidates);
    }

    for (const [countryCode, candidates] of result.entries()) {
      result.set(
        countryCode,
        candidates.sort((left, right) => {
          if (left.status !== right.status) return left.status === 'available' ? -1 : 1;
          return left.name.localeCompare(right.name);
        })
      );
    }

    return result;
  }

  private async getAppleWebGatewayStoredNodes(): Promise<AppleWebGatewayStoredNode[]> {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY }
    });
    const data = this.toObject(parameter?.value);
    const items = Array.isArray(data?.items) ? data.items : [];

    return items
      .map((item) => this.toAppleWebGatewayStoredNode(item))
      .filter((item): item is AppleWebGatewayStoredNode => Boolean(item));
  }

  private toAppleWebGatewayStoredNode(value: unknown): AppleWebGatewayStoredNode | null {
    const node = this.toObject(value);
    const id = this.getObjectString(node, 'id');
    const name = this.getObjectString(node, 'name');
    const countryCode = this.normalizeRegionCode(this.getObjectString(node, 'countryCode'));
    const protocol = this.getObjectString(node, 'protocol');

    if (!id || !name || !countryCode || !protocol) return null;

    return {
      id,
      name,
      countryCode,
      protocol,
      status: this.parseGatewayNodeStatus(this.getObjectString(node, 'status')),
      rawEncrypted: this.getObjectString(node, 'rawEncrypted'),
      latencyMs: this.getNumberOrNull(node?.latencyMs),
      lastCheckedAt: this.getObjectString(node, 'lastCheckedAt'),
      failureReason: this.getObjectString(node, 'failureReason')
    };
  }

  private resolveWebCheckGatewayCandidates(
    executionPlan: AppleWebCheckExecutionPlan,
    storedNodes: AppleWebGatewayStoredNode[]
  ): AppleWebGatewayCandidateResponse[] {
    const storedById = new Map(storedNodes.map((node) => [node.id, node]));
    const candidates =
      executionPlan.gatewayNodeCandidates.length > 0
        ? executionPlan.gatewayNodeCandidates
        : storedNodes
            .filter((node) => node.countryCode === executionPlan.countryCode)
            .map((node) => ({
              id: node.id,
              name: node.name,
              countryCode: node.countryCode,
              status: node.status
            }));

    const uniqueCandidates = new Map<string, AppleWebGatewayCandidateResponse>();
    for (const candidate of candidates) {
      const stored = storedById.get(candidate.id);
      uniqueCandidates.set(candidate.id, {
        id: candidate.id,
        name: stored?.name ?? candidate.name,
        countryCode: stored?.countryCode ?? candidate.countryCode,
        status: stored?.status ?? candidate.status,
        protocol: stored?.protocol ?? null,
        hasEncryptedConfig: Boolean(stored?.rawEncrypted),
        latencyMs: stored?.latencyMs ?? null,
        lastCheckedAt: stored?.lastCheckedAt ?? null,
        failureReason: stored?.failureReason ?? null
      });
    }

    return Array.from(uniqueCandidates.values()).sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'available') return -1;
        if (right.status === 'available') return 1;
        if (left.status === 'unknown') return -1;
        if (right.status === 'unknown') return 1;
      }
      return left.name.localeCompare(right.name);
    });
  }

  private getWebCheckExecutionPlanFromTask(
    task: Pick<AutomationTask, 'id' | 'taskType' | 'inputPayloadEncrypted' | 'resultPayload'>
  ): AppleWebCheckExecutionPlan {
    if (task.taskType !== 'check_status') {
      throw new BadRequestException('Only check_status tasks have Apple web gateway context');
    }

    const inputPayload = this.decryptTaskInputPayload(task.inputPayloadEncrypted);
    const inputPlan = this.toObject(inputPayload?.executionPlan);
    const resultPlan = this.toObject(this.toObject(task.resultPayload)?.executionPlan);
    const plan = inputPlan ?? resultPlan;

    if (!plan) {
      throw new BadRequestException('Apple web check execution plan is missing');
    }

    const countryCode = this.normalizeRegionCode(this.getObjectString(plan, 'countryCode'));
    const accountRegion = this.normalizeRegionCode(this.getObjectString(plan, 'accountRegion'));
    const exitCountry = this.normalizeRegionCode(this.getObjectString(plan, 'exitCountry'));
    const locale = this.getObjectString(plan, 'locale') ?? 'en-US';
    const timezone = this.getObjectString(plan, 'timezone') ?? 'UTC';
    const appleCountryUrl =
      this.getObjectString(plan, 'appleCountryUrl') ?? 'https://www.apple.com/';
    const appleAccountSignInUrl =
      this.getObjectString(plan, 'appleAccountSignInUrl') ?? 'https://account.apple.com/sign-in';

    if (!countryCode || !accountRegion || !exitCountry) {
      throw new BadRequestException('Apple web check execution plan is incomplete');
    }

    return {
      countryCode,
      accountRegion,
      exitCountry,
      locale,
      timezone,
      appleCountryUrl,
      appleAccountSignInUrl,
      adapterVersion: this.getObjectString(plan, 'adapterVersion') ?? 'apple-web-v1',
      gatewayProfileCode: this.getObjectString(plan, 'gatewayProfileCode'),
      gatewayNodeId: this.getObjectString(plan, 'gatewayNodeId'),
      gatewayNodeName: this.getObjectString(plan, 'gatewayNodeName'),
      gatewayNodeCandidates: this.parseGatewayNodeCandidates(plan.gatewayNodeCandidates),
      gatewayConfigured: plan.gatewayConfigured === true,
      regionMatched: plan.regionMatched === true,
      manualChallengeMode: 'operator_prompt'
    };
  }

  private parseGatewayNodeCandidates(value: unknown): AppleWebGatewayNodeCandidate[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const node = this.toObject(item);
        const id = this.getObjectString(node, 'id');
        const name = this.getObjectString(node, 'name');
        const countryCode = this.normalizeRegionCode(this.getObjectString(node, 'countryCode'));
        if (!id || !name || !countryCode) return null;
        return {
          id,
          name,
          countryCode,
          status: this.parseGatewayNodeStatus(this.getObjectString(node, 'status'))
        };
      })
      .filter((item): item is AppleWebGatewayNodeCandidate => Boolean(item));
  }

  private decryptTaskInputPayload(value: string | null) {
    if (!value) return null;
    const decrypted = this.fieldEncryptionService.decrypt(value);
    if (!decrypted) return null;
    try {
      return JSON.parse(decrypted) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Apple web check input payload is invalid');
    }
  }

  private async updateAppleWebGatewayNodeAttempt(
    nodeId: string,
    input: {
      status: 'success' | 'failed';
      latencyMs: number | null;
      failureReason: string | null;
    }
  ) {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY }
    });
    const data = this.toObject(parameter?.value) ?? {};
    const items = Array.isArray(data.items) ? data.items : [];
    let found = false;
    const checkedAt = new Date().toISOString();
    const nextItems = items.map((item) => {
      const node = this.toObject(item);
      if (this.getObjectString(node, 'id') !== nodeId) return item;
      found = true;
      return {
        ...node,
        status: input.status === 'success' ? 'available' : 'unavailable',
        latencyMs: input.latencyMs,
        lastCheckedAt: checkedAt,
        failureReason: input.status === 'success' ? null : input.failureReason
      };
    });

    if (!parameter || !found) {
      throw new BadRequestException('Apple web gateway node not found');
    }

    await this.prisma.systemParameter.update({
      where: { key: APPLE_WEB_GATEWAY_NODES_PARAMETER_KEY },
      data: {
        value: this.toAuditJson({
          ...data,
          items: nextItems
        })
      }
    });
  }

  private mergeTaskResultPayload(value: Prisma.JsonValue | null, patch: Record<string, unknown>) {
    return this.toAuditJson({
      ...(this.toObject(value) ?? {}),
      ...patch
    });
  }

  private parseGatewayAttemptStatus(value: unknown): 'success' | 'failed' {
    if (value === 'success' || value === 'failed') return value;
    throw new BadRequestException('status is invalid');
  }

  private parseGatewayNodeStatus(value: string | null): 'available' | 'unknown' | 'unavailable' {
    if (value === 'available' || value === 'unavailable' || value === 'unknown') return value;
    return 'unknown';
  }

  private parseOptionalLatency(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new BadRequestException('latencyMs is invalid');
    }
    return Math.round(numberValue);
  }

  private normalizeOptionalNodeId(value: string | null | undefined) {
    const normalized = this.normalizeNullableString(value);
    if (!normalized) return null;
    if (!/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
      throw new BadRequestException('nodeId format is invalid');
    }
    return normalized;
  }

  private getNumberOrNull(value: unknown) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private normalizeRegionCode(value: string | null | undefined) {
    return (value || '').trim().toUpperCase();
  }

  private normalizeOptionalRegionCode(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const normalized = this.normalizeRequiredString(value, 'gatewayRegion').toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException('gatewayRegion must be a country code');
    }

    return normalized;
  }

  private getResultStatus(payload: Record<string, unknown> | null | undefined) {
    const resultStatus = payload?.resultStatus;
    if (
      resultStatus === 'normal' ||
      resultStatus === 'need_verify' ||
      resultStatus === 'locked' ||
      resultStatus === 'password_error' ||
      resultStatus === 'risk' ||
      resultStatus === 'unknown'
    ) {
      return resultStatus;
    }

    return null;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private getObjectString(value: Record<string, unknown> | null, key: string) {
    const item = value?.[key];
    return typeof item === 'string' && item.trim() ? item.trim() : null;
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return this.maskPlainText(value);
    }

    return `${this.maskPlainText(name)}@${domain}`;
  }

  private maskPlainText(value: string) {
    if (value.length <= 2) {
      return '*'.repeat(value.length);
    }

    return `${value.slice(0, 2)}${'*'.repeat(Math.max(value.length - 2, 4))}`;
  }

  private toAttachmentResponse(
    attachment:
      | {
          id: string;
          originalName: string;
          mimeType: string;
          sizeBytes: bigint;
          createdAt: Date;
        }
      | null
      | undefined
  ) {
    return attachment
      ? {
          id: attachment.id,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes.toString(),
          createdAt: attachment.createdAt
        }
      : null;
  }

  private toLogResponse(log: AutomationTaskLogWithRelations) {
    return {
      id: log.id,
      taskId: log.taskId,
      level: log.level,
      message: log.message,
      payload: log.payload,
      screenshotAttachmentId: log.screenshotAttachmentId,
      screenshotAttachment: this.toAttachmentResponse(log.screenshotAttachment),
      createdAt: log.createdAt
    };
  }

  private toBatchResponse(batch: AutomationTaskBatchWithRelations) {
    return {
      id: batch.id,
      batchType: batch.batchType,
      status: batch.status,
      totalCount: batch.totalCount,
      queuedCount: batch.queuedCount,
      runningCount: batch.runningCount,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      manualRequiredCount: batch.manualRequiredCount,
      note: batch.note,
      createdBy: batch.createdBy,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    };
  }

  private toBatchResultResponse(task: AutomationTaskWithRelations) {
    const resultPayload = this.toObject(task.resultPayload);
    const resultStatus = this.getObjectString(resultPayload, 'resultStatus');
    const balanceSnapshot = this.getObjectString(resultPayload, 'balanceSnapshot');
    const resultSource = this.getObjectString(resultPayload, 'source') ?? 'task_result';
    const accountBalance = task.appleAccount?.currentBalance.toString() ?? null;
    const currency =
      this.getObjectString(resultPayload, 'currency') ?? task.appleAccount?.currency ?? null;

    return {
      taskId: task.id,
      batchId: task.batchId,
      taskType: task.taskType,
      appleAccountId: task.appleAccountId,
      appleAccount: task.appleAccount
        ? {
            id: task.appleAccount.id,
            appleIdMasked: this.maskAppleId(task.appleAccount.appleId),
            region: task.appleAccount.region,
            currency: task.appleAccount.currency,
            currentBalance: task.appleAccount.currentBalance.toString(),
            status: task.appleAccount.status
          }
        : null,
      status: task.status,
      manualRequired: task.manualRequired,
      resultStatus: resultStatus ?? task.appleAccount?.status ?? null,
      systemBalance: accountBalance,
      checkedBalance: balanceSnapshot,
      currency,
      resultSource,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      suggestedAction: this.getBatchResultSuggestedAction(task, {
        resultStatus,
        balanceSnapshot,
        resultSource
      }),
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      createdAt: task.createdAt
    };
  }

  private getBatchResultSuggestedAction(
    task: AutomationTaskWithRelations,
    result: {
      resultStatus: string | null;
      balanceSnapshot: string | null;
      resultSource: string;
    }
  ) {
    if (task.manualRequired || task.status === 'waiting_manual_verify') {
      return '需要人工确认';
    }
    if (task.status === 'failed' || task.status === 'need_review') {
      return '查看失败原因';
    }
    if (task.taskType === 'check_status') {
      return result.resultStatus && result.resultStatus !== 'normal' ? '处理账号异常' : '无需处理';
    }
    if (task.taskType === 'check_balance') {
      return result.resultSource === 'system_snapshot' ? '仅作系统余额快照参考' : '核对余额差异';
    }
    return '查看任务详情';
  }

  private toResponse(task: AutomationTaskWithRelations) {
    return {
      id: task.id,
      batchId: task.batchId,
      taskType: task.taskType,
      appleAccountId: task.appleAccountId,
      appleAccount: task.appleAccount
        ? {
            id: task.appleAccount.id,
            appleIdMasked: this.maskAppleId(task.appleAccount.appleId),
            region: task.appleAccount.region,
            currency: task.appleAccount.currency,
            currentBalance: task.appleAccount.currentBalance.toString(),
            status: task.appleAccount.status
          }
        : {
            id: '',
            appleIdMasked: '-',
            region: '-',
            currency: '-',
            currentBalance: '0',
            status: 'unknown'
          },
      customerId: task.customerId,
      customer: task.customer,
      serviceId: task.serviceId,
      service: task.service,
      activationId: task.activationId,
      activation: task.activation,
      priority: task.priority,
      status: task.status,
      hasInputPayload: Boolean(task.inputPayloadEncrypted),
      resultPayload: task.resultPayload,
      screenshotAttachmentId: task.screenshotAttachmentId,
      screenshotAttachment: this.toAttachmentResponse(task.screenshotAttachment),
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      createdBy: task.createdBy,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      retryCount: task.retryCount,
      manualRequired: task.manualRequired,
      queueJobId: task.queueJobId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      logs: task.logs?.map((log) => this.toLogResponse(log)) ?? undefined
    };
  }
}
