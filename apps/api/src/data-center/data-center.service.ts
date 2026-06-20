import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  BackupJob,
  BackupJobType,
  DataCleanupJob,
  DataDictionary,
  DataDictionaryStatus,
  DataExportJob,
  DataImportJob,
  DataJobStatus,
  DuplicateMergeJob,
  Prisma,
  RecycleBinRecord,
  RestoreJob,
  SystemParameter
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ListJobQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  module?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListBackupJobsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  jobType?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListRestoreJobsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  backupJobId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListExportJobsQuery extends ListJobQuery {
  containsSensitive?: string;
}

interface ListRecycleBinQuery extends PaginationQuery {
  keyword?: string;
  module?: string;
  objectType?: string;
  restored?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListDictionariesQuery extends PaginationQuery {
  keyword?: string;
  group?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListSystemParametersQuery extends PaginationQuery {
  keyword?: string;
  group?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateBackupJobInput {
  jobType?: string;
  status?: string;
  storagePath?: string | null;
  fileSize?: number | string | null;
  remark?: string | null;
}

export interface UpdateBackupJobStatusInput {
  status?: string;
  storagePath?: string | null;
  fileSize?: number | string | null;
  errorMessage?: string | null;
}

export interface ExecuteRestoreJobInput {
  confirmText?: string | null;
}

export interface CreateRestoreJobInput {
  backupJobId?: string | null;
  restoreScope?: string;
  status?: string;
  approvalNote?: string | null;
}

export interface CreateImportJobInput {
  module?: string;
  filePath?: string | null;
  status?: string;
  totalCount?: number | string;
  successCount?: number | string;
  failedCount?: number | string;
  errorReport?: string | null;
  remark?: string | null;
}

export interface CreateExportJobInput {
  module?: string;
  exportScope?: unknown;
  fields?: unknown;
  containsSensitive?: boolean;
  status?: string;
  filePath?: string | null;
  downloadExpiresAt?: string | null;
}

export interface CreateCleanupJobInput {
  module?: string;
  cleanupScope?: unknown;
  status?: string;
  affectedCount?: number | string;
  approvalNote?: string | null;
}

export interface CreateDuplicateMergeJobInput {
  module?: string;
  matchRule?: unknown;
  primaryObjectId?: string | null;
  duplicateObjectIds?: unknown;
  status?: string;
  affectedCount?: number | string;
  approvalNote?: string | null;
}

export interface UpdateGenericJobStatusInput {
  status?: string;
  totalCount?: number | string;
  successCount?: number | string;
  failedCount?: number | string;
  affectedCount?: number | string;
  errorMessage?: string | null;
  errorReport?: string | null;
  filePath?: string | null;
  downloadExpiresAt?: string | null;
}

export interface CreateDataDictionaryInput {
  group?: string;
  code?: string;
  label?: string;
  value?: string | null;
  sortOrder?: number | string;
  status?: string;
  remark?: string | null;
}

export interface UpdateDataDictionaryInput {
  label?: string;
  value?: string | null;
  sortOrder?: number | string;
  status?: string;
  remark?: string | null;
}

export interface SaveSystemParameterInput {
  value?: unknown;
  group?: string;
  remark?: string | null;
}

export interface UserSnapshot {
  id: string;
  username: string;
  displayName: string;
}

export type BackupJobWithUser = BackupJob & { createdBy: UserSnapshot | null };
export type RestoreJobWithRelations = RestoreJob & {
  backupJob: Pick<BackupJob, 'id' | 'jobType' | 'status' | 'storagePath' | 'createdAt'> | null;
  createdBy: UserSnapshot | null;
};
export type ImportJobWithUser = DataImportJob & { createdBy: UserSnapshot | null };
export type ExportJobWithUser = DataExportJob & { createdBy: UserSnapshot | null };
export interface ExportDownloadFile {
  id: string;
  filePath: string;
  absolutePath: string;
  fileName: string;
  contentType: string;
  downloadExpiresAt: Date | null;
  containsSensitive: boolean;
}
export interface ImportErrorReportFile {
  id: string;
  filePath: string;
  absolutePath: string;
  fileName: string;
  contentType: string;
}
export type RecycleBinWithUsers = RecycleBinRecord & {
  deletedBy: UserSnapshot | null;
  restoredBy: UserSnapshot | null;
};
export type DictionaryWithUsers = DataDictionary & {
  createdBy: UserSnapshot | null;
  updatedBy: UserSnapshot | null;
};
export type ParameterWithUser = SystemParameter & { updatedBy: UserSnapshot | null };
export type CleanupJobWithUser = DataCleanupJob & { createdBy: UserSnapshot | null };
export type DuplicateMergeJobWithUser = DuplicateMergeJob & { createdBy: UserSnapshot | null };

const BACKUP_JOB_SORT_FIELDS: Record<string, keyof Prisma.BackupJobOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  jobType: 'jobType',
  status: 'status',
  storagePath: 'storagePath',
  fileSize: 'fileSize'
};
const RESTORE_JOB_SORT_FIELDS: Record<string, keyof Prisma.RestoreJobOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  restoreScope: 'restoreScope',
  status: 'status'
};
const IMPORT_JOB_SORT_FIELDS: Record<string, keyof Prisma.DataImportJobOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  finishedAt: 'finishedAt',
  module: 'module',
  status: 'status',
  totalCount: 'totalCount',
  successCount: 'successCount',
  failedCount: 'failedCount',
  filePath: 'filePath'
};
const EXPORT_JOB_SORT_FIELDS: Record<string, keyof Prisma.DataExportJobOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  finishedAt: 'finishedAt',
  downloadExpiresAt: 'downloadExpiresAt',
  module: 'module',
  status: 'status',
  containsSensitive: 'containsSensitive',
  filePath: 'filePath'
};
const RECYCLE_BIN_SORT_FIELDS: Record<
  string,
  keyof Prisma.RecycleBinRecordOrderByWithRelationInput
> = {
  deletedAt: 'deletedAt',
  restoredAt: 'restoredAt',
  module: 'module',
  objectType: 'objectType',
  objectLabel: 'objectLabel'
};
const CLEANUP_JOB_SORT_FIELDS: Record<string, keyof Prisma.DataCleanupJobOrderByWithRelationInput> =
  {
    createdAt: 'createdAt',
    finishedAt: 'finishedAt',
    module: 'module',
    status: 'status',
    affectedCount: 'affectedCount'
  };
const DUPLICATE_MERGE_JOB_SORT_FIELDS: Record<
  string,
  keyof Prisma.DuplicateMergeJobOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  finishedAt: 'finishedAt',
  module: 'module',
  status: 'status',
  affectedCount: 'affectedCount',
  primaryObjectId: 'primaryObjectId'
};
const DATA_DICTIONARY_SORT_FIELDS: Record<
  string,
  keyof Prisma.DataDictionaryOrderByWithRelationInput
