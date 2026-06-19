import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AutomationTaskLogLevel,
  DataJobStatus,
  LoginLogStatus,
  PlatformSyncLog,
  PlatformSyncLogStatus,
  Prisma,
  SensitiveAccessLog
} from '@prisma/client';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAuditLogInput } from './audit-logs.types';

interface ListAuditLogsQuery extends PaginationQuery {
  module?: string;
  action?: string;
  userId?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListSensitiveAccessLogsQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  fieldName?: string;
  approved?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListLoginLogsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  abnormal?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListExportLogsQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  status?: string;
  containsSensitive?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListPermissionChangeLogsQuery extends PaginationQuery {
  keyword?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListAutomationTaskLogsQuery extends PaginationQuery {
  keyword?: string;
  level?: string;
  taskId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListPlatformInterfaceLogsQuery extends PaginationQuery {
  keyword?: string;
  platform?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

const AUDIT_LOG_SORT_FIELDS: Record<string, keyof Prisma.AuditLogOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  module: 'module',
  action: 'action',
  objectType: 'objectType'
};

const SENSITIVE_ACCESS_LOG_SORT_FIELDS: Record<
  string,
  keyof Prisma.SensitiveAccessLogOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  module: 'module',
  fieldName: 'fieldName',
  objectType: 'objectType',
  approved: 'approved'
};

const LOGIN_LOG_SORT_FIELDS: Record<string, keyof Prisma.LoginLogOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  username: 'username',
  status: 'status',
  abnormal: 'abnormal',
  ip: 'ip',
  failureReason: 'failureReason'
};

const DATA_EXPORT_JOB_SORT_FIELDS: Record<
  string,
  keyof Prisma.DataExportJobOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  module: 'module',
  status: 'status',
  containsSensitive: 'containsSensitive',
  filePath: 'filePath',
  errorMessage: 'errorMessage',
  finishedAt: 'finishedAt'
};

const AUTOMATION_TASK_LOG_SORT_FIELDS: Record<
  string,
  keyof Prisma.AutomationTaskLogOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  taskId: 'taskId',
  level: 'level',
  message: 'message'
};

