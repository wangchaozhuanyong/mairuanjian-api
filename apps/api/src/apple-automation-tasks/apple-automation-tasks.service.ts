import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';
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
import type { BulkDeleteAutomationTasksDto } from './dto/bulk-delete-automation-tasks.dto';
import type { CreateGiftCardBalanceCheckDto } from './dto/create-gift-card-balance-check.dto';
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';
import type {
  GiftCardQueryAccountStatus,
  SaveGiftCardQueryAccountsDto
} from './dto/save-gift-card-query-accounts.dto';
import type {
  AutomationTaskManualInputType,
  SubmitManualInputDto
} from './dto/submit-manual-input.dto';
import type { UpdateGiftCardBalanceCheckRowDto } from './dto/update-gift-card-balance-check-row.dto';
import type { WebCheckGatewayAttemptDto } from './dto/web-check-gateway-attempt.dto';

const execFileAsync = promisify(execFile);

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
const GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY = 'apple_gift_card_query_accounts';
const GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY = 'apple_gift_card_balance_check_runs';
const GIFT_CARD_QUERY_ACCOUNTS_GROUP = 'apple_gift_card_automation';
const GIFT_CARD_QUERY_ACCOUNT_LIMIT = 5;
const GIFT_CARD_BALANCE_CHECK_ATTACHMENT_LIMIT = 50;
const GIFT_CARD_BALANCE_CHECK_RUN_HISTORY_LIMIT = 20;
const GIFT_CARD_OCR_DEFAULT_TIMEOUT_MS = 15_000;
const GIFT_CARD_BALANCE_QUERY_DEFAULT_TIMEOUT_MS = 180_000;
const WORKBENCH_STATUS_CACHE_TTL_MS = 10_000;

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

interface GiftCardQueryAccountStored {
  id: string;
  appleIdEncrypted: string | null;
  appleIdHash: string | null;
  appleIdMasked: string;
  passwordEncrypted: string | null;
  status: GiftCardQueryAccountStatus;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardQueryAccountResponse {
  id: string;
  appleIdMasked: string;
  passwordSaved: boolean;
  status: GiftCardQueryAccountStatus;
  remark: string | null;
  updatedAt: string;
}

export interface GiftCardQueryAccountsResponse {
  items: GiftCardQueryAccountResponse[];
  maxAccounts: number;
  updatedAt: string | null;
}

export type GiftCardBalanceCheckRowStatus =
  | 'pending_ocr'
  | 'waiting_worker'
  | 'manual_required'
  | 'success'
  | 'failed';

interface GiftCardBalanceCheckRowStored {
  id: string;
  attachmentId: string;
  fileName: string;
  extractedCode: string;
  giftCardCodeEncrypted: string | null;
  giftCardCodeHash: string | null;
  giftCardCodeTail: string | null;
  assignedAccountId: string | null;
  assignedAppleIdMasked: string;
  status: GiftCardBalanceCheckRowStatus;
  balance: string;
  currency: string;
  message: string;
}

interface GiftCardCodeFields {
  extractedCode: string;
  giftCardCodeEncrypted: string | null;
  giftCardCodeHash: string | null;
  giftCardCodeTail: string | null;
}

interface GiftCardBalanceQueryAccountPayload {
  id: string;
  appleId: string;
  password: string;
}

interface GiftCardBalanceQueryRowPayload {
  id: string;
  giftCardCode: string;
  giftCardCodeTail: string | null;
  assignedAccountId: string | null;
  assignedAppleId: string;
  fileName: string;
}

interface GiftCardBalanceQueryCommandPayload {
  runId: string;
  createdAt: string;
  accounts: GiftCardBalanceQueryAccountPayload[];
  rows: GiftCardBalanceQueryRowPayload[];
}

interface GiftCardBalanceQueryCommandResultRow {
  rowId: string;
  status: Extract<GiftCardBalanceCheckRowStatus, 'manual_required' | 'success' | 'failed'>;
  balance: string;
  currency: string;
  message: string;
}

interface GiftCardBalanceCheckRunStored {
  id: string;
  status: 'waiting_worker' | 'manual_required' | 'completed';
  accountCount: number;
  imageCount: number;
  rows: GiftCardBalanceCheckRowStored[];
  createdAt: string;
  createdByUserId: string | null;
}

export interface GiftCardBalanceCheckRowResponse {
  id: string;
  attachmentId: string;
  fileName: string;
  extractedCode: string;
  assignedAppleId: string;
  status: GiftCardBalanceCheckRowStatus;
  balance: string;
  currency: string;
  message: string;
}

export interface GiftCardBalanceCheckRunResponse {
  id: string;
  status: GiftCardBalanceCheckRunStored['status'];
  accountCount: number;
  imageCount: number;
  rows: GiftCardBalanceCheckRowResponse[];
  createdAt: string;
}

type GiftCardOcrReadStatus =
  | 'disabled'
  | 'missing_file'
  | 'unavailable'
  | 'timeout'
  | 'failed'
  | 'completed';

interface GiftCardOcrReadResult {
  status: GiftCardOcrReadStatus;
  text: string | null;
}

export interface AppleWebGatewayCandidateResponse extends AppleWebGatewayNodeCandidate {
  protocol: string | null;
  hasEncryptedConfig: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  failureReason: string | null;
}

interface WorkbenchCapabilityStatus {
  mode: string;
  enabled: boolean;
  ready: boolean;
  queuedCount: number;
  runningCount: number;
  manualRequiredCount: number;
  failedCount: number;
  message: string;
}

interface WorkbenchStatusCheckCapability extends WorkbenchCapabilityStatus {
  gatewayConfigured: boolean;
  configuredRegions: string[];
  availableGatewayCountries: string[];
  workerIntervalMs: number;
  workerMaxBatch: number;
}

export interface WorkbenchStatusResponse {
  checkedAt: string;
  statusCheck: WorkbenchStatusCheckCapability;
  balanceCheck: WorkbenchCapabilityStatus;
  officialPriceCheck: WorkbenchCapabilityStatus;
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
  private workbenchStatusCache: { expiresAt: number; data: WorkbenchStatusResponse } | null = null;

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