> = {
  group: 'group',
  code: 'code',
  label: 'label',
  value: 'value',
  sortOrder: 'sortOrder',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const SYSTEM_PARAMETER_SORT_FIELDS: Record<
  string,
  keyof Prisma.SystemParameterOrderByWithRelationInput
> = {
  key: 'key',
  group: 'group',
  remark: 'remark',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

const DATA_EXPORT_MAX_ROWS = 5000;
const DATA_EXPORT_EXPIRES_HOURS = 24;
const DEFAULT_DATA_EXPORT_DIR = 'uploads/data-exports';
const DEFAULT_DATA_BACKUP_DIR = 'backups/postgres/local';
const DATA_IMPORT_MAX_ROWS = 5000;
const DEFAULT_DATA_IMPORT_DIR = 'uploads/data-imports';
const DEFAULT_DATA_IMPORT_ERROR_DIR = 'uploads/data-import-errors';
const RESTORE_DRILL_CONFIRM_PREFIX = 'CONFIRM_RESTORE_DRILL';
const DATA_CENTER_OVERVIEW_CACHE_TTL_MS = 120_000;

interface ExportDataSet {
  fields: string[];
  rows: Record<string, unknown>[];
}

interface CsvRecord {
  lineNumber: number;
  values: Record<string, string>;
}

interface ImportErrorRow {
  lineNumber: number;
  message: string;
  values: Record<string, string>;
}

interface ImportExecutionResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  errorReport: string | null;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface BackupExecutionResult extends CommandResult {
  storagePath: string;
  fileSize: number;
}

@Injectable()
export class DataCenterService {
  private readonly overviewCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async overview() {
    return this.overviewCache.getOrSet('overview', DATA_CENTER_OVERVIEW_CACHE_TTL_MS, async () => {
      const [
        failedBackupCount,
        runningImportCount,
        runningExportCount,
        recycleBinCount,
        dictionaryCount,
        recentBackupJobs,
        recentImportJobs,
        recentExportJobs
      ] = await Promise.all([
        this.prisma.backupJob.count({ where: { status: 'failed' } }),
        this.prisma.dataImportJob.count({ where: { status: { in: ['pending', 'running'] } } }),
        this.prisma.dataExportJob.count({ where: { status: { in: ['pending', 'running'] } } }),
        this.prisma.recycleBinRecord.count({ where: { restoredAt: null } }),
        this.prisma.dataDictionary.count({ where: { status: 'active' } }),
        this.prisma.backupJob.findMany({
          include: this.getUserInclude(),
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.dataImportJob.findMany({
          include: this.getUserInclude(),
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.dataExportJob.findMany({
          include: this.getUserInclude(),
          take: 5,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return {
        failedBackupCount,
        runningImportCount,
        runningExportCount,
        recycleBinCount,
        dictionaryCount,
        recentBackupJobs: recentBackupJobs.map((job) => this.toBackupJobResponse(job)),
        recentImportJobs: recentImportJobs.map((job) => this.toImportJobResponse(job)),
        recentExportJobs: recentExportJobs.map((job) => this.toExportJobResponse(job))
      };
    });
  }

  async listBackupJobs(query: ListBackupJobsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const jobType = this.parseJobType(query.jobType, false);
    const where: Prisma.BackupJobWhereInput = {
      status: status ?? undefined,
      jobType: jobType ?? undefined,
      OR: keyword
        ? [
            { storagePath: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.backupJob.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildBackupJobOrderBy(query)
      }),
      this.prisma.backupJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toBackupJobResponse(item)),
      total,
      pagination
    );
  }

  private buildBackupJobOrderBy(
    query: ListBackupJobsQuery
  ): Prisma.BackupJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? BACKUP_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createBackupJob(dto: CreateBackupJobInput, operator?: AuthenticatedUser) {
    const job = await this.prisma.backupJob.create({
      data: {
        jobType: this.parseJobType(dto.jobType ?? 'database', true),
        status: this.parseStatus(dto.status ?? 'pending', true),
        storagePath: this.normalizeNullableString(dto.storagePath),
        fileSize: this.parseNullableBigInt(dto.fileSize, 'fileSize'),
        remark: this.normalizeNullableString(dto.remark),
        createdById: operator?.id
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.backup.create',
      'backup_job',
      job.id,
      undefined,
      this.toBackupJobResponse(job)
    );
    return this.toBackupJobResponse(job);
  }

  async updateBackupJobStatus(
    id: string,
    dto: UpdateBackupJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findBackupJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status,
        storagePath:
          dto.storagePath === undefined ? undefined : this.normalizeNullableString(dto.storagePath),
        fileSize:
          dto.fileSize === undefined
            ? undefined
            : this.parseNullableBigInt(dto.fileSize, 'fileSize'),
        errorMessage:
          dto.errorMessage === undefined
            ? undefined
            : this.normalizeNullableString(dto.errorMessage),
        startedAt: status === 'running' && !job.startedAt ? new Date() : undefined,
        finishedAt: this.isTerminalStatus(status) ? new Date() : undefined
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.backup.status.update',
      'backup_job',
      job.id,
      this.toBackupJobResponse(job),
      this.toBackupJobResponse(updated)
    );
    await this.notifyBackupFailure(updated);
    return this.toBackupJobResponse(updated);
  }

  async executeBackupJob(id: string, operator?: AuthenticatedUser) {
    const job = await this.findBackupJobOrThrow(id);
    if (job.status === 'running') {
      throw new ConflictException('Backup job is already running');
    }
    if (job.status === 'cancelled') {
      throw new ConflictException('Cancelled backup job cannot be executed');
    }
    if (job.jobType !== 'database') {
      throw new BadRequestException('Only database backup execution is supported');
    }

    const running = await this.prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.backup.execute.start',
      'backup_job',
      job.id,
      this.toBackupJobResponse(job),
      this.toBackupJobResponse(running)
    );

    try {
      const result = await this.executeDatabaseBackupScript();
      const completed = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'success',
          storagePath: result.storagePath,
          fileSize: BigInt(result.fileSize),
          finishedAt: new Date(),
          errorMessage: null
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        'data.backup.execute.success',
        'backup_job',
        job.id,
        this.toBackupJobResponse(running),
        this.toBackupJobResponse(completed)
      );
      return this.toBackupJobResponse(completed);
    } catch (error) {
      const failed = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: this.getErrorMessage(error)
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        'data.backup.execute.failed',
        'backup_job',
        job.id,
        this.toBackupJobResponse(running),
        this.toBackupJobResponse(failed)
      );
      await this.notifyBackupFailure(failed);
      return this.toBackupJobResponse(failed);
    }
  }

  async listRestoreJobs(query: ListRestoreJobsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const backupJobId = this.normalizeNullableUuid(query.backupJobId, 'backupJobId');
    const where: Prisma.RestoreJobWhereInput = {
      status: status ?? undefined,
      backupJobId: backupJobId ?? undefined,
      OR: keyword
        ? [
            { restoreScope: { contains: keyword, mode: 'insensitive' } },
            { approvalNote: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.restoreJob.findMany({
        where,
        include: this.getRestoreInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildRestoreJobOrderBy(query)
      }),
      this.prisma.restoreJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toRestoreJobResponse(item)),
      total,
      pagination
    );
  }

  private buildRestoreJobOrderBy(
    query: ListRestoreJobsQuery
  ): Prisma.RestoreJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? RESTORE_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createRestoreJob(dto: CreateRestoreJobInput, operator?: AuthenticatedUser) {
    const backupJobId = this.normalizeNullableUuid(dto.backupJobId, 'backupJobId');
    if (backupJobId) await this.findBackupJobOrThrow(backupJobId);

    const job = await this.prisma.restoreJob.create({
      data: {
        backupJobId: backupJobId ?? undefined,
        restoreScope: this.normalizeRequiredString(dto.restoreScope, 'restoreScope'),
        status: this.parseStatus(dto.status ?? 'pending', true),
        approvalNote: this.normalizeNullableString(dto.approvalNote),
        createdById: operator?.id
      },
      include: this.getRestoreInclude()
    });

    await this.writeAudit(operator, 'data.restore.create', 'restore_job', job.id, undefined, job);
    return this.toRestoreJobResponse(job);
  }

  async updateRestoreJobStatus(
    id: string,
    dto: UpdateGenericJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findRestoreJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.restoreJob.update({
      where: { id: job.id },
      data: this.buildGenericStatusUpdate(status, dto),
      include: this.getRestoreInclude()
    });

    await this.writeAudit(
      operator,
      'data.restore.status.update',
      'restore_job',
      job.id,
      this.toRestoreJobResponse(job),
      this.toRestoreJobResponse(updated)
    );
    return this.toRestoreJobResponse(updated);
  }

  async executeRestoreJob(id: string, dto: ExecuteRestoreJobInput, operator?: AuthenticatedUser) {
    const job = await this.findRestoreJobOrThrow(id);
    if (job.status === 'running') {
      throw new ConflictException('Restore job is already running');
    }
    if (job.status === 'cancelled') {
      throw new ConflictException('Cancelled restore job cannot be executed');
    }
    if (!job.backupJobId || !job.backupJob?.storagePath) {
      throw new BadRequestException('Restore job requires a successful backup job');
    }

    const expectedConfirmText = this.getRestoreConfirmText(job.id);
    if (dto.confirmText !== expectedConfirmText) {
      throw new BadRequestException(`confirmText must be ${expectedConfirmText}`);
    }

    const backupFilePath = this.resolveBackupFilePath(job.backupJob.storagePath);
    await access(backupFilePath);

    const running = await this.prisma.restoreJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null
      },
      include: this.getRestoreInclude()
    });

    await this.writeAudit(
      operator,
      'data.restore.execute.start',
      'restore_job',
      job.id,
      this.toRestoreJobResponse(job),
      this.toRestoreJobResponse(running)
    );

    try {
      const result = await this.executeRestoreDrillScript(backupFilePath);
      const completed = await this.prisma.restoreJob.update({
        where: { id: job.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          errorMessage: null
        },
        include: this.getRestoreInclude()
      });

      await this.writeAudit(
        operator,
        'data.restore.execute.success',
        'restore_job',
        job.id,
        this.toRestoreJobResponse(running),
        {
          ...this.toRestoreJobResponse(completed),
          output: this.truncateText(result.stdout || result.stderr)
        }
      );
      return this.toRestoreJobResponse(completed);
    } catch (error) {
      const failed = await this.prisma.restoreJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: this.getErrorMessage(error)
        },
        include: this.getRestoreInclude()
      });

      await this.writeAudit(
        operator,
        'data.restore.execute.failed',
        'restore_job',
        job.id,
        this.toRestoreJobResponse(running),
        this.toRestoreJobResponse(failed)
      );
      return this.toRestoreJobResponse(failed);
    }
  }

  async listImportJobs(query: ListJobQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const where: Prisma.DataImportJobWhereInput = {
      status: status ?? undefined,
      module: query.module || undefined,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { filePath: { contains: keyword, mode: 'insensitive' } },
            { errorReport: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataImportJob.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildImportJobOrderBy(query)
      }),
      this.prisma.dataImportJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toImportJobResponse(item)),
      total,
      pagination
    );
  }

  private buildImportJobOrderBy(
    query: ListJobQuery
  ): Prisma.DataImportJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? IMPORT_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createImportJob(dto: CreateImportJobInput, operator?: AuthenticatedUser) {
    const job = await this.prisma.dataImportJob.create({
      data: {
        module: this.normalizeRequiredString(dto.module, 'module'),
        filePath: this.normalizeNullableString(dto.filePath),
        status: this.parseStatus(dto.status ?? 'pending', true),
        totalCount: this.parseNonNegativeInteger(dto.totalCount ?? 0, 'totalCount'),
        successCount: this.parseNonNegativeInteger(dto.successCount ?? 0, 'successCount'),
        failedCount: this.parseNonNegativeInteger(dto.failedCount ?? 0, 'failedCount'),
        errorReport: this.normalizeNullableString(dto.errorReport),
        remark: this.normalizeNullableString(dto.remark),
        createdById: operator?.id
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.import.create',
      'data_import_job',
      job.id,
      undefined,
      job
    );
    return this.toImportJobResponse(job);
  }

  async updateImportJobStatus(
    id: string,
    dto: UpdateGenericJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findImportJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        ...this.buildGenericStatusUpdate(status, dto),
        totalCount:
          dto.totalCount === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.totalCount, 'totalCount'),
        successCount:
          dto.successCount === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.successCount, 'successCount'),
        failedCount:
          dto.failedCount === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.failedCount, 'failedCount'),
        errorReport:
          dto.errorReport === undefined ? undefined : this.normalizeNullableString(dto.errorReport)
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.import.status.update',
      'data_import_job',
      job.id,
      this.toImportJobResponse(job),
      this.toImportJobResponse(updated)
    );
    return this.toImportJobResponse(updated);
  }

  async executeImportJob(id: string, operator?: AuthenticatedUser) {
    const job = await this.findImportJobOrThrow(id);
    if (job.status === 'running') {
      throw new ConflictException('Import job is already running');
    }
    if (job.status === 'cancelled') {
      throw new ConflictException('Cancelled import job cannot be executed');
    }

    const running = await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
        errorReport: null
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.import.execute.start',
      'data_import_job',
      job.id,
      this.toImportJobResponse(job),
      this.toImportJobResponse(running)
    );

    try {
      const result = await this.executeCsvImport(running, operator);
      const completed = await this.prisma.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: result.successCount > 0 ? 'success' : 'failed',
          totalCount: result.totalCount,
          successCount: result.successCount,
          failedCount: result.failedCount,
          errorReport: result.errorReport,
          finishedAt: new Date()
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        completed.status === 'success'
          ? 'data.import.execute.success'
          : 'data.import.execute.failed',
        'data_import_job',
        job.id,
        this.toImportJobResponse(running),
        this.toImportJobResponse(completed)
      );
      return this.toImportJobResponse(completed);
    } catch (error) {
      const failed = await this.prisma.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          failedCount: 1,
          errorReport: await this.writeImportErrorReport(job.id, [
            {
              lineNumber: 0,
              message: this.getErrorMessage(error),
              values: {}
            }
          ]),
          finishedAt: new Date()
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        'data.import.execute.failed',
        'data_import_job',
        job.id,
        this.toImportJobResponse(running),
        this.toImportJobResponse(failed)
      );
      return this.toImportJobResponse(failed);
    }
  }

  async getImportErrorReport(
    id: string,
    operator?: AuthenticatedUser
  ): Promise<ImportErrorReportFile> {
    const job = await this.findImportJobOrThrow(id);
    if (!job.errorReport) {
      throw new ConflictException('Import error report is not ready');
    }

    const absolutePath = this.resolveImportErrorReportPath(job.errorReport);
    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('Import error report file not found');
    }

    await this.writeAudit(
      operator,
      'data.import.error_report.download',
      'data_import_job',
      job.id,
      undefined,
      {
        id: job.id,
        errorReport: job.errorReport,
        downloadedAt: new Date()
      }
    );

    return {
      id: job.id,
      filePath: job.errorReport,
      absolutePath,
      fileName: basename(job.errorReport),
      contentType: 'text/csv; charset=utf-8'
    };
  }

  async listExportJobs(query: ListExportJobsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const containsSensitive = this.parseBoolean(query.containsSensitive);
    const where: Prisma.DataExportJobWhereInput = {
      status: status ?? undefined,
      module: query.module || undefined,
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
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildExportJobOrderBy(query)
      }),
      this.prisma.dataExportJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toExportJobResponse(item)),
      total,
      pagination
    );
  }

  private buildExportJobOrderBy(
    query: ListExportJobsQuery
  ): Prisma.DataExportJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? EXPORT_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createExportJob(dto: CreateExportJobInput, operator?: AuthenticatedUser) {
    const job = await this.prisma.dataExportJob.create({
      data: {
        module: this.normalizeRequiredString(dto.module, 'module'),
        exportScope: this.toNullableJson(dto.exportScope),
        fields: this.normalizeStringArray(dto.fields),
        containsSensitive: Boolean(dto.containsSensitive),
        status: this.parseStatus(dto.status ?? 'pending', true),
        filePath: this.normalizeNullableString(dto.filePath),
        downloadExpiresAt: this.parseNullableDate(dto.downloadExpiresAt, 'downloadExpiresAt'),
        createdById: operator?.id
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.export.create',
      'data_export_job',
      job.id,
      undefined,
      job
    );
    return this.toExportJobResponse(job);
  }

  async updateExportJobStatus(
    id: string,
    dto: UpdateGenericJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findExportJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.dataExportJob.update({
      where: { id: job.id },
      data: {
        ...this.buildGenericStatusUpdate(status, dto),
        filePath:
          dto.filePath === undefined ? undefined : this.normalizeNullableString(dto.filePath),
        downloadExpiresAt:
          dto.downloadExpiresAt === undefined
            ? undefined
            : this.parseNullableDate(dto.downloadExpiresAt, 'downloadExpiresAt')
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.export.status.update',
      'data_export_job',
      job.id,
      this.toExportJobResponse(job),
      this.toExportJobResponse(updated)
    );
    return this.toExportJobResponse(updated);
  }

  async executeExportJob(id: string, operator?: AuthenticatedUser) {
    const job = await this.findExportJobOrThrow(id);
    if (job.status === 'running') {
      throw new ConflictException('Export job is already running');
    }
    if (job.status === 'cancelled') {
      throw new ConflictException('Cancelled export job cannot be executed');
    }

    const running = await this.prisma.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        errorMessage: null
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.export.execute.start',
      'data_export_job',
      job.id,
      this.toExportJobResponse(job),
      this.toExportJobResponse(running)
    );

    try {
      const exportFile = await this.generateExportFile(running);
      const completed = await this.prisma.dataExportJob.update({
        where: { id: job.id },
        data: {
          status: 'success',
          filePath: exportFile.fileName,
          downloadExpiresAt: exportFile.downloadExpiresAt,
          finishedAt: new Date(),
          errorMessage: null
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        'data.export.execute.success',
        'data_export_job',
        job.id,
        this.toExportJobResponse(running),
        this.toExportJobResponse(completed)
      );
      return this.toExportJobResponse(completed);
    } catch (error) {
      const failed = await this.prisma.dataExportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: this.getErrorMessage(error)
        },
        include: this.getUserInclude()
      });

      await this.writeAudit(
        operator,
        'data.export.execute.failed',
        'data_export_job',
        job.id,
        this.toExportJobResponse(running),
        this.toExportJobResponse(failed)
      );
      return this.toExportJobResponse(failed);
    }
  }

  async getExportDownload(id: string, operator?: AuthenticatedUser): Promise<ExportDownloadFile> {
    const job = await this.findExportJobOrThrow(id);
    if (job.status !== 'success' || !job.filePath) {
      throw new ConflictException('导出文件还没准备好，请稍后再试。');
    }
    if (job.downloadExpiresAt && job.downloadExpiresAt.getTime() < Date.now()) {
      throw new ConflictException('导出文件下载已过期，请重新生成导出任务。');
    }
    const absolutePath = this.resolveExportFilePath(job.filePath);
    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('导出文件不存在或已被清理，请重新生成。');
    }

    await this.writeAudit(operator, 'data.export.download', 'data_export_job', job.id, undefined, {
      id: job.id,
      filePath: job.filePath,
      containsSensitive: job.containsSensitive,
      downloadedAt: new Date()
    });

    return {
      id: job.id,
      filePath: job.filePath,
      absolutePath,
      fileName: basename(job.filePath),
      contentType: 'text/csv; charset=utf-8',
      downloadExpiresAt: job.downloadExpiresAt,
      containsSensitive: job.containsSensitive
    };
  }

  async listRecycleBin(query: ListRecycleBinQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const restored = this.parseBoolean(query.restored);
    const where: Prisma.RecycleBinRecordWhereInput = {
      module: query.module || undefined,
      objectType: query.objectType || undefined,
      restoredAt: restored === undefined ? undefined : restored ? { not: null } : null,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { objectType: { contains: keyword, mode: 'insensitive' } },
            { objectLabel: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recycleBinRecord.findMany({
        where,
        include: this.getRecycleBinInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildRecycleBinOrderBy(query)
      }),
      this.prisma.recycleBinRecord.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toRecycleBinResponse(item)),
      total,
      pagination
    );
  }

  private buildRecycleBinOrderBy(
    query: ListRecycleBinQuery
  ): Prisma.RecycleBinRecordOrderByWithRelationInput[] {
    const sortField = query.sortBy ? RECYCLE_BIN_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ deletedAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { deletedAt: 'desc' }];
  }

  async restoreRecycleBinRecord(id: string, operator?: AuthenticatedUser) {
    const record = await this.findRecycleBinRecordOrThrow(id);
    if (record.restoredAt) {
      throw new ConflictException('Recycle bin record has already been restored');
    }
    const updated = await this.prisma.recycleBinRecord.update({
      where: { id: record.id },
      data: {
        restoredAt: new Date(),
        restoredById: operator?.id
      },
      include: this.getRecycleBinInclude()
    });

    await this.writeAudit(
      operator,
      'data.recycle_bin.restore',
      'recycle_bin_record',
      record.id,
      this.toRecycleBinResponse(record),
      this.toRecycleBinResponse(updated)
    );
    return this.toRecycleBinResponse(updated);
  }

  async purgeRecycleBinRecord(id: string, operator?: AuthenticatedUser) {
    const record = await this.findRecycleBinRecordOrThrow(id);
    await this.prisma.recycleBinRecord.delete({ where: { id: record.id } });
    await this.writeAudit(
      operator,
      'data.recycle_bin.purge',
      'recycle_bin_record',
      record.id,
      this.toRecycleBinResponse(record),
      undefined
    );
    return { deleted: true };
  }

  async listCleanupJobs(query: ListJobQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const where: Prisma.DataCleanupJobWhereInput = {
      status: status ?? undefined,
      module: query.module || undefined,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { approvalNote: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataCleanupJob.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildCleanupJobOrderBy(query)
      }),
      this.prisma.dataCleanupJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toCleanupJobResponse(item)),
      total,
      pagination
    );
  }

  private buildCleanupJobOrderBy(
    query: ListJobQuery
  ): Prisma.DataCleanupJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? CLEANUP_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createCleanupJob(dto: CreateCleanupJobInput, operator?: AuthenticatedUser) {
    const job = await this.prisma.dataCleanupJob.create({
      data: {
        module: this.normalizeRequiredString(dto.module, 'module'),
        cleanupScope: this.toNullableJson(dto.cleanupScope),
        status: this.parseStatus(dto.status ?? 'pending', true),
        affectedCount: this.parseNonNegativeInteger(dto.affectedCount ?? 0, 'affectedCount'),
        approvalNote: this.normalizeNullableString(dto.approvalNote),
        createdById: operator?.id
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.cleanup.create',
      'data_cleanup_job',
      job.id,
      undefined,
      job
    );
    return this.toCleanupJobResponse(job);
  }

  async updateCleanupJobStatus(
    id: string,
    dto: UpdateGenericJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findCleanupJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.dataCleanupJob.update({
      where: { id: job.id },
      data: {
        ...this.buildGenericStatusUpdate(status, dto),
        affectedCount:
          dto.affectedCount === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.affectedCount, 'affectedCount')
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.cleanup.status.update',
      'data_cleanup_job',
      job.id,
      this.toCleanupJobResponse(job),
      this.toCleanupJobResponse(updated)
    );
    return this.toCleanupJobResponse(updated);
  }

  async listDuplicateMergeJobs(query: ListJobQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const where: Prisma.DuplicateMergeJobWhereInput = {
      status: status ?? undefined,
      module: query.module || undefined,
      OR: keyword
        ? [
            { module: { contains: keyword, mode: 'insensitive' } },
            { approvalNote: { contains: keyword, mode: 'insensitive' } },
            { errorMessage: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.duplicateMergeJob.findMany({
        where,
        include: this.getUserInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildDuplicateMergeJobOrderBy(query)
      }),
      this.prisma.duplicateMergeJob.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toDuplicateMergeJobResponse(item)),
      total,
      pagination
    );
  }

  private buildDuplicateMergeJobOrderBy(
    query: ListJobQuery
  ): Prisma.DuplicateMergeJobOrderByWithRelationInput[] {
    const sortField = query.sortBy ? DUPLICATE_MERGE_JOB_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  async createDuplicateMergeJob(dto: CreateDuplicateMergeJobInput, operator?: AuthenticatedUser) {
    const job = await this.prisma.duplicateMergeJob.create({
      data: {
        module: this.normalizeRequiredString(dto.module, 'module'),
        matchRule: this.toNullableJson(dto.matchRule),
        primaryObjectId: this.normalizeNullableUuid(dto.primaryObjectId, 'primaryObjectId'),
        duplicateObjectIds: this.normalizeUuidArray(dto.duplicateObjectIds, 'duplicateObjectIds'),
        status: this.parseStatus(dto.status ?? 'pending', true),
        affectedCount: this.parseNonNegativeInteger(dto.affectedCount ?? 0, 'affectedCount'),
        approvalNote: this.normalizeNullableString(dto.approvalNote),
        createdById: operator?.id
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.duplicate_merge.create',
      'duplicate_merge_job',
      job.id,
      undefined,
      job
    );
    return this.toDuplicateMergeJobResponse(job);
  }

  async updateDuplicateMergeJobStatus(
    id: string,
    dto: UpdateGenericJobStatusInput,
    operator?: AuthenticatedUser
  ) {
    const job = await this.findDuplicateMergeJobOrThrow(id);
    const status = this.parseStatus(dto.status, true);
    const updated = await this.prisma.duplicateMergeJob.update({
      where: { id: job.id },
      data: {
        ...this.buildGenericStatusUpdate(status, dto),
        affectedCount:
          dto.affectedCount === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.affectedCount, 'affectedCount')
      },
      include: this.getUserInclude()
    });

    await this.writeAudit(
      operator,
      'data.duplicate_merge.status.update',
      'duplicate_merge_job',
      job.id,
      this.toDuplicateMergeJobResponse(job),
      this.toDuplicateMergeJobResponse(updated)
    );
    return this.toDuplicateMergeJobResponse(updated);
  }

  async listDictionaries(query: ListDictionariesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseDictionaryStatus(query.status, false);
    const where: Prisma.DataDictionaryWhereInput = {
      group: query.group || undefined,
      status: status ?? undefined,
      OR: keyword
        ? [
            { group: { contains: keyword, mode: 'insensitive' } },
            { code: { contains: keyword, mode: 'insensitive' } },
            { label: { contains: keyword, mode: 'insensitive' } },
            { value: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataDictionary.findMany({
        where,
        include: this.getDictionaryInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildDictionaryOrderBy(query)
      }),
      this.prisma.dataDictionary.count({ where })
    ]);

    return this.toPage(
      items.map((item) => this.toDictionaryResponse(item)),
      total,
      pagination
    );
  }

  private buildDictionaryOrderBy(
    query: ListDictionariesQuery
  ): Prisma.DataDictionaryOrderByWithRelationInput[] {
    const sortField = query.sortBy ? DATA_DICTIONARY_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ group: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }];
    }

    return [{ [sortField]: sortOrder }, { group: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }];
  }

  async createDictionary(dto: CreateDataDictionaryInput, operator?: AuthenticatedUser) {
    const group = this.normalizeCode(dto.group, 'group');
    const code = this.normalizeCode(dto.code, 'code');
    const existing = await this.prisma.dataDictionary.findUnique({
      where: { group_code: { group, code } }
    });
    if (existing) throw new ConflictException('Data dictionary code already exists in this group');

    const dictionary = await this.prisma.dataDictionary.create({
      data: {
        group,
        code,
        label: this.normalizeRequiredString(dto.label, 'label'),
        value: this.normalizeNullableString(dto.value),
        sortOrder: this.parseNonNegativeInteger(dto.sortOrder ?? 0, 'sortOrder'),
        status: this.parseDictionaryStatus(dto.status ?? 'active', true),
        remark: this.normalizeNullableString(dto.remark),
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      },
      include: this.getDictionaryInclude()
    });

    await this.writeAudit(
      operator,
      'data.dictionary.create',
      'data_dictionary',
      dictionary.id,
      undefined,
      dictionary
    );
    return this.toDictionaryResponse(dictionary);
  }

  async updateDictionary(id: string, dto: UpdateDataDictionaryInput, operator?: AuthenticatedUser) {
    const dictionary = await this.findDictionaryOrThrow(id);
    const updated = await this.prisma.dataDictionary.update({
      where: { id: dictionary.id },
      data: {
        label:
          dto.label === undefined ? undefined : this.normalizeRequiredString(dto.label, 'label'),
        value: dto.value === undefined ? undefined : this.normalizeNullableString(dto.value),
        sortOrder:
          dto.sortOrder === undefined
            ? undefined
            : this.parseNonNegativeInteger(dto.sortOrder, 'sortOrder'),
        status: dto.status === undefined ? undefined : this.parseDictionaryStatus(dto.status, true),
        remark: dto.remark === undefined ? undefined : this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getDictionaryInclude()
    });

    await this.writeAudit(
      operator,
      'data.dictionary.update',
      'data_dictionary',
      dictionary.id,
      this.toDictionaryResponse(dictionary),
      this.toDictionaryResponse(updated)
    );
    return this.toDictionaryResponse(updated);
  }

  async listSystemParameters(query: ListSystemParametersQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.SystemParameterWhereInput = {
      group: query.group || undefined,
      OR: keyword
        ? [
            { key: { contains: keyword, mode: 'insensitive' } },
            { group: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
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
      return [{ group: 'asc' }, { key: 'asc' }];
    }

    return [{ [sortField]: sortOrder }, { group: 'asc' }, { key: 'asc' }];
  }

  async saveSystemParameter(
    key: string,
    dto: SaveSystemParameterInput,
    operator?: AuthenticatedUser
  ) {
    const normalizedKey = this.normalizeCode(key, 'key');
    const previous = await this.prisma.systemParameter.findUnique({
      where: { key: normalizedKey },
      include: this.getParameterInclude()
    });
    const parameter = await this.prisma.systemParameter.upsert({
      where: { key: normalizedKey },
      update: {
        value: this.toRequiredJson(dto.value),
        group: dto.group === undefined ? undefined : this.normalizeCode(dto.group, 'group'),
        remark: dto.remark === undefined ? undefined : this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      create: {
        key: normalizedKey,
        value: this.toRequiredJson(dto.value),
        group: dto.group ? this.normalizeCode(dto.group, 'group') : 'default',
        remark: this.normalizeNullableString(dto.remark),
        updatedByUserId: operator?.id
      },
      include: this.getParameterInclude()
    });

    await this.writeAudit(
      operator,
      'data.system_parameter.update',
      'system_parameter',
      parameter.id,
      previous ? this.toParameterResponse(previous) : undefined,
      this.toParameterResponse(parameter)
    );
    return this.toParameterResponse(parameter);
  }

  private buildGenericStatusUpdate(status: DataJobStatus, dto: UpdateGenericJobStatusInput) {
    return {
      status,
      errorMessage:
        dto.errorMessage === undefined ? undefined : this.normalizeNullableString(dto.errorMessage),
      startedAt: status === 'running' ? new Date() : undefined,
      finishedAt: this.isTerminalStatus(status) ? new Date() : undefined
    };
  }

  private async notifyBackupFailure(job: BackupJobWithUser) {
    if (job.status !== 'failed') return;
    try {
      await this.notificationsService.triggerEvent({
        eventCode: 'ops.backup.failed',
        module: 'ops',
        title: '备份失败',
        content: `备份任务 ${job.id} 执行失败`,
        payload: {
          title: '备份失败',
          summary: `备份任务 ${job.id} 执行失败`,
          detail: job.errorMessage ?? '请在数据中心查看失败原因。',
          backupJobId: job.id,
          jobType: job.jobType,
          status: job.status
        }
      });
    } catch {
      // 数据任务状态不能因为系统通知异常而更新失败。
    }
  }

  private async executeDatabaseBackupScript(): Promise<BackupExecutionResult> {
    const scriptPath = resolve(this.getProjectRoot(), 'scripts/backup-postgres.sh');
    await access(scriptPath);
    await mkdir(this.getBackupDirectory(), { recursive: true });

    const commandResult = await this.runCommand('bash', [scriptPath], {
      ...process.env,
      BACKUP_DIR: this.getBackupDirectory()
    });
    const output = `${commandResult.stdout}\n${commandResult.stderr}`;
    const match = output.match(/Backup written to\s+(.+)/);
    if (!match?.[1]) {
      throw new Error('Backup script did not report output file path');
    }

    const absolutePath = this.resolveBackupFilePath(match[1].trim());
    const fileStat = await stat(absolutePath);
    return {
      ...commandResult,
      storagePath: this.toStoragePath(absolutePath),
      fileSize: fileStat.size
    };
  }

  private async executeRestoreDrillScript(backupFilePath: string): Promise<CommandResult> {
    const scriptPath = resolve(this.getProjectRoot(), 'scripts/verify-postgres-restore.sh');
    await access(scriptPath);
    return this.runCommand('bash', [scriptPath, backupFilePath], {
      ...process.env,
      BACKUP_DIR: this.getBackupDirectory()
    });
  }

  private runCommand(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv
  ): Promise<CommandResult> {
    const timeoutMs = Number(process.env.DATA_JOB_COMMAND_TIMEOUT_MS ?? 10 * 60 * 1000);
    return new Promise((resolvePromise, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = Number.isFinite(timeoutMs)
        ? setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${timeoutMs}ms`));
          }, timeoutMs)
        : undefined;

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        settled = true;
        if (timer) clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        reject(new Error(this.truncateText(`${stderr}\n${stdout}`) || `Command exited ${code}`));
      });
    });
  }

  private getBackupDirectory() {
    return resolve(this.getProjectRoot(), process.env.DATA_BACKUP_DIR ?? DEFAULT_DATA_BACKUP_DIR);
  }

  private resolveBackupFilePath(filePath: string) {
    const normalized = this.normalizeRequiredString(filePath, 'filePath');
    if (normalized.includes('\0')) {
      throw new BadRequestException('Backup file path is invalid');
    }

    const backupRoot = this.getBackupDirectory();
    const candidates = [
      isAbsolute(normalized) ? resolve(normalized) : resolve(this.getProjectRoot(), normalized),
      resolve(backupRoot, normalized)
    ];
    const absolutePath = candidates.find((candidate) => this.isPathInside(candidate, backupRoot));
    if (!absolutePath) {
      throw new BadRequestException('Backup file path is outside configured backup directory');
    }
    return absolutePath;
  }

  private toStoragePath(absolutePath: string) {
    const root = this.getProjectRoot();
    if (this.isPathInside(absolutePath, root)) {
      return relative(root, absolutePath).replace(/\\/g, '/');
    }
    return absolutePath;
  }

  private getProjectRoot() {
    let current = process.cwd();
    for (let depth = 0; depth < 6; depth += 1) {
      if (
        existsSync(resolve(current, 'package.json')) &&
        existsSync(resolve(current, 'scripts/backup-postgres.sh'))
      ) {
        return current;
      }
      const parent = resolve(current, '..');
      if (parent === current) break;
      current = parent;
    }
    return process.cwd();
  }

  private isPathInside(childPath: string, parentPath: string) {
    const relativePath = relative(resolve(parentPath), resolve(childPath));
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
  }

  private getRestoreConfirmText(restoreJobId: string) {
    return `${RESTORE_DRILL_CONFIRM_PREFIX} ${restoreJobId.slice(0, 8)}`;
  }

  private async executeCsvImport(
    job: ImportJobWithUser,
    operator?: AuthenticatedUser
  ): Promise<ImportExecutionResult> {
    if (!job.filePath) {
      throw new BadRequestException('Import file path is required');
    }

    const csvText = await readFile(this.resolveImportFilePath(job.filePath), 'utf8');
    const records = this.parseCsv(csvText);
    if (records.length > DATA_IMPORT_MAX_ROWS) {
      throw new BadRequestException(`Import row count cannot exceed ${DATA_IMPORT_MAX_ROWS}`);
    }

    const errors: ImportErrorRow[] = [];
    let successCount = 0;
    const module = this.normalizeImportModule(job.module);

    for (const record of records) {
      try {
        if (module === 'customers') {
          await this.importCustomerRow(record.values, operator);
        } else if (module === 'source_platforms') {
          await this.importSourcePlatformRow(record.values, operator);
        } else {
          throw new BadRequestException(
            'Unsupported import module. Supported modules: customers, source_platforms'
          );
        }
        successCount += 1;
      } catch (error) {
        errors.push({
          lineNumber: record.lineNumber,
          message: this.getErrorMessage(error),
          values: record.values
        });
      }
    }

    return {
      totalCount: records.length,
      successCount,
      failedCount: errors.length,
      errorReport: errors.length ? await this.writeImportErrorReport(job.id, errors) : null
    };
  }

  private async importCustomerRow(row: Record<string, string>, operator?: AuthenticatedUser) {
    const name = this.getRequiredImportValue(row, 'name');
    const sourcePlatformId = await this.resolveImportSourcePlatformId(row);
    const status = this.parseImportStatus(row.status, ['active', 'disabled'] as const, 'active');
    const phone = this.getOptionalImportValue(row, 'phone');

    await this.prisma.customer.create({
      data: {
        name,
        phone,
        phoneTail: this.getTail(phone),
        wechat: this.getOptionalImportValue(row, 'wechat'),
        sourcePlatformId,
        tags: this.parseImportTags(row.tags),
        remark: this.getOptionalImportValue(row, 'remark'),
        status,
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      }
    });
  }

  private async importSourcePlatformRow(row: Record<string, string>, operator?: AuthenticatedUser) {
    const name = this.getRequiredImportValue(row, 'name');

    await this.prisma.sourcePlatform.create({
      data: {
        name,
        feeRate: this.parseImportDecimal(row.feeRate, 'feeRate', 4),
        feeFixed: this.parseImportDecimal(row.feeFixed, 'feeFixed', 2),
        status: this.parseImportStatus(row.status, ['active', 'disabled'] as const, 'active'),
        remark: this.getOptionalImportValue(row, 'remark'),
        ...(operator?.id
          ? {
              createdBy: { connect: { id: operator.id } },
              updatedBy: { connect: { id: operator.id } }
            }
          : {})
      }
    });
  }

  private async resolveImportSourcePlatformId(row: Record<string, string>) {
    const explicitId = this.getOptionalImportValue(row, 'sourcePlatformId');
    if (explicitId) {
      return this.normalizeRequiredUuid(explicitId, 'sourcePlatformId');
    }

    const name = this.getOptionalImportValue(row, 'sourcePlatformName');
    if (!name) return null;

    const sourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: {
        name,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!sourcePlatform) {
      throw new BadRequestException(`Source platform name does not exist: ${name}`);
    }
    return sourcePlatform.id;
  }

  private parseCsv(csvText: string): CsvRecord[] {
    const rows = this.parseCsvRows(csvText.replace(/^\uFEFF/, ''));
    if (!rows.length) return [];

    const headers = rows[0]?.map((header) => header.trim()).filter(Boolean) ?? [];
    if (!headers.length) {
      throw new BadRequestException('CSV header is required');
    }

    return rows.slice(1).flatMap((row, index) => {
      if (row.every((value) => !value.trim())) return [];
      const values = headers.reduce<Record<string, string>>((accumulator, header, headerIndex) => {
        accumulator[header] = row[headerIndex]?.trim() ?? '';
        return accumulator;
      }, {});
      return [
        {
          lineNumber: index + 2,
          values
        }
      ];
    });
  }

  private parseCsvRows(csvText: string) {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const char = csvText[index];
      const nextChar = csvText[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        currentRow.push(currentValue);
        currentValue = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') index += 1;
        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = '';
        continue;
      }

      currentValue += char;
    }

    if (inQuotes) {
      throw new BadRequestException('CSV quotes are not closed');
    }

    if (currentValue || currentRow.length) {
      currentRow.push(currentValue);
      rows.push(currentRow);
    }

    return rows;
  }

  private async writeImportErrorReport(jobId: string, errors: ImportErrorRow[]) {
    const errorDirectory = this.getImportErrorDirectory();
    await mkdir(errorDirectory, { recursive: true });
    const fileName = `import-errors-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')}-${jobId.slice(0, 8)}.csv`;
    const allKeys = Array.from(new Set(errors.flatMap((error) => Object.keys(error.values))));
    const fields = ['lineNumber', 'message', ...allKeys];
    const rows = errors.map((error) => ({
      lineNumber: error.lineNumber,
      message: error.message,
      ...error.values
    }));
    await writeFile(resolve(errorDirectory, fileName), this.toCsv(fields, rows), 'utf8');
    return fileName;
  }

  private getRequiredImportValue(row: Record<string, string>, field: string) {
    const value = this.getOptionalImportValue(row, field);
    if (!value) {
      throw new BadRequestException(`${field} is required`);
    }
    return value;
  }

  private getOptionalImportValue(row: Record<string, string>, field: string) {
    const value = row[field];
    return value?.trim() || null;
  }

  private parseImportTags(value: string | undefined) {
    if (!value) return [];
    return [
      ...new Set(
        value
          .split(/[|,]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ];
  }

  private parseImportBoolean(value: string | undefined) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', '是', '启用'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', '否', '停用'].includes(normalized)) return false;
    throw new BadRequestException(`Boolean value is invalid: ${value}`);
  }

  private parseImportStatus<TAllowed extends string>(
    value: string | undefined,
    allowedValues: readonly TAllowed[],
    fallback: TAllowed
  ) {
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase();
    if (allowedValues.includes(normalized as TAllowed)) return normalized as TAllowed;
    throw new BadRequestException(`Unsupported value: ${value}`);
  }

  private parseImportDecimal(value: string | undefined, field: string, maxScale: number) {
    if (!value) return '0';
    const normalized = value.trim();
    const decimalPattern = new RegExp(`^\\d+(\\.\\d{1,${maxScale}})?$`);
    if (!decimalPattern.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }
    return normalized;
  }

  private normalizeImportModule(value: string) {
    return value.trim().toLowerCase().replace(/-/g, '_');
  }

  private getTail(value?: string | null) {
    const normalized = value?.trim().replace(/\s+/g, '');
    return normalized ? normalized.slice(-4) : null;
  }

  private getImportDirectory() {
    return resolve(process.cwd(), process.env.DATA_IMPORT_DIR ?? DEFAULT_DATA_IMPORT_DIR);
  }

  private getImportErrorDirectory() {
    return resolve(
      process.cwd(),
      process.env.DATA_IMPORT_ERROR_DIR ?? DEFAULT_DATA_IMPORT_ERROR_DIR
    );
  }

  private resolveImportFilePath(filePath: string) {
    return resolve(this.getImportDirectory(), this.assertSafeRuntimeFileName(filePath));
  }

  private resolveImportErrorReportPath(filePath: string) {
    return resolve(this.getImportErrorDirectory(), this.assertSafeRuntimeFileName(filePath));
  }

  private assertSafeRuntimeFileName(filePath: string) {
    const normalized = filePath.trim();
    if (
      !normalized ||
      normalized.includes('/') ||
      normalized.includes('\\') ||
      normalized === '..'
    ) {
      throw new ConflictException('Runtime file path is invalid');
    }
    return normalized;
  }

  private async generateExportFile(job: ExportJobWithUser) {
    const dataSet = await this.loadExportDataSet(job);
    const exportDirectory = this.getExportDirectory();
    await mkdir(exportDirectory, { recursive: true });

    const fileName = `${job.module}-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')}-${job.id.slice(0, 8)}.csv`;
    const absolutePath = resolve(exportDirectory, fileName);
    await writeFile(absolutePath, this.toCsv(dataSet.fields, dataSet.rows), 'utf8');
    const fileStats = await stat(absolutePath);

    return {
      fileName,
      fileSize: fileStats.size,
      downloadExpiresAt: new Date(Date.now() + DATA_EXPORT_EXPIRES_HOURS * 60 * 60 * 1000)
    };
  }

  private async loadExportDataSet(job: ExportJobWithUser): Promise<ExportDataSet> {
    const module = this.normalizeExportModule(job.module);
    const dataSet =
      module === 'customers'
        ? await this.loadCustomerExport()
        : module === 'source_platforms'
          ? await this.loadSourcePlatformExport()
          : module === 'apple_accounts'
            ? await this.loadAppleAccountExport()
            : module === 'apple_orders'
              ? await this.loadAppleOrderExport()
              : module === 'redeem_codes'
                ? await this.loadRedeemCodeExport()
                : module === 'code_orders'
                  ? await this.loadCodeOrderExport()
                  : undefined;

    if (!dataSet) {
      throw new BadRequestException(
        'Unsupported export module. Supported modules: customers, source_platforms, apple_accounts, apple_orders, redeem_codes, code_orders'
      );
    }

    const requestedFields = this.normalizeStringArray(job.fields);
    if (!requestedFields.length) return dataSet;

    const allowedFields = new Set(dataSet.fields);
    const fields = requestedFields.filter((field) => allowedFields.has(field));
    if (!fields.length) {
      throw new BadRequestException('Export fields are not supported by this module');
    }

    return {
      fields,
      rows: dataSet.rows.map((row) => this.pickExportFields(row, fields))
    };
  }

  private async loadCustomerExport(): Promise<ExportDataSet> {
    const items = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phoneTail: true,
        wechat: true,
        tags: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
        sourcePlatform: { select: { name: true } }
      }
    });
    const fields = [
      'id',
      'name',
      'phoneMasked',
      'wechat',
      'sourcePlatform',
      'tags',
      'status',
      'remark',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        id: item.id,
        name: item.name,
        phoneMasked: item.phoneTail ? `***${item.phoneTail}` : '',
        wechat: item.wechat,
        sourcePlatform: item.sourcePlatform?.name,
        tags: item.tags,
        status: item.status,
        remark: item.remark,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private async loadSourcePlatformExport(): Promise<ExportDataSet> {
    const items = await this.prisma.sourcePlatform.findMany({
      where: { deletedAt: null },
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        feeRate: true,
        feeFixed: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const fields = [
      'id',
      'name',
      'feeRate',
      'feeFixed',
      'status',
      'remark',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        ...item,
        feeRate: item.feeRate.toString(),
        feeFixed: item.feeFixed.toString()
      }))
    };
  }

  private async loadAppleAccountExport(): Promise<ExportDataSet> {
    const items = await this.prisma.appleAccount.findMany({
      where: { deletedAt: null },
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        appleId: true,
        region: true,
        currency: true,
        currentBalance: true,
        balanceCostAmount: true,
        averageCost: true,
        status: true,
        isManuallyLocked: true,
        manualLockReason: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const fields = [
      'id',
      'appleIdMasked',
      'appleIdTail',
      'region',
      'currency',
      'currentBalance',
      'balanceCostAmount',
      'averageCost',
      'status',
      'isManuallyLocked',
      'manualLockReason',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        id: item.id,
        appleIdMasked: this.maskAppleId(item.appleId),
        appleIdTail: item.appleId.slice(-6),
        region: item.region,
        currency: item.currency,
        currentBalance: item.currentBalance.toString(),
        balanceCostAmount: item.balanceCostAmount.toString(),
        averageCost: item.averageCost.toString(),
        status: item.status,
        isManuallyLocked: item.isManuallyLocked,
        manualLockReason: item.manualLockReason,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private async loadAppleOrderExport(): Promise<ExportDataSet> {
    const items = await this.prisma.appleOrder.findMany({
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNo: true,
        externalOrderNo: true,
        serviceAccount: true,
        currentPlan: true,
        targetPlan: true,
        startTime: true,
        expireTime: true,
        paidAmount: true,
        platformFee: true,
        refundLoss: true,
        appleCostValue: true,
        appleCostRmb: true,
        profitAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true } },
        sourcePlatform: { select: { name: true } },
        service: { select: { name: true } },
        appleAccount: { select: { appleId: true } }
      }
    });
    const fields = [
      'id',
      'orderNo',
      'customer',
      'sourcePlatform',
      'externalOrderNo',
      'service',
      'appleIdMasked',
      'serviceAccount',
      'currentPlan',
      'targetPlan',
      'startTime',
      'expireTime',
      'paidAmount',
      'platformFee',
      'refundLoss',
      'appleCostValue',
      'appleCostRmb',
      'profitAmount',
      'status',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        id: item.id,
        orderNo: item.orderNo,
        customer: item.customer.name,
        sourcePlatform: item.sourcePlatform?.name,
        externalOrderNo: item.externalOrderNo,
        service: item.service.name,
        appleIdMasked: item.appleAccount ? this.maskAppleId(item.appleAccount.appleId) : '',
        serviceAccount: item.serviceAccount,
        currentPlan: item.currentPlan,
        targetPlan: item.targetPlan,
        startTime: item.startTime,
        expireTime: item.expireTime,
        paidAmount: item.paidAmount.toString(),
        platformFee: item.platformFee.toString(),
        refundLoss: item.refundLoss.toString(),
        appleCostValue: item.appleCostValue.toString(),
        appleCostRmb: item.appleCostRmb.toString(),
        profitAmount: item.profitAmount.toString(),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private async loadRedeemCodeExport(): Promise<ExportDataSet> {
    const items = await this.prisma.redeemCode.findMany({
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        codeTail: true,
        faceValue: true,
        cost: true,
        status: true,
        deliveredAt: true,
        expireAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
        service: { select: { name: true } },
        batch: { select: { batchNo: true } }
      }
    });
    const fields = [
      'id',
      'service',
      'batchNo',
      'codeTail',
      'faceValue',
      'cost',
      'status',
      'deliveredAt',
      'expireAt',
      'remark',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        id: item.id,
        service: item.service.name,
        batchNo: item.batch.batchNo,
        codeTail: item.codeTail,
        faceValue: item.faceValue.toString(),
        cost: item.cost.toString(),
        status: item.status,
        deliveredAt: item.deliveredAt,
        expireAt: item.expireAt,
        remark: item.remark,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private async loadCodeOrderExport(): Promise<ExportDataSet> {
    const items = await this.prisma.codePlatformOrder.findMany({
      take: DATA_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        externalOrderNo: true,
        buyerNameMasked: true,
        itemTitle: true,
        skuName: true,
        faceValue: true,
        quantity: true,
        paidAmount: true,
        platformFee: true,
        costAmount: true,
        profitAmount: true,
        orderStatus: true,
        deliveryStatus: true,
        refundStatus: true,
        paidAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        platform: { select: { name: true } },
        service: { select: { name: true } }
      }
    });
    const fields = [
      'id',
      'platform',
      'externalOrderNo',
      'buyerNameMasked',
      'itemTitle',
      'skuName',
      'service',
      'faceValue',
      'quantity',
      'paidAmount',
      'platformFee',
      'costAmount',
      'profitAmount',
      'orderStatus',
      'deliveryStatus',
      'refundStatus',
      'paidAt',
      'deliveredAt',
      'createdAt',
      'updatedAt'
    ];
    return {
      fields,
      rows: items.map((item) => ({
        id: item.id,
        platform: item.platform.name,
        externalOrderNo: item.externalOrderNo,
        buyerNameMasked: item.buyerNameMasked,
        itemTitle: item.itemTitle,
        skuName: item.skuName,
        service: item.service?.name,
        faceValue: item.faceValue?.toString() ?? '',
        quantity: item.quantity,
        paidAmount: item.paidAmount.toString(),
        platformFee: item.platformFee.toString(),
        costAmount: item.costAmount.toString(),
        profitAmount: item.profitAmount.toString(),
        orderStatus: item.orderStatus,
        deliveryStatus: item.deliveryStatus,
        refundStatus: item.refundStatus,
        paidAt: item.paidAt,
        deliveredAt: item.deliveredAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private pickExportFields(row: Record<string, unknown>, fields: string[]) {
    return fields.reduce<Record<string, unknown>>((accumulator, field) => {
      accumulator[field] = row[field];
      return accumulator;
    }, {});
  }

  private toCsv(fields: string[], rows: Record<string, unknown>[]) {
    const header = fields.map((field) => this.escapeCsvValue(field)).join(',');
    const body = rows.map((row) =>
      fields.map((field) => this.escapeCsvValue(this.formatExportValue(row[field]))).join(',')
    );
    return `\uFEFF${[header, ...body].join('\n')}\n`;
  }

  private escapeCsvValue(value: unknown) {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private formatExportValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.join('|');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private normalizeExportModule(value: string) {
    return value.trim().toLowerCase().replace(/-/g, '_');
  }

  private getExportDirectory() {
    return resolve(process.cwd(), process.env.DATA_EXPORT_DIR ?? DEFAULT_DATA_EXPORT_DIR);
  }

  private resolveExportFilePath(filePath: string) {
    const normalized = filePath.trim();
    if (
      !normalized ||
      normalized.includes('/') ||
      normalized.includes('\\') ||
      normalized === '..'
    ) {
      throw new ConflictException('Export file path is invalid');
    }
    return resolve(this.getExportDirectory(), normalized);
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) return '***';
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') return JSON.stringify(error);
    return 'Data job failed';
  }

  private truncateText(value: string, maxLength = 2000) {
    const normalized = value.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength)}...`;
  }

  private async writeAudit(
    operator: AuthenticatedUser | undefined,
    action: string,
    objectType: string,
    objectId: string,
    beforeData: unknown,
    afterData: unknown
  ) {
    this.overviewCache.clear();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'data',
      action,
      objectType,
      objectId,
      beforeData: beforeData === undefined ? undefined : this.toAuditJson(beforeData),
      afterData: afterData === undefined ? undefined : this.toAuditJson(afterData),
      remark: `${action} ${objectType} ${objectId}`
    });
  }

  private async findBackupJobOrThrow(id: string) {
    const job = await this.prisma.backupJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getUserInclude()
    });
    if (!job) throw new NotFoundException('Backup job not found');
    return job;
  }

  private async findRestoreJobOrThrow(id: string) {
    const job = await this.prisma.restoreJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getRestoreInclude()
    });
    if (!job) throw new NotFoundException('Restore job not found');
    return job;
  }

  private async findImportJobOrThrow(id: string) {
    const job = await this.prisma.dataImportJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getUserInclude()
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  private async findExportJobOrThrow(id: string) {
    const job = await this.prisma.dataExportJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getUserInclude()
    });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }

  private async findRecycleBinRecordOrThrow(id: string) {
    const record = await this.prisma.recycleBinRecord.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getRecycleBinInclude()
    });
    if (!record) throw new NotFoundException('Recycle bin record not found');
    return record;
  }

  private async findCleanupJobOrThrow(id: string) {
    const job = await this.prisma.dataCleanupJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getUserInclude()
    });
    if (!job) throw new NotFoundException('Cleanup job not found');
    return job;
  }

  private async findDuplicateMergeJobOrThrow(id: string) {
    const job = await this.prisma.duplicateMergeJob.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getUserInclude()
    });
    if (!job) throw new NotFoundException('Duplicate merge job not found');
    return job;
  }

  private async findDictionaryOrThrow(id: string) {
    const dictionary = await this.prisma.dataDictionary.findUnique({
      where: { id: this.normalizeRequiredUuid(id, 'id') },
      include: this.getDictionaryInclude()
    });
    if (!dictionary) throw new NotFoundException('Data dictionary not found');
    return dictionary;
  }

  private getUserInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    };
  }

  private getRestoreInclude() {
    return {
      backupJob: {
        select: {
          id: true,
          jobType: true,
          status: true,
          storagePath: true,
          createdAt: true
        }
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.RestoreJobInclude;
  }

  private getRecycleBinInclude() {
    return {
      deletedBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      },
      restoredBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.RecycleBinRecordInclude;
  }

  private getDictionaryInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      },
      updatedBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.DataDictionaryInclude;
  }

  private getParameterInclude() {
    return {
      updatedBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.SystemParameterInclude;
  }

  private toBackupJobResponse(job: BackupJobWithUser) {
    return {
      ...job,
      fileSize: job.fileSize?.toString() ?? null
    };
  }

  private toRestoreJobResponse(job: RestoreJobWithRelations) {
    return job;
  }

  private toImportJobResponse(job: ImportJobWithUser) {
    return job;
  }

  private toExportJobResponse(job: ExportJobWithUser) {
    return job;
  }

  private toRecycleBinResponse(record: RecycleBinWithUsers) {
    return record;
  }

  private toCleanupJobResponse(job: CleanupJobWithUser) {
    return job;
  }

  private toDuplicateMergeJobResponse(job: DuplicateMergeJobWithUser) {
    return job;
  }

  private toDictionaryResponse(dictionary: DictionaryWithUsers) {
    return dictionary;
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

  private parseStatus(value: unknown, strict: true): DataJobStatus;
  private parseStatus(value: unknown, strict?: false): DataJobStatus | undefined;
  private parseStatus(value: unknown, strict = true) {
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
    throw new BadRequestException('status is invalid');
  }

  private parseJobType(value: unknown, strict: true): BackupJobType;
  private parseJobType(value: unknown, strict?: false): BackupJobType | undefined;
  private parseJobType(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('jobType is required');
      return undefined;
    }
    if (value === 'database' || value === 'files' || value === 'config') return value;
    throw new BadRequestException('jobType is invalid');
  }

  private parseDictionaryStatus(value: unknown, strict: true): DataDictionaryStatus;
  private parseDictionaryStatus(value: unknown, strict?: false): DataDictionaryStatus | undefined;
  private parseDictionaryStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      if (strict) throw new BadRequestException('status is required');
      return undefined;
    }
    if (value === 'active' || value === 'disabled') return value;
    throw new BadRequestException('dictionary status is invalid');
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | undefined {
    if (value === 'asc' || value === 'desc') return value;
    return undefined;
  }

  private parseNonNegativeInteger(value: unknown, field: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return parsed;
  }

  private parseNullableBigInt(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
      return BigInt(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return BigInt(value);
    }
    throw new BadRequestException(`${field} must be a non-negative integer`);
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

  private normalizeNullableUuid(value: string | null | undefined, field: string) {
    if (!value) return null;
    return this.normalizeRequiredUuid(value, field);
  }

  private normalizeStringArray(value: unknown) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('fields must be an array');
    return value.map((item, index) => this.normalizeRequiredString(item, `fields[${index}]`));
  }

  private normalizeUuidArray(value: unknown, field: string) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException(`${field} must be an array`);
    return value.map((item, index) => this.normalizeRequiredUuid(item, `${field}[${index}]`));
  }

  private toNullableJson(value: unknown) {
    if (value === undefined || value === null) return PrismaNamespace.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private toRequiredJson(value: unknown) {
    if (value === undefined || value === null) return {};
    return value as Prisma.InputJsonValue;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private isTerminalStatus(status: DataJobStatus) {
    return status === 'success' || status === 'failed' || status === 'cancelled';
  }
}
