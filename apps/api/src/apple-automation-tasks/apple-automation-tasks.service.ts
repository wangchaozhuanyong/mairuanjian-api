import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppleAccount,
  AutomationTask,
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
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';

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

type AutomationTaskWithRelations = AutomationTask & {
  appleAccount: Pick<
    AppleAccount,
    'id' | 'appleId' | 'region' | 'currency' | 'currentBalance' | 'status'
  >;
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
    const appleAccountId = this.normalizeRequiredUuid(dto.appleAccountId, 'appleAccountId');
    const priority = this.parsePriority(dto.priority ?? 'medium', true);
    const inputPayloadEncrypted = this.encryptPayload(dto.inputPayload);
    const queueJobId = this.createQueueJobId(taskType);

    const created = await this.prisma.$transaction(async (tx) => {
      const appleAccount = await tx.appleAccount.findFirst({
        where: { id: appleAccountId, deletedAt: null },
        select: { id: true }
      });

      if (!appleAccount) {
        throw new NotFoundException('Apple account not found');
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

      if (status === 'success' && task.taskType === 'check_status') {
        const resultStatus = this.getResultStatus(dto.resultPayload);
        if (resultStatus) {
          await tx.appleAccountStatusCheck.create({
            data: {
              appleAccountId: task.appleAccountId,
              checkType: 'automation',
              resultStatus,
              remark: '自动化任务结果回写',
              evidenceAttachmentId: screenshotAttachmentId,
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
    return this.toResponse(updated);
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
  private parseTaskType(value: unknown, strict: boolean) {
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
      value === 'check_renewal'
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

  private toResponse(task: AutomationTaskWithRelations) {
    return {
      id: task.id,
      taskType: task.taskType,
      appleAccountId: task.appleAccountId,
      appleAccount: {
        id: task.appleAccount.id,
        appleIdMasked: this.maskAppleId(task.appleAccount.appleId),
        region: task.appleAccount.region,
        currency: task.appleAccount.currency,
        currentBalance: task.appleAccount.currentBalance.toString(),
        status: task.appleAccount.status
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