  async listGiftCardQueryAccounts(): Promise<GiftCardQueryAccountsResponse> {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY }
    });

    return this.toGiftCardQueryAccountsResponse(parameter);
  }

  async saveGiftCardQueryAccounts(
    dto: SaveGiftCardQueryAccountsDto,
    operator?: AuthenticatedUser
  ): Promise<GiftCardQueryAccountsResponse> {
    const existing = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY }
    });
    const existingAccounts = this.readStoredGiftCardQueryAccounts(existing?.value);
    const existingByHash = new Map(
      existingAccounts
        .filter((account) => account.appleIdHash)
        .map((account) => [account.appleIdHash, account])
    );
    const accounts = this.normalizeGiftCardQueryAccountInputs(dto?.accounts).map((item) => {
      const appleIdHash = this.fieldEncryptionService.hash(item.appleId.toLowerCase());
      if (!appleIdHash) {
        throw new BadRequestException('accounts.appleId is required');
      }
      const existingAccount = existingByHash.get(appleIdHash);
      const updatedAt = new Date().toISOString();
      return {
        id: existingAccount?.id ?? randomUUID(),
        appleIdEncrypted: this.fieldEncryptionService.encrypt(item.appleId),
        appleIdHash,
        appleIdMasked: this.maskAppleId(item.appleId),
        passwordEncrypted: this.fieldEncryptionService.encrypt(item.password),
        status: item.status,
        remark: item.remark,
        createdAt: existingAccount?.createdAt ?? updatedAt,
        updatedAt
      } satisfies GiftCardQueryAccountStored;
    });
    const nextValue = this.toAuditJson({
      version: 1,
      accounts
    });

    const parameter = await this.prisma.systemParameter.upsert({
      where: { key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY },
      update: {
        value: nextValue,
        group: GIFT_CARD_QUERY_ACCOUNTS_GROUP,
        remark: 'Apple 礼品卡余额查询长期登录账号池',
        updatedByUserId: operator?.id
      },
      create: {
        key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY,
        value: nextValue,
        group: GIFT_CARD_QUERY_ACCOUNTS_GROUP,
        remark: 'Apple 礼品卡余额查询长期登录账号池',
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.gift_card_query_accounts.save',
      objectType: 'system_parameter',
      objectId: parameter.id,
      beforeData: existing
        ? this.toAuditJson({
            count: existingAccounts.length,
            accounts: existingAccounts.map((account) =>
              this.toGiftCardQueryAccountAuditValue(account)
            )
          })
        : undefined,
      afterData: this.toAuditJson({
        count: accounts.length,
        accounts: accounts.map((account) => this.toGiftCardQueryAccountAuditValue(account))
      }),
      remark: `Saved ${accounts.length} Apple gift card query accounts`
    });

    return this.toGiftCardQueryAccountsResponse(parameter);
  }

  async createGiftCardBalanceCheck(
    dto: CreateGiftCardBalanceCheckDto,
    operator?: AuthenticatedUser
  ): Promise<GiftCardBalanceCheckRunResponse> {
    const attachmentIds = this.normalizeGiftCardBalanceCheckAttachmentIds(dto?.attachmentIds);
    const accountsParameter = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY }
    });
    const readyAccounts = this.readStoredGiftCardQueryAccounts(accountsParameter?.value).filter(
      (account) => account.status === 'ready'
    );

    if (!readyAccounts.length) {
      throw new BadRequestException('Gift card query accounts are not configured');
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { id: { in: attachmentIds } },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        storageKey: true
      }
    });
    const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
    const missingId = attachmentIds.find((id) => !attachmentsById.has(id));
    if (missingId) {
      throw new BadRequestException(`Attachment not found: ${missingId}`);
    }

    const invalidAttachment = attachments.find(
      (attachment) => !attachment.mimeType.startsWith('image/')
    );
    if (invalidAttachment) {
      throw new BadRequestException(
        `Attachment is not an image: ${invalidAttachment.originalName}`
      );
    }

    const createdAt = new Date().toISOString();
    const rows = await Promise.all(
      attachmentIds.map(async (attachmentId, index) => {
        const attachment = attachmentsById.get(attachmentId)!;
        const account = readyAccounts[index % readyAccounts.length];
        const detection = await this.detectGiftCardCodeFromAttachment(attachment);
        const codeFields = this.toGiftCardCodeFields(detection.code);
        const hasCandidateCode = Boolean(codeFields.giftCardCodeEncrypted);
        return {
          id: randomUUID(),
          attachmentId: attachment.id,
          fileName: this.maskGiftCardCodeInText(attachment.originalName),
          ...codeFields,
          assignedAccountId: account.id,
          assignedAppleIdMasked: account.appleIdMasked,
          status: hasCandidateCode ? 'waiting_worker' : 'pending_ocr',
          balance: '-',
          currency: '-',
          message: hasCandidateCode
            ? `${detection.message}，等待执行礼品卡余额查询`
            : detection.message
        } satisfies GiftCardBalanceCheckRowStored;
      })
    );
    const run = {
      id: randomUUID(),
      status: rows.some((row) => row.status === 'pending_ocr')
        ? 'manual_required'
        : 'waiting_worker',
      accountCount: readyAccounts.length,
      imageCount: rows.length,
      rows,
      createdAt,
      createdByUserId: operator?.id ?? null
    } satisfies GiftCardBalanceCheckRunStored;

    const existingRunsParameter = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY }
    });
    const existingRuns = this.readStoredGiftCardBalanceCheckRuns(existingRunsParameter?.value);
    const nextRuns = [run, ...existingRuns].slice(0, GIFT_CARD_BALANCE_CHECK_RUN_HISTORY_LIMIT);
    const parameter = await this.saveGiftCardBalanceCheckRuns(nextRuns, operator);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.gift_card_balance_check.create',
      objectType: 'system_parameter',
      objectId: parameter.id,
      afterData: this.toAuditJson({
        id: run.id,
        status: run.status,
        accountCount: run.accountCount,
        imageCount: run.imageCount,
        attachmentIds,
        createdAt: run.createdAt
      }),
      remark: `Created Apple gift card balance check run ${run.id}`
    });

    if (!run.rows.some((row) => row.status === 'pending_ocr')) {
      return this.executeGiftCardBalanceCheckRun(run.id, operator, nextRuns);
    }

    return this.toGiftCardBalanceCheckRunResponse(run);
  }

  async updateGiftCardBalanceCheckRow(
    runId: string,
    rowId: string,
    dto: UpdateGiftCardBalanceCheckRowDto,
    operator?: AuthenticatedUser
  ): Promise<GiftCardBalanceCheckRunResponse> {
    const normalizedRunId = this.normalizeRequiredUuid(runId, 'runId');
    const normalizedRowId = this.normalizeRequiredUuid(rowId, 'rowId');
    const code = this.findGiftCardCodeCandidate(dto?.extractedCode);

    if (!code) {
      throw new BadRequestException('extractedCode is required');
    }

    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY }
    });
    const runs = this.readStoredGiftCardBalanceCheckRuns(parameter?.value);
    const runIndex = runs.findIndex((run) => run.id === normalizedRunId);
    if (runIndex < 0) {
      throw new NotFoundException('Gift card balance check run not found');
    }

    const run = runs[runIndex];
    const rowIndex = run.rows.findIndex((row) => row.id === normalizedRowId);
    if (rowIndex < 0) {
      throw new NotFoundException('Gift card balance check row not found');
    }

    const codeFields = this.toGiftCardCodeFields(code);
    const updatedRow = {
      ...run.rows[rowIndex],
      ...codeFields,
      status: 'waiting_worker',
      message: '已人工补录礼品卡代码，等待执行礼品卡余额查询'
    } satisfies GiftCardBalanceCheckRowStored;
    const updatedRows = run.rows.map((row, index) => (index === rowIndex ? updatedRow : row));
    const updatedRunStatus: GiftCardBalanceCheckRunStored['status'] = updatedRows.some(
      (row) => row.status === 'pending_ocr'
    )
      ? 'manual_required'
      : updatedRows.every((row) => row.status === 'success')
        ? 'completed'
        : 'waiting_worker';
    const updatedRun = {
      ...run,
      rows: updatedRows,
      status: updatedRunStatus
    } satisfies GiftCardBalanceCheckRunStored;

    const nextRuns = runs.map((item, index) => (index === runIndex ? updatedRun : item));
    await this.saveGiftCardBalanceCheckRuns(nextRuns, operator);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.gift_card_balance_check.row.update_code',
      objectType: 'system_parameter',
      objectId: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY,
      beforeData: {
        runId: normalizedRunId,
        rowId: normalizedRowId,
        previousStatus: run.rows[rowIndex].status,
        previousCodeTail: run.rows[rowIndex].giftCardCodeTail
      },
      afterData: {
        runId: normalizedRunId,
        rowId: normalizedRowId,
        status: updatedRow.status,
        giftCardCodeTail: updatedRow.giftCardCodeTail
      }
    });

    if (!updatedRun.rows.some((row) => row.status === 'pending_ocr')) {
      return this.executeGiftCardBalanceCheckRun(updatedRun.id, operator, nextRuns);
    }

    return this.toGiftCardBalanceCheckRunResponse(updatedRun);
  }

  async runGiftCardBalanceCheck(
    runId: string,
    operator?: AuthenticatedUser
  ): Promise<GiftCardBalanceCheckRunResponse> {
    const normalizedRunId = this.normalizeRequiredUuid(runId, 'runId');
    return this.executeGiftCardBalanceCheckRun(normalizedRunId, operator);
  }

  private async executeGiftCardBalanceCheckRun(
    runId: string,
    operator?: AuthenticatedUser,
    initialRuns?: GiftCardBalanceCheckRunStored[]
  ): Promise<GiftCardBalanceCheckRunResponse> {
    const runs =
      initialRuns ??
      this.readStoredGiftCardBalanceCheckRuns(
        (
          await this.prisma.systemParameter.findUnique({
            where: { key: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY }
          })
        )?.value
      );
    const runIndex = runs.findIndex((run) => run.id === runId);
    if (runIndex < 0) {
      throw new NotFoundException('Gift card balance check run not found');
    }

    const run = runs[runIndex];
    if (run.rows.some((row) => row.status === 'pending_ocr')) {
      throw new BadRequestException('Gift card code must be recognized or manually entered first');
    }

    const { rows: preparedRows, payload } = await this.prepareGiftCardBalanceQueryPayload(run);
    const commandConfig = this.getGiftCardBalanceQueryCommandConfig();
    let nextRows: GiftCardBalanceCheckRowStored[] = preparedRows;
    let auditAction = 'apple_automation_task.gift_card_balance_check.run';

    if (!commandConfig) {
      auditAction = 'apple_automation_task.gift_card_balance_check.run_skipped';
      nextRows = preparedRows.map((row) =>
        row.status === 'waiting_worker'
          ? {
              ...row,
              status: 'manual_required',
              message: '礼品卡余额查询执行器未配置；已识别卡码和查询账号，请配置执行器后在本页重试'
            }
          : row
      );
    } else if (payload.rows.length) {
      try {
        const resultRows = await this.runGiftCardBalanceQueryCommand(commandConfig, payload);
        const resultRowsById = new Map(resultRows.map((row) => [row.rowId, row]));
        const sensitiveValues = this.getGiftCardBalanceQuerySensitiveValues(payload);
        nextRows = preparedRows.map((row) => {
          if (row.status !== 'waiting_worker') return row;
          const resultRow = resultRowsById.get(row.id);
          if (!resultRow) {
            return {
              ...row,
              status: 'failed',
              balance: '-',
              currency: '-',
              message: '礼品卡余额查询执行器未返回该图片结果'
            } satisfies GiftCardBalanceCheckRowStored;
          }

          return {
            ...row,
            status: resultRow.status,
            balance: resultRow.balance,
            currency: resultRow.currency,
            message: this.sanitizeGiftCardBalanceQueryMessage(resultRow.message, sensitiveValues)
          } satisfies GiftCardBalanceCheckRowStored;
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'timeout'
            ? '礼品卡余额查询执行器超时'
            : '礼品卡余额查询执行器运行失败';
        nextRows = preparedRows.map((row) =>
          row.status === 'waiting_worker'
            ? {
                ...row,
                status: 'failed',
                balance: '-',
                currency: '-',
                message
              }
            : row
        );
      }
    }

    const updatedRun = {
      ...run,
      rows: nextRows,
      status: this.resolveGiftCardBalanceCheckRunStatus(nextRows)
    } satisfies GiftCardBalanceCheckRunStored;
    const nextRuns = runs.map((item, index) => (index === runIndex ? updatedRun : item));
    await this.saveGiftCardBalanceCheckRuns(nextRuns, operator);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: auditAction,
      objectType: 'system_parameter',
      objectId: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY,
      afterData: this.toAuditJson({
        runId,
        status: updatedRun.status,
        imageCount: updatedRun.imageCount,
        readyRows: payload.rows.length,
        successRows: nextRows.filter((row) => row.status === 'success').length,
        failedRows: nextRows.filter((row) => row.status === 'failed').length,
        manualRows: nextRows.filter((row) => row.status === 'manual_required').length
      })
    });

    return this.toGiftCardBalanceCheckRunResponse(updatedRun);
  }

  async bulkDelete(dto: BulkDeleteAutomationTasksDto, operator?: AuthenticatedUser) {
    const ids = this.normalizeTaskIds(dto.ids);
    const tasks = await this.prisma.automationTask.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        batchId: true,
        taskType: true,
        status: true,
        appleAccountId: true,
        createdAt: true
      }
    });

    if (tasks.length !== ids.length) {
      const foundIds = new Set(tasks.map((task) => task.id));
      const missingId = ids.find((id) => !foundIds.has(id));
      throw new NotFoundException(`Automation task not found: ${missingId}`);
    }

    const batchIds = Array.from(
      new Set(tasks.map((task) => task.batchId).filter((id): id is string => Boolean(id)))
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.appleOfficialPriceSnapshot.updateMany({
        where: { automationTaskId: { in: ids } },
        data: { automationTaskId: null }
      });
      await tx.applePriceChangeReview.updateMany({
        where: { automationTaskId: { in: ids } },
        data: { automationTaskId: null }
      });
      await tx.automationTask.deleteMany({
        where: { id: { in: ids } }
      });
    });

    for (const batchId of batchIds) {
      await this.refreshBatchStats(batchId);
    }

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.bulk_delete',
      objectType: 'automation_task',
      objectId: ids[0],
      beforeData: this.toAuditJson({
        ids,
        tasks: tasks.map((task) => ({
          id: task.id,
          taskType: task.taskType,
          status: task.status,
          appleAccountId: task.appleAccountId,
          createdAt: task.createdAt.toISOString()
        }))
      }),
      remark: `Bulk deleted ${ids.length} Apple automation tasks`
    });

    this.invalidateWorkbenchStatusCache();
    return { deleted: true, count: ids.length, ids };
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

    this.invalidateWorkbenchStatusCache();
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

    this.invalidateWorkbenchStatusCache();
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

    this.invalidateWorkbenchStatusCache();
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
    const now = Date.now();
    if (this.workbenchStatusCache && this.workbenchStatusCache.expiresAt > now) {
      return this.workbenchStatusCache.data;
    }

    const data = await this.buildWorkbenchStatus();
    this.workbenchStatusCache = {
      data,
      expiresAt: now + WORKBENCH_STATUS_CACHE_TTL_MS
    };
    return data;
  }

  private async buildWorkbenchStatus(): Promise<WorkbenchStatusResponse> {
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

  private invalidateWorkbenchStatusCache() {
    this.workbenchStatusCache = null;
  }

  async runManualReview(id: string, operator?: AuthenticatedUser) {
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
    this.invalidateWorkbenchStatusCache();

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'info',
        message: '系统执行开始处理任务',
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
      this.invalidateWorkbenchStatusCache();
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
      action: 'apple_automation_task.run_manual_review',
      objectType: 'automation_task',
      objectId: task.id,
      afterData: this.toAuditJson({
        id: task.id,
        taskType: task.taskType,
        status: updated.status,
        manualRequired: updated.manualRequired
      }),
      remark: `Handled automation task ${task.id}`
    });

    await this.refreshBatchStats(task.batchId);
    this.invalidateWorkbenchStatusCache();
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
    this.invalidateWorkbenchStatusCache();
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
    this.invalidateWorkbenchStatusCache();
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
    this.invalidateWorkbenchStatusCache();
    return this.toResponse(updated);
  }

  async submitManualInput(id: string, dto: SubmitManualInputDto, operator?: AuthenticatedUser) {
    const task = await this.findTaskOrThrow(id, false);
    const value = this.normalizeRequiredString(dto.value, 'value');
    const inputType = this.parseManualInputType(dto.inputType);
    const note = this.normalizeNullableString(dto.note);
    const submittedAt = new Date();
    const currentPayload = this.decryptTaskInputPayload(task.inputPayloadEncrypted) ?? {};
    const queueJobId = this.createQueueJobId(task.taskType);
    const inputPayloadEncrypted = this.encryptPayload({
      ...currentPayload,
      manualInput: {
        inputType,
        value,
        note,
        submittedAt: submittedAt.toISOString(),
        submittedByUserId: operator?.id ?? null
      }
    });

    const updated = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: 'queued',
        queueJobId,
        retryCount: { increment: 1 },
        inputPayloadEncrypted,
        manualRequired: false,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null
      },
      include: this.getInclude(true)
    });

    const sanitizedPayload = {
      inputType,
      valueLength: value.length,
      note,
      queueJobId,
      submittedAt: submittedAt.toISOString(),
      operatorId: operator?.id ?? null
    };

    await this.prisma.automationTaskLog.create({
      data: {
        taskId: task.id,
        level: 'info',
        message: '已提交人工输入，任务重新进入队列',
        payload: this.toAuditJson(sanitizedPayload)
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_automation_task',
      action: 'apple_automation_task.manual_input.submit',
      objectType: 'automation_task',
      objectId: task.id,
      afterData: this.toAuditJson(sanitizedPayload),
      remark: `Submitted manual input for automation task ${task.id}`
    });

    await this.refreshBatchStats(task.batchId);
    this.invalidateWorkbenchStatusCache();
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
    this.invalidateWorkbenchStatusCache();
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
    this.invalidateWorkbenchStatusCache();
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
        message: '余额查询已按系统当前余额快照完成',
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
          remark: '自动化状态检测使用系统当前状态快照',
          operatorId: operator?.id
        }
      });

      return {
        status: 'success' as const,
        manualRequired: false,
        errorCode: null,
        errorMessage: null,
        message: '状态检测已按系统当前状态快照完成',
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
      errorMessage: '该任务类型当前需要人工验证',
      message: '该任务类型当前已转人工验证',
      payload: this.toAuditJson({
        source: 'manual_verification',
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

  private normalizeTaskIds(value: unknown) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('ids must be an array');
    }

    const ids = Array.from(
      new Set(value.map((id) => this.normalizeRequiredUuid(id, 'ids')).filter(Boolean))
    );

    if (!ids.length) {
      throw new BadRequestException('ids is required');
    }

    if (ids.length > 200) {
      throw new BadRequestException('Cannot delete more than 200 automation tasks at once');
    }

    return ids;
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

  private normalizeGiftCardBalanceCheckAttachmentIds(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('attachmentIds is required');
    }

    if (value.length > GIFT_CARD_BALANCE_CHECK_ATTACHMENT_LIMIT) {
      throw new BadRequestException(
        `attachmentIds cannot exceed ${GIFT_CARD_BALANCE_CHECK_ATTACHMENT_LIMIT} items`
      );
    }

    return Array.from(
      new Set(
        value.map((item, index) => this.normalizeRequiredUuid(item, `attachmentIds[${index}]`))
      )
    );
  }

  private normalizeGiftCardQueryAccountInputs(value: unknown) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('accounts is required');
    }

    if (value.length > GIFT_CARD_QUERY_ACCOUNT_LIMIT) {
      throw new BadRequestException(
        `accounts cannot exceed ${GIFT_CARD_QUERY_ACCOUNT_LIMIT} items`
      );
    }

    const seenAppleIds = new Set<string>();
    return value.map((item, index) => {
      const data = this.toObject(item);
      const appleId = this.normalizeRequiredString(data?.appleId, `accounts[${index}].appleId`);
      const password = this.normalizeRequiredString(data?.password, `accounts[${index}].password`);
      const appleIdKey = appleId.toLowerCase();

      if (seenAppleIds.has(appleIdKey)) {
        throw new BadRequestException(`accounts[${index}].appleId is duplicated`);
      }
      seenAppleIds.add(appleIdKey);

      return {
        appleId,
        password,
        status: this.parseGiftCardQueryAccountStatus(data?.status),
        remark: this.normalizeGiftCardQueryAccountRemark(data?.remark, index)
      };
    });
  }

  private normalizeGiftCardQueryAccountRemark(value: unknown, index: number) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`accounts[${index}].remark must be a string`);
    }

    return this.normalizeNullableString(value);
  }

  private parseGiftCardQueryAccountStatus(value: unknown): GiftCardQueryAccountStatus {
    if (value === undefined || value === null || value === '') {
      return 'ready';
    }
    if (value === 'ready' || value === 'disabled') {
      return value;
    }

    throw new BadRequestException('accounts.status is invalid');
  }

  private parseManualInputType(value: unknown): AutomationTaskManualInputType {
    if (value === undefined || value === null || value === '') {
      return 'verification_code';
    }
    if (
      value === 'verification_code' ||
      value === 'captcha' ||
      value === 'device_confirmation' ||
      value === 'note'
    ) {
      return value;
    }

    throw new BadRequestException('inputType is invalid');
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

  private toGiftCardQueryAccountsResponse(
    parameter:
      | {
          value: Prisma.JsonValue;
          updatedAt: Date;
        }
      | null
      | undefined
  ): GiftCardQueryAccountsResponse {
    const accounts = this.readStoredGiftCardQueryAccounts(parameter?.value);
    return {
      items: accounts.map((account) => ({
        id: account.id,
        appleIdMasked: account.appleIdMasked,
        passwordSaved: Boolean(account.passwordEncrypted),
        status: account.status,
        remark: account.remark,
        updatedAt: account.updatedAt
      })),
      maxAccounts: GIFT_CARD_QUERY_ACCOUNT_LIMIT,
      updatedAt: parameter?.updatedAt.toISOString() ?? null
    };
  }

  private toGiftCardBalanceCheckRunResponse(
    run: GiftCardBalanceCheckRunStored
  ): GiftCardBalanceCheckRunResponse {
    return {
      id: run.id,
      status: run.status,
      accountCount: run.accountCount,
      imageCount: run.imageCount,
      createdAt: run.createdAt,
      rows: run.rows.map((row) => ({
        id: row.id,
        attachmentId: row.attachmentId,
        fileName: row.fileName,
        extractedCode: row.extractedCode,
        assignedAppleId: row.assignedAppleIdMasked,
        status: row.status,
        balance: row.balance,
        currency: row.currency,
        message: row.message
      }))
    };
  }

  private async saveGiftCardBalanceCheckRuns(
    runs: GiftCardBalanceCheckRunStored[],
    operator?: AuthenticatedUser
  ) {
    return this.prisma.systemParameter.upsert({
      where: { key: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY },
      update: {
        value: this.toAuditJson({ version: 1, runs }),
        group: GIFT_CARD_QUERY_ACCOUNTS_GROUP,
        remark: 'Apple 礼品卡余额查询批次记录',
        updatedByUserId: operator?.id
      },
      create: {
        key: GIFT_CARD_BALANCE_CHECK_RUNS_PARAMETER_KEY,
        value: this.toAuditJson({ version: 1, runs }),
        group: GIFT_CARD_QUERY_ACCOUNTS_GROUP,
        remark: 'Apple 礼品卡余额查询批次记录',
        updatedByUserId: operator?.id
      }
    });
  }

  private async prepareGiftCardBalanceQueryPayload(run: GiftCardBalanceCheckRunStored) {
    const accountsParameter = await this.prisma.systemParameter.findUnique({
      where: { key: GIFT_CARD_QUERY_ACCOUNTS_PARAMETER_KEY }
    });
    const accountsById = new Map(
      this.readStoredGiftCardQueryAccounts(accountsParameter?.value)
        .filter((account) => account.status === 'ready')
        .map((account) => [account.id, account])
    );
    const queryAccounts: GiftCardBalanceQueryAccountPayload[] = [];
    const queryRows: GiftCardBalanceQueryRowPayload[] = [];
    const queryAccountsById = new Map<string, GiftCardBalanceQueryAccountPayload>();

    const rows: GiftCardBalanceCheckRowStored[] = run.rows.map((row) => {
      if (!row.giftCardCodeEncrypted) {
        return {
          ...row,
          status: 'manual_required',
          message: '该图片缺少礼品卡代码，请先补录'
        } satisfies GiftCardBalanceCheckRowStored;
      }

      const giftCardCode = this.fieldEncryptionService.decrypt(row.giftCardCodeEncrypted);
      if (!giftCardCode) {
        return {
          ...row,
          status: 'manual_required',
          message: '礼品卡代码解密失败，请重新补录'
        } satisfies GiftCardBalanceCheckRowStored;
      }

      const account = row.assignedAccountId ? accountsById.get(row.assignedAccountId) : null;
      if (!account?.appleIdEncrypted || !account.passwordEncrypted) {
        return {
          ...row,
          status: 'manual_required',
          message: '该行没有可用的礼品卡查询账号，请先保存查询账号池'
        } satisfies GiftCardBalanceCheckRowStored;
      }

      const appleId = this.fieldEncryptionService.decrypt(account.appleIdEncrypted);
      const password = this.fieldEncryptionService.decrypt(account.passwordEncrypted);
      if (!appleId || !password) {
        return {
          ...row,
          status: 'manual_required',
          message: '礼品卡查询账号解密失败，请重新保存账号池'
        } satisfies GiftCardBalanceCheckRowStored;
      }

      if (!queryAccountsById.has(account.id)) {
        const queryAccount = {
          id: account.id,
          appleId,
          password
        } satisfies GiftCardBalanceQueryAccountPayload;
        queryAccountsById.set(account.id, queryAccount);
        queryAccounts.push(queryAccount);
      }

      queryRows.push({
        id: row.id,
        giftCardCode,
        giftCardCodeTail: row.giftCardCodeTail,
        assignedAccountId: account.id,
        assignedAppleId: appleId,
        fileName: row.fileName
      });

      return {
        ...row,
        status: 'waiting_worker',
        message: '正在执行礼品卡余额查询'
      } satisfies GiftCardBalanceCheckRowStored;
    });

    return {
      rows,
      payload: {
        runId: run.id,
        createdAt: run.createdAt,
        accounts: queryAccounts,
        rows: queryRows
      } satisfies GiftCardBalanceQueryCommandPayload
    };
  }

  private getGiftCardBalanceQueryCommandConfig() {
    const command = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND?.trim();
    if (!command) return null;

    return {
      command,
      args: this.parseGiftCardBalanceQueryCommandArgs(),
      timeoutMs: this.getNumberFromEnv(
        'APPLE_GIFT_CARD_BALANCE_QUERY_TIMEOUT_MS',
        GIFT_CARD_BALANCE_QUERY_DEFAULT_TIMEOUT_MS
      )
    };
  }

  private parseGiftCardBalanceQueryCommandArgs() {
    const raw = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_ARGS?.trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      throw new Error('APPLE_GIFT_CARD_BALANCE_QUERY_ARGS must be a JSON string array');
    }

    return parsed;
  }

  private async runGiftCardBalanceQueryCommand(
    config: {
      command: string;
      args: string[];
      timeoutMs: number;
    },
    payload: GiftCardBalanceQueryCommandPayload
  ): Promise<GiftCardBalanceQueryCommandResultRow[]> {
    return new Promise((resolve, reject) => {
      const child = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });
      let settled = false;
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('timeout'));
      }, config.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (code !== 0) {
          reject(new Error(`exit:${code ?? 'unknown'}:${stderr.length}`));
          return;
        }

        try {
          resolve(this.readGiftCardBalanceQueryCommandResult(stdout));
        } catch (error) {
          reject(error);
        }
      });

      child.stdin.end(JSON.stringify(payload));
    });
  }

  private readGiftCardBalanceQueryCommandResult(
    value: string
  ): GiftCardBalanceQueryCommandResultRow[] {
    const data = this.toObject(JSON.parse(value));
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return rows
      .map((item) => {
        const row = this.toObject(item);
        if (!row) return null;
        const rowId = this.getObjectString(row, 'rowId') ?? this.getObjectString(row, 'id');
        const status = this.readGiftCardBalanceQueryResultStatus(row.status);
        if (!rowId || !status) return null;
        return {
          rowId,
          status,
          balance: this.getObjectString(row, 'balance') ?? '-',
          currency: (this.getObjectString(row, 'currency') ?? '-').toUpperCase(),
          message:
            this.getObjectString(row, 'message') ??
            this.getGiftCardBalanceQueryDefaultMessage(status)
        } satisfies GiftCardBalanceQueryCommandResultRow;
      })
      .filter((row): row is GiftCardBalanceQueryCommandResultRow => Boolean(row));
  }

  private readGiftCardBalanceQueryResultStatus(
    value: unknown
  ): GiftCardBalanceQueryCommandResultRow['status'] | null {
    if (value === 'manual_required' || value === 'success' || value === 'failed') return value;
    return null;
  }

  private getGiftCardBalanceQueryDefaultMessage(
    status: GiftCardBalanceQueryCommandResultRow['status']
  ) {
    if (status === 'success') return '礼品卡余额查询成功';
    if (status === 'manual_required') return '礼品卡余额查询需要人工验证';
    return '礼品卡余额查询失败';
  }

  private getGiftCardBalanceQuerySensitiveValues(payload: GiftCardBalanceQueryCommandPayload) {
    return [
      ...payload.rows.map((row) => row.giftCardCode),
      ...payload.accounts.map((account) => account.appleId),
      ...payload.accounts.map((account) => account.password)
    ].filter(Boolean);
  }

  private sanitizeGiftCardBalanceQueryMessage(value: string, sensitiveValues: string[]) {
    let message = value.trim().slice(0, 300);
    for (const sensitiveValue of sensitiveValues) {
      if (!sensitiveValue) continue;
      message = message.split(sensitiveValue).join('[已脱敏]');
    }

    return message || '礼品卡余额查询完成';
  }

  private resolveGiftCardBalanceCheckRunStatus(
    rows: GiftCardBalanceCheckRowStored[]
  ): GiftCardBalanceCheckRunStored['status'] {
    if (
      rows.some(
        (row) =>
          row.status === 'pending_ocr' ||
          row.status === 'manual_required' ||
          row.status === 'waiting_worker'
      )
    ) {
      return 'manual_required';
    }

    return 'completed';
  }

  private readStoredGiftCardBalanceCheckRuns(value: unknown): GiftCardBalanceCheckRunStored[] {
    const data = this.toObject(value);
    const runs = Array.isArray(data?.runs) ? data.runs : [];

    return runs
      .map((item) => {
        const run = this.toObject(item);
        if (!run) return null;
        const rows = Array.isArray(run.rows) ? run.rows : [];
        return {
          id: this.getObjectString(run, 'id') ?? randomUUID(),
          status: this.readStoredGiftCardBalanceCheckRunStatus(run.status),
          accountCount: this.getNumberOrNull(run.accountCount) ?? 0,
          imageCount: this.getNumberOrNull(run.imageCount) ?? rows.length,
          rows: rows
            .map((row) => this.readStoredGiftCardBalanceCheckRow(row))
            .filter((row): row is GiftCardBalanceCheckRowStored => Boolean(row)),
          createdAt: this.getObjectString(run, 'createdAt') ?? new Date(0).toISOString(),
          createdByUserId: this.getObjectString(run, 'createdByUserId')
        } satisfies GiftCardBalanceCheckRunStored;
      })
      .filter((run): run is GiftCardBalanceCheckRunStored => Boolean(run));
  }

  private readStoredGiftCardBalanceCheckRow(value: unknown): GiftCardBalanceCheckRowStored | null {
    const row = this.toObject(value);
    if (!row) return null;

    return {
      id: this.getObjectString(row, 'id') ?? randomUUID(),
      attachmentId: this.getObjectString(row, 'attachmentId') ?? '',
      fileName: this.getObjectString(row, 'fileName') ?? 'gift-card-image',
      extractedCode: this.getObjectString(row, 'extractedCode') ?? '待识别',
      giftCardCodeEncrypted: this.getObjectString(row, 'giftCardCodeEncrypted'),
      giftCardCodeHash: this.getObjectString(row, 'giftCardCodeHash'),
      giftCardCodeTail: this.getObjectString(row, 'giftCardCodeTail'),
      assignedAccountId: this.getObjectString(row, 'assignedAccountId'),
      assignedAppleIdMasked: this.getObjectString(row, 'assignedAppleIdMasked') ?? '未分配',
      status: this.readStoredGiftCardBalanceCheckRowStatus(row.status),
      balance: this.getObjectString(row, 'balance') ?? '-',
      currency: this.getObjectString(row, 'currency') ?? '-',
      message: this.getObjectString(row, 'message') ?? '等待处理'
    };
  }

  private readStoredGiftCardBalanceCheckRunStatus(
    value: unknown
  ): GiftCardBalanceCheckRunStored['status'] {
    if (value === 'completed' || value === 'manual_required' || value === 'waiting_worker') {
      return value;
    }

    return 'manual_required';
  }

  private readStoredGiftCardBalanceCheckRowStatus(value: unknown): GiftCardBalanceCheckRowStatus {
    if (
      value === 'pending_ocr' ||
      value === 'waiting_worker' ||
      value === 'manual_required' ||
      value === 'success' ||
      value === 'failed'
    ) {
      return value;
    }

    return 'manual_required';
  }

  private readStoredGiftCardQueryAccounts(value: unknown): GiftCardQueryAccountStored[] {
    const data = this.toObject(value);
    const accounts = Array.isArray(data?.accounts) ? data.accounts : [];

    return accounts
      .map((item) => {
        const account = this.toObject(item);
        if (!account) return null;
        const id = this.getObjectString(account, 'id') ?? randomUUID();
        const updatedAt = this.getObjectString(account, 'updatedAt') ?? new Date(0).toISOString();
        return {
          id,
          appleIdEncrypted: this.getObjectString(account, 'appleIdEncrypted'),
          appleIdHash: this.getObjectString(account, 'appleIdHash'),
          appleIdMasked: this.getObjectString(account, 'appleIdMasked') ?? '已保存账号',
          passwordEncrypted: this.getObjectString(account, 'passwordEncrypted'),
          status: this.readStoredGiftCardQueryAccountStatus(account.status),
          remark: this.getObjectString(account, 'remark'),
          createdAt: this.getObjectString(account, 'createdAt') ?? updatedAt,
          updatedAt
        } satisfies GiftCardQueryAccountStored;
      })
      .filter((account): account is GiftCardQueryAccountStored => Boolean(account));
  }

  private readStoredGiftCardQueryAccountStatus(value: unknown): GiftCardQueryAccountStatus {
    return value === 'disabled' ? 'disabled' : 'ready';
  }

  private toGiftCardQueryAccountAuditValue(account: GiftCardQueryAccountStored) {
    return {
      id: account.id,
      appleIdHash: account.appleIdHash,
      appleIdMasked: account.appleIdMasked,
      passwordSaved: Boolean(account.passwordEncrypted),
      status: account.status,
      remark: account.remark,
      updatedAt: account.updatedAt
    };
  }

  private async detectGiftCardCodeFromAttachment(attachment: {
    originalName: string;
    storageKey: string;
  }) {
    const fileNameCode = this.findGiftCardCodeCandidate(attachment.originalName);
    if (fileNameCode) {
      return {
        code: fileNameCode,
        message: '已从文件名识别礼品卡候选码'
      };
    }

    const ocrResult = await this.readGiftCardOcrText(attachment.storageKey);
    const ocrCode = ocrResult.text ? this.findGiftCardCodeCandidate(ocrResult.text) : null;
    if (ocrCode) {
      return {
        code: ocrCode,
        message: 'OCR 已识别礼品卡候选码'
      };
    }

    return {
      code: null,
      message: this.getGiftCardOcrFallbackMessage(ocrResult.status)
    };
  }

  private async readGiftCardOcrText(storageKey: string): Promise<GiftCardOcrReadResult> {
    if (!this.isGiftCardOcrEnabled()) {
      return { status: 'disabled', text: null };
    }

    const uploadDirectory = resolve(process.cwd(), process.env.ATTACHMENT_STORAGE_DIR ?? 'uploads');
    const filePath = resolve(uploadDirectory, storageKey);
    if (!filePath.startsWith(`${uploadDirectory}${sep}`) || !existsSync(filePath)) {
      return { status: 'missing_file', text: null };
    }

    const executable = process.env.APPLE_GIFT_CARD_OCR_TESSERACT_PATH || 'tesseract';
    const language = process.env.APPLE_GIFT_CARD_OCR_LANG || 'eng';
    try {
      const { stdout } = await execFileAsync(executable, [filePath, 'stdout', '-l', language], {
        timeout: this.getGiftCardOcrTimeoutMs(),
        maxBuffer: 1024 * 1024
      });
      return { status: 'completed', text: stdout };
    } catch (error) {
      if (this.isCommandMissingError(error)) {
        return { status: 'unavailable', text: null };
      }
      if (this.isCommandTimeoutError(error)) {
        return { status: 'timeout', text: null };
      }
      return { status: 'failed', text: null };
    }
  }

  private getGiftCardOcrFallbackMessage(status: GiftCardOcrReadStatus) {
    const prefix = '图片已保存并分配查询账号，';
    if (status === 'disabled') {
      return `${prefix}OCR 未启用，请在结果表补录礼品卡代码`;
    }
    if (status === 'missing_file') {
      return `${prefix}OCR 找不到图片文件，请检查附件存储或在结果表补录礼品卡代码`;
    }
    if (status === 'unavailable') {
      return `${prefix}OCR 执行器不可用，请检查 APPLE_GIFT_CARD_OCR_TESSERACT_PATH 或在结果表补录`;
    }
    if (status === 'timeout') {
      return `${prefix}OCR 超时，请优化图片或在结果表补录礼品卡代码`;
    }
    if (status === 'failed') {
      return `${prefix}OCR 执行失败，请检查图片格式或在结果表补录礼品卡代码`;
    }
    return `${prefix}OCR 未识别到礼品卡代码，请在结果表补录`;
  }

  private isCommandMissingError(error: unknown) {
    return Boolean(
      error && typeof error === 'object' && (error as { code?: unknown }).code === 'ENOENT'
    );
  }

  private isCommandTimeoutError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { killed?: unknown; signal?: unknown };
    return candidate.killed === true || typeof candidate.signal === 'string';
  }

  private isGiftCardOcrEnabled() {
    return process.env.APPLE_GIFT_CARD_OCR_ENABLED !== 'false';
  }

  private getGiftCardOcrTimeoutMs() {
    const value = Number(process.env.APPLE_GIFT_CARD_OCR_TIMEOUT_MS);
    if (!Number.isFinite(value) || value < 1000 || value > 120_000) {
      return GIFT_CARD_OCR_DEFAULT_TIMEOUT_MS;
    }

    return Math.floor(value);
  }

  private findGiftCardCodeCandidate(value: string | null | undefined) {
    if (!value) return null;
    const upperValue = value.toUpperCase();
    const groupedMatches = upperValue.match(/[A-Z0-9][A-Z0-9\s_-]{8,}[A-Z0-9]/g) ?? [];
    for (const candidate of groupedMatches.length ? groupedMatches : [upperValue]) {
      const compact = candidate.replace(/[^A-Z0-9]/g, '');
      const matches = compact.match(/[A-Z0-9]{10,64}/g) ?? [];
      const match = matches.find((item) => /[A-Z]/.test(item) && /\d/.test(item));
      if (match) return match;
    }

    return null;
  }

  private toGiftCardCodeFields(code: string | null): GiftCardCodeFields {
    if (!code) {
      return {
        extractedCode: '待识别',
        giftCardCodeEncrypted: null,
        giftCardCodeHash: null,
        giftCardCodeTail: null
      };
    }

    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return {
      extractedCode: this.maskGiftCardCode(normalized),
      giftCardCodeEncrypted: this.fieldEncryptionService.encrypt(normalized),
      giftCardCodeHash: this.fieldEncryptionService.hash(normalized),
      giftCardCodeTail: normalized.slice(-4)
    };
  }

  private maskGiftCardCode(value: string) {
    if (value.length <= 4) return '*'.repeat(value.length);
    return `****${value.slice(-4)}`;
  }

  private maskGiftCardCodeInText(value: string) {
    return value.replace(/[A-Z0-9][A-Z0-9\s_-]{8,}[A-Z0-9]/gi, (candidate) => {
      const code = this.findGiftCardCodeCandidate(candidate);
      return code ? this.maskGiftCardCode(code) : candidate;
    });
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
      logs: task.logs?.map((log) => this.toLogResponse(log)) ?? []
    };
  }
}