const PLATFORM_SYNC_LOG_SORT_FIELDS: Record<
  string,
  keyof Prisma.PlatformSyncLogOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  finishedAt: 'finishedAt',
  platform: 'platform',
  syncType: 'syncType',
  status: 'status',
  requestCount: 'requestCount',
  errorRate: 'errorRate',
  errorMessage: 'errorMessage'
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        module: input.module,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        beforeData: input.beforeData,
        afterData: input.afterData,
        ip: input.ip,
        userAgent: input.userAgent,
        remark: input.remark
      }
    });
  }

  async list(query: ListAuditLogsQuery) {
    const pagination = getPagination(query);
    const where: Prisma.AuditLogWhereInput = {
      module: query.module || undefined,
      action: query.action || undefined,
      userId: query.userId || undefined,
      OR: query.keyword
        ? [
            {
              remark: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            },
            {
              objectType: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildAuditLogOrderBy(query),
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        }
      }),
      this.prisma.auditLog.count({
        where
      })
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  listOperationLogs(query: ListAuditLogsQuery) {
    return this.list(query);
  }

  private buildAuditLogOrderBy(
    query: ListAuditLogsQuery
  ): Prisma.AuditLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? AUDIT_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
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

  async listSensitiveAccessLogs(query: ListSensitiveAccessLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const approved = this.parseBoolean(query.approved);
    const where: Prisma.SensitiveAccessLogWhereInput = {
      module: query.module || undefined,
      fieldName: query.fieldName || undefined,
      approved,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { fieldName: { contains: keyword, mode: 'insensitive' } },
            { objectType: { contains: keyword, mode: 'insensitive' } },
            { accessReason: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sensitiveAccessLog.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildSensitiveAccessLogOrderBy(query)
      }),
      this.prisma.sensitiveAccessLog.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toSensitiveAccessLogResponse(item)),
      total,
      pagination
    );
  }

  private buildSensitiveAccessLogOrderBy(
    query: ListSensitiveAccessLogsQuery
  ): Prisma.SensitiveAccessLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? SENSITIVE_ACCESS_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async listLoginLogs(query: ListLoginLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseLoginStatus(query.status, false);
    const abnormal = this.parseBoolean(query.abnormal);
    const where: Prisma.LoginLogWhereInput = {
      status: status ?? undefined,
      abnormal,
      OR: keyword
        ? [
            { username: { contains: keyword, mode: 'insensitive' } },
            { ip: { contains: keyword, mode: 'insensitive' } },
            { failureReason: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.loginLog.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildLoginLogOrderBy(query)
      }),
      this.prisma.loginLog.count({ where })
    ]);

    return this.toPage(items, total, pagination);
  }

  private buildLoginLogOrderBy(
    query: ListLoginLogsQuery
  ): Prisma.LoginLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? LOGIN_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async listExportLogs(query: ListExportLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseDataJobStatus(query.status, false);
    const containsSensitive = this.parseBoolean(query.containsSensitive);
    const where: Prisma.DataExportJobWhereInput = {
      module: query.module || undefined,
      status: status ?? undefined,
      containsSensitive,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { filePath: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataExportJob.findMany({
        where,
        include: {
          createdBy: {
            select: this.getUserSelect()
          }
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildExportLogOrderBy(query)
      }),
      this.prisma.dataExportJob.count({ where })
    ]);

    return this.toPage(items, total, pagination);
  }

  private buildExportLogOrderBy(
    query: ListExportLogsQuery
  ): Prisma.DataExportJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? DATA_EXPORT_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async listPermissionChangeLogs(query: ListPermissionChangeLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AuditLogWhereInput = {
      userId: query.userId || undefined,
      AND: [
        {
          OR: [
            { action: { contains: 'permission', mode: 'insensitive' } },
            { action: { contains: 'role', mode: 'insensitive' } },
            { objectType: { contains: 'role', mode: 'insensitive' } }
          ]
        },
        keyword
          ? {
              OR: [
                { module: { contains: keyword, mode: 'insensitive' } },
                { action: { contains: keyword, mode: 'insensitive' } },
                { objectType: { contains: keyword, mode: 'insensitive' } },
                { remark: { contains: keyword, mode: 'insensitive' } }
              ]
            }
          : {}
      ]
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildPermissionChangeLogOrderBy(query)
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return this.toPage(items, total, pagination);
  }

  private buildPermissionChangeLogOrderBy(
    query: ListPermissionChangeLogsQuery
  ): Prisma.AuditLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? AUDIT_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async listAutomationTaskLogs(query: ListAutomationTaskLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const level = this.parseAutomationTaskLogLevel(query.level, false);
    const where: Prisma.AutomationTaskLogWhereInput = {
      taskId: query.taskId || undefined,
      level: level ?? undefined,
      OR: keyword
        ? [
            { message: { contains: keyword, mode: 'insensitive' } },
            { task: { errorCode: { contains: keyword, mode: 'insensitive' } } },
            { task: { errorMessage: { contains: keyword, mode: 'insensitive' } } },
            { task: { queueJobId: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationTaskLog.findMany({
        where,
        include: {
          task: {
            select: {
              id: true,
              taskType: true,
              status: true,
              priority: true,
              manualRequired: true,
              queueJobId: true,
              errorCode: true,
              errorMessage: true,
              createdAt: true
            }
          },
          screenshotAttachment: {
            select: {
              id: true,
              originalName: true,
              storageKey: true
            }
          }
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildAutomationTaskLogOrderBy(query)
      }),
      this.prisma.automationTaskLog.count({ where })
    ]);

    return this.toPage(items, total, pagination);
  }

  private buildAutomationTaskLogOrderBy(
    query: ListAutomationTaskLogsQuery
  ): Prisma.AutomationTaskLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? AUTOMATION_TASK_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async listPlatformInterfaceLogs(query: ListPlatformInterfaceLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parsePlatformSyncStatus(query.status, false);
    const where: Prisma.PlatformSyncLogWhereInput = {
      platform: query.platform || undefined,
      status: status ?? undefined,
      OR: keyword
        ? [
            { platform: { contains: keyword, mode: 'insensitive' } },
            { syncType: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformSyncLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildPlatformInterfaceLogOrderBy(query)
      }),
      this.prisma.platformSyncLog.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toPlatformSyncResponse(item)),
      total,
      pagination
    );
  }

  private buildPlatformInterfaceLogOrderBy(
    query: ListPlatformInterfaceLogsQuery
  ): Prisma.PlatformSyncLogOrderByWithRelationInput[] {
    const sortField = query.sortBy ? PLATFORM_SYNC_LOG_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ finishedAt: 'desc' }, { createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private getUserSelect() {
    return {
      id: true,
      username: true,
      displayName: true
    };
  }

  private getUserInclude() {
    return {
      user: {
        select: this.getUserSelect()
      }
    };
  }

  private toSensitiveAccessLogResponse(log: SensitiveAccessLog & { user?: unknown }) {
    return log;
  }

  private toPlatformSyncResponse(log: PlatformSyncLog) {
    return {
      ...log,
      errorRate: log.errorRate.toString()
    };
  }

  private toPage<T>(items: T[], total: number, pagination: { page: number; pageSize: number }) {
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  }

  private parseLoginStatus(value: unknown, strict: true): LoginLogStatus;
  private parseLoginStatus(value: unknown, strict?: false): LoginLogStatus | undefined;
  private parseLoginStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (value === 'success' || value === 'failed' || value === 'blocked') return value;
    throw new BadRequestException('login status is invalid');
  }

  private parseDataJobStatus(value: unknown, strict: true): DataJobStatus;
  private parseDataJobStatus(value: unknown, strict?: false): DataJobStatus | undefined;
  private parseDataJobStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (
      value === 'pending' ||
      value === 'running' ||
      value === 'success' ||
      value === 'failed' ||
      value === 'cancelled'
    ) {
      return value;
    }
    throw new BadRequestException('export status is invalid');
  }

  private parseAutomationTaskLogLevel(value: unknown, strict: true): AutomationTaskLogLevel;
  private parseAutomationTaskLogLevel(
    value: unknown,
    strict?: false
  ): AutomationTaskLogLevel | undefined;
  private parseAutomationTaskLogLevel(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('level is required');
      return undefined;
    }
    if (value === 'info' || value === 'warning' || value === 'error' || value === 'success') {
      return value;
    }
    throw new BadRequestException('automation log level is invalid');
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
    throw new BadRequestException('platform interface status is invalid');
  }
}
