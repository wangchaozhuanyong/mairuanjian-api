import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AppleAccount, AppleAccountStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAppleAccountDto } from './dto/create-apple-account.dto';
import type {
  ImportAppleAccountItemDto,
  ImportAppleAccountsDto
} from './dto/import-apple-accounts.dto';
import type {
  AppleAccountSecretField,
  RevealAppleAccountSecretDto
} from './dto/reveal-apple-account-secret.dto';
import type { UpdateAppleAccountDto } from './dto/update-apple-account.dto';

interface ListAppleAccountsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  currency?: string;
  region?: string;
  locked?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface AuditRequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

interface SecretFieldConfig {
  field: AppleAccountSecretField;
  permission: string;
  label: string;
}

interface ParsedAppleAccountImportItem {
  rowNo: number;
  data: ImportAppleAccountItemDto;
}

interface AppleAccountImportPlanItem {
  rowNo: number;
  appleId: string;
  appleIdNormalized: string;
  region: string;
  currency: string;
  currentBalance: string;
  balanceCostAmount: string;
  averageCost: string;
  status: AppleAccountStatus;
  isManuallyLocked: boolean;
  manualLockReason: string | null;
  passwordEncrypted: string | null;
  securityInfoEncrypted: string | null;
  phoneEncrypted: string | null;
  recoveryEmailEncrypted: string | null;
  remark: string | null;
}

export interface AppleAccountImportError {
  rowNo: number;
  appleId?: string | null;
  reason: string;
}

const APPLE_ACCOUNT_SORT_FIELDS: Record<string, keyof Prisma.AppleAccountOrderByWithRelationInput> =
  {
    appleId: 'appleIdNormalized',
    region: 'region',
    currency: 'currency',
    currentBalance: 'currentBalance',
    balanceCostAmount: 'balanceCostAmount',
    averageCost: 'averageCost',
    status: 'status',
    isManuallyLocked: 'isManuallyLocked',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

const SECRET_FIELD_CONFIGS: Record<AppleAccountSecretField, SecretFieldConfig> = {
  appleId: {
    field: 'appleId',
    permission: 'apple.account.view_full',
    label: 'Apple ID账号'
  },
  password: {
    field: 'password',
    permission: 'apple.secret.view_password',
    label: '密码'
  },
  securityInfo: {
    field: 'securityInfo',
    permission: 'apple.secret.view_security',
    label: '密保'
  },
  phone: {
    field: 'phone',
    permission: 'apple.secret.view_phone',
    label: '手机号'
  },
  recoveryEmail: {
    field: 'recoveryEmail',
    permission: 'apple.secret.view_email',
    label: '备用邮箱'
  }
};

@Injectable()
export class AppleAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async list(query: ListAppleAccountsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim().toLowerCase();
    const status = this.parseStatus(query.status, false);
    const locked = this.parseBoolean(query.locked);
    const where: Prisma.AppleAccountWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      currency: query.currency ? query.currency.trim().toUpperCase() : undefined,
      region: query.region ? query.region.trim().toUpperCase() : undefined,
      isManuallyLocked: locked,
      OR: keyword
        ? [
            { appleIdNormalized: { contains: keyword, mode: 'insensitive' } },
            { region: { contains: keyword, mode: 'insensitive' } },
            { currency: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleAccount.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.getListOrderBy(query)
      }),
      this.prisma.appleAccount.count({ where })
    ]);

    return {
      items: items.map((account) => this.toResponse(account)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const account = await this.prisma.appleAccount.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!account) {
      throw new NotFoundException('Apple account not found');
    }

    return this.toResponse(account);
  }

  async create(dto: CreateAppleAccountDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.appleId, 'appleId');
    const appleId = dto.appleId.trim();
    const appleIdNormalized = this.normalizeAppleId(appleId);
    await this.assertAppleIdAvailable(appleIdNormalized);

    const currentBalance = this.normalizeMoney(dto.currentBalance, 'currentBalance');
    const balanceCostAmount = this.normalizeMoney(dto.balanceCostAmount, 'balanceCostAmount');
    const averageCost = this.calculateAverageCost(currentBalance, balanceCostAmount);
    const isManuallyLocked = Boolean(dto.isManuallyLocked);

    const account = await this.prisma.appleAccount.create({
      data: {
        appleId,
        appleIdNormalized,
        region: this.normalizeCode(dto.region, 'US'),
        currency: this.normalizeCode(dto.currency, 'USD'),
        currentBalance,
        balanceCostAmount,
        averageCost,
        status: this.parseStatus(dto.status, true) ?? 'normal',
        isManuallyLocked,
        manualLockReason: this.normalizeNullableString(dto.manualLockReason),
        lockedAt: isManuallyLocked ? new Date() : null,
        lockedByUserId: isManuallyLocked ? operator?.id : null,
        passwordEncrypted: this.fieldEncryptionService.encrypt(dto.password),
        securityInfoEncrypted: this.fieldEncryptionService.encrypt(dto.securityInfo),
        phoneEncrypted: this.fieldEncryptionService.encrypt(dto.phone),
        recoveryEmailEncrypted: this.fieldEncryptionService.encrypt(dto.recoveryEmail),
        remark: this.normalizeNullableString(dto.remark),
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.create',
      objectType: 'apple_account',
      objectId: account.id,
      afterData: this.toAuditJson(this.redactSensitiveInput({ ...dto, appleId })),
      remark: `Created Apple ID ${this.maskAppleId(appleId)}`
    });

    return this.get(account.id);
  }

  async importAccounts(dto: ImportAppleAccountsDto, operator?: AuthenticatedUser) {
    const parsedItems = this.parseImportItems(dto.accounts);
    const candidateAppleIds = parsedItems
      .map((item) => this.safeNormalizeAppleId(item.data.appleId))
      .filter((value): value is string => Boolean(value));
    const existingAccounts = candidateAppleIds.length
      ? await this.prisma.appleAccount.findMany({
          where: {
            appleIdNormalized: {
              in: candidateAppleIds
            }
          },
          select: {
            appleIdNormalized: true
          }
        })
      : [];
    const existingAppleIdSet = new Set(
      existingAccounts.map((account) => account.appleIdNormalized)
    );
    const importPlan = this.buildImportPlan(parsedItems, existingAppleIdSet);
    const createdAccounts = await this.prisma.$transaction(async (tx) => {
      const created: AppleAccount[] = [];

      for (const item of importPlan.items) {
        created.push(
          await tx.appleAccount.create({
            data: {
              appleId: item.appleId,
              appleIdNormalized: item.appleIdNormalized,
              region: item.region,
              currency: item.currency,
              currentBalance: item.currentBalance,
              balanceCostAmount: item.balanceCostAmount,
              averageCost: item.averageCost,
              status: item.status,
              isManuallyLocked: item.isManuallyLocked,
              manualLockReason: item.manualLockReason,
              lockedAt: item.isManuallyLocked ? new Date() : null,
              lockedByUserId: item.isManuallyLocked ? operator?.id : null,
              passwordEncrypted: item.passwordEncrypted,
              securityInfoEncrypted: item.securityInfoEncrypted,
              phoneEncrypted: item.phoneEncrypted,
              recoveryEmailEncrypted: item.recoveryEmailEncrypted,
              remark: item.remark,
              createdByUserId: operator?.id,
              updatedByUserId: operator?.id
            }
          })
        );
      }

      return created;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.batch_import',
      objectType: 'apple_account',
      afterData: this.toAuditJson({
        totalCount: parsedItems.length,
        successCount: createdAccounts.length,
        failedCount: importPlan.errors.length,
        appleIdTails: createdAccounts.map((account) => account.appleId.slice(-6))
      }),
      remark: `Imported Apple ID accounts success=${createdAccounts.length} failed=${importPlan.errors.length}`
    });

    return {
      totalCount: parsedItems.length,
      successCount: createdAccounts.length,
      failedCount: importPlan.errors.length,
      accounts: createdAccounts.map((account, index) => ({
        rowNo: importPlan.items[index]?.rowNo,
        ...this.toResponse(account)
      })),
      errors: importPlan.errors
    };
  }

  async update(id: string, dto: UpdateAppleAccountDto, operator?: AuthenticatedUser) {
    const existingAccount = await this.prisma.appleAccount.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingAccount) {
      throw new NotFoundException('Apple account not found');
    }

    const data: Prisma.AppleAccountUpdateInput = {
      updatedBy: operator?.id
        ? {
            connect: {
              id: operator.id
            }
          }
        : undefined
    };

    if (dto.appleId !== undefined) {
      this.assertRequiredString(dto.appleId, 'appleId');
      const appleId = dto.appleId.trim();
      const appleIdNormalized = this.normalizeAppleId(appleId);
      await this.assertAppleIdAvailable(appleIdNormalized, id);
      data.appleId = appleId;
      data.appleIdNormalized = appleIdNormalized;
    }

    if (dto.region !== undefined) {
      data.region = this.normalizeCode(dto.region, 'US');
    }

    if (dto.currency !== undefined) {
      data.currency = this.normalizeCode(dto.currency, 'USD');
    }

    const currentBalance =
      dto.currentBalance === undefined
        ? existingAccount.currentBalance
        : this.normalizeMoney(dto.currentBalance, 'currentBalance');
    const balanceCostAmount =
      dto.balanceCostAmount === undefined
        ? existingAccount.balanceCostAmount
        : this.normalizeMoney(dto.balanceCostAmount, 'balanceCostAmount');

    if (dto.currentBalance !== undefined) {
      data.currentBalance = currentBalance;
    }

    if (dto.balanceCostAmount !== undefined) {
      data.balanceCostAmount = balanceCostAmount;
    }

    if (dto.currentBalance !== undefined || dto.balanceCostAmount !== undefined) {
      data.averageCost = this.calculateAverageCost(currentBalance, balanceCostAmount);
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.isManuallyLocked !== undefined) {
      data.isManuallyLocked = dto.isManuallyLocked;
      data.lockedAt = dto.isManuallyLocked ? (existingAccount.lockedAt ?? new Date()) : null;
      data.lockedBy =
        dto.isManuallyLocked && operator?.id
          ? { connect: { id: operator.id } }
          : { disconnect: true };
    }

    if (dto.manualLockReason !== undefined) {
      data.manualLockReason = this.normalizeNullableString(dto.manualLockReason);
    }

    if (dto.password !== undefined && dto.password !== '') {
      data.passwordEncrypted = this.fieldEncryptionService.encrypt(dto.password);
    }

    if (dto.securityInfo !== undefined && dto.securityInfo !== '') {
      data.securityInfoEncrypted = this.fieldEncryptionService.encrypt(dto.securityInfo);
    }

    if (dto.phone !== undefined && dto.phone !== '') {
      data.phoneEncrypted = this.fieldEncryptionService.encrypt(dto.phone);
    }

    if (dto.recoveryEmail !== undefined && dto.recoveryEmail !== '') {
      data.recoveryEmailEncrypted = this.fieldEncryptionService.encrypt(dto.recoveryEmail);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    await this.prisma.appleAccount.update({
      where: {
        id
      },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.update',
      objectType: 'apple_account',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingAccount)),
      afterData: this.toAuditJson(this.redactSensitiveInput({ ...dto })),
      remark: `Updated Apple ID ${this.maskAppleId(existingAccount.appleId)}`
    });

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingAccount = await this.prisma.appleAccount.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingAccount) {
      throw new NotFoundException('Apple account not found');
    }

    await this.prisma.appleAccount.update({
      where: {
        id
      },
      data: {
        deletedAt: new Date(),
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.delete',
      objectType: 'apple_account',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingAccount)),
      remark: `Deleted Apple ID ${this.maskAppleId(existingAccount.appleId)}`
    });

    return {
      deleted: true
    };
  }

  async revealSecret(
    id: string,
    dto: RevealAppleAccountSecretDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    const field = this.parseSecretField(dto.field);
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const config = SECRET_FIELD_CONFIGS[field];
    this.assertSecretPermission(config, operator);

    const account = await this.prisma.appleAccount.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!account) {
      throw new NotFoundException('Apple account not found');
    }

    const value = this.getSecretValue(account, field);

    if (!value) {
      throw new NotFoundException('Apple account secret not found');
    }

    await this.prisma.sensitiveAccessLog.create({
      data: {
        userId: operator?.id,
        module: 'apple_account',
        fieldName: field,
        objectType: 'apple_account',
        objectId: account.id,
        accessReason: reason,
        approved: true,
        ip: requestMeta?.ip ?? undefined,
        userAgent: requestMeta?.userAgent ?? undefined
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.secret.reveal',
      objectType: 'apple_account',
      objectId: account.id,
      afterData: this.toAuditJson({
        field,
        label: config.label,
        appleIdTail: account.appleId.slice(-6),
        reason
      }),
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
      remark: `Revealed Apple ID secret ${field} for ${this.maskAppleId(account.appleId)}`
    });

    return {
      accountId: account.id,
      field,
      label: config.label,
      value,
      revealedAt: new Date()
    };
  }

  calculateAverageCost(
    currentBalance: PrismaNamespace.Decimal.Value,
    balanceCostAmount: PrismaNamespace.Decimal.Value
  ) {
    const balance = new PrismaNamespace.Decimal(currentBalance);
    const cost = new PrismaNamespace.Decimal(balanceCostAmount);

    if (balance.lessThan(0) || cost.lessThan(0)) {
      throw new BadRequestException('Balance and cost amount must be non-negative');
    }

    if (balance.equals(0)) {
      if (cost.greaterThan(0)) {
        throw new BadRequestException('Balance cost amount must be zero when balance is zero');
      }

      return new PrismaNamespace.Decimal(0).toFixed(8);
    }

    return cost.div(balance).toDecimalPlaces(8).toFixed(8);
  }

  private async assertAppleIdAvailable(appleIdNormalized: string, currentId?: string) {
    const existingAccount = await this.prisma.appleAccount.findUnique({
      where: {
        appleIdNormalized
      },
      select: {
        id: true
      }
    });

    if (existingAccount && existingAccount.id !== currentId) {
      throw new ConflictException('Apple ID already exists');
    }
  }

  private parseImportItems(
    value: Array<string | ImportAppleAccountItemDto> | undefined
  ): ParsedAppleAccountImportItem[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('accounts must be an array');
    }

    if (value.length === 0) {
      throw new BadRequestException('accounts must not be empty');
    }

    if (value.length > 500) {
      throw new BadRequestException('accounts cannot exceed 500 rows per import');
    }

    return value
      .map((item, index) => ({
        rowNo: index + 1,
        data: typeof item === 'string' ? this.parseImportLine(item) : item
      }))
      .filter((item) => !this.isImportHeader(item));
  }

  private parseImportLine(line: string): ImportAppleAccountItemDto {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return {
        appleId: ''
      };
    }

    const values = this.splitImportLine(normalizedLine);
    return {
      appleId: values[0] ?? '',
      password: values[1] || null,
      region: values[2] || undefined,
      currency: values[3] || undefined,
      currentBalance: values[4] || undefined,
      balanceCostAmount: values[5] || undefined,
      phone: values[6] || null,
      recoveryEmail: values[7] || null,
      remark: values.slice(8).filter(Boolean).join(' ') || null
    };
  }

  private splitImportLine(line: string) {
    const separator = line.includes('\t') ? '\t' : ',';
    const values: string[] = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && quoted && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        quoted = !quoted;
        continue;
      }

      if (char === separator && !quoted) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  private isImportHeader(item: ParsedAppleAccountImportItem) {
    if (item.rowNo !== 1) {
      return false;
    }

    const header = item.data.appleId
      ?.trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '');
    return header === 'appleid' || header === 'apple账号';
  }

  private buildImportPlan(items: ParsedAppleAccountImportItem[], existingAppleIdSet: Set<string>) {
    const planItems: AppleAccountImportPlanItem[] = [];
    const errors: AppleAccountImportError[] = [];
    const seenAppleIds = new Set<string>();

    for (const item of items) {
      try {
        this.assertRequiredString(item.data.appleId, 'appleId');
        const appleId = item.data.appleId.trim();
        const appleIdNormalized = this.normalizeAppleId(appleId);

        if (seenAppleIds.has(appleIdNormalized)) {
          errors.push({
            rowNo: item.rowNo,
            appleId: this.maskAppleId(appleId),
            reason: '本批次内 Apple ID 重复'
          });
          continue;
        }

        if (existingAppleIdSet.has(appleIdNormalized)) {
          errors.push({
            rowNo: item.rowNo,
            appleId: this.maskAppleId(appleId),
            reason: 'Apple ID 已存在'
          });
          continue;
        }

        seenAppleIds.add(appleIdNormalized);
        const currentBalance = this.normalizeMoney(item.data.currentBalance, 'currentBalance');
        const balanceCostAmount = this.normalizeMoney(
          item.data.balanceCostAmount,
          'balanceCostAmount'
        );

        planItems.push({
          rowNo: item.rowNo,
          appleId,
          appleIdNormalized,
          region: this.normalizeCode(item.data.region, 'US'),
          currency: this.normalizeCode(item.data.currency, 'USD'),
          currentBalance,
          balanceCostAmount,
          averageCost: this.calculateAverageCost(currentBalance, balanceCostAmount),
          status: this.parseStatus(item.data.status, true) ?? 'normal',
          isManuallyLocked: this.parseImportBoolean(item.data.isManuallyLocked),
          manualLockReason: this.normalizeNullableString(item.data.manualLockReason),
          passwordEncrypted: this.fieldEncryptionService.encrypt(item.data.password),
          securityInfoEncrypted: this.fieldEncryptionService.encrypt(item.data.securityInfo),
          phoneEncrypted: this.fieldEncryptionService.encrypt(item.data.phone),
          recoveryEmailEncrypted: this.fieldEncryptionService.encrypt(item.data.recoveryEmail),
          remark: this.normalizeNullableString(item.data.remark)
        });
      } catch (error) {
        errors.push({
          rowNo: item.rowNo,
          appleId:
            typeof item.data.appleId === 'string' && item.data.appleId.trim()
              ? this.maskAppleId(item.data.appleId)
              : null,
          reason: error instanceof Error ? error.message : '导入失败'
        });
      }
    }

    return {
      items: planItems,
      errors
    };
  }

  private safeNormalizeAppleId(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    try {
      return this.normalizeAppleId(value);
    } catch {
      return null;
    }
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'normal' ||
      value === 'need_verify' ||
      value === 'locked' ||
      value === 'password_error' ||
      value === 'risk' ||
      value === 'unknown'
    ) {
      return value satisfies AppleAccountStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple ID status');
    }

    return undefined;
  }

  private parseBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    throw new BadRequestException('Invalid boolean parameter');
  }

  private parseImportBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return false;
    }

    if (value === true || value === 'true' || value === '1' || value === 'yes' || value === '是') {
      return true;
    }

    if (value === false || value === 'false' || value === '0' || value === 'no' || value === '否') {
      return false;
    }

    throw new BadRequestException('isManuallyLocked is invalid');
  }

  private getListOrderBy(
    query: ListAppleAccountsQuery
  ): Prisma.AppleAccountOrderByWithRelationInput[] {
    const sortField = query.sortBy ? APPLE_ACCOUNT_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'asc' || normalized === 'ascending') {
      return 'asc';
    }

    if (normalized === 'desc' || normalized === 'descending') {
      return 'desc';
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  private normalizeAppleId(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new BadRequestException('Apple ID must be an email address');
    }

    return normalized;
  }

  private normalizeCode(value: string | undefined, fallback: string) {
    const normalized = (value || fallback).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(normalized)) {
      throw new BadRequestException('Invalid code format');
    }

    return normalized;
  }

  private normalizeMoney(value: string | number | undefined, field: string) {
    if (value === undefined || value === '') {
      return '0';
    }

    const normalized = String(value).trim();
    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return normalized;
  }

  private assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private parseSecretField(value: unknown): AppleAccountSecretField {
    if (
      value === 'appleId' ||
      value === 'password' ||
      value === 'securityInfo' ||
      value === 'phone' ||
      value === 'recoveryEmail'
    ) {
      return value;
    }

    throw new BadRequestException('secret field is invalid');
  }

  private assertSecretPermission(config: SecretFieldConfig, operator?: AuthenticatedUser) {
    if (!operator) {
      throw new ForbiddenException('Permission denied');
    }

    if (operator.roles.includes('admin') || operator.permissions.includes(config.permission)) {
      return;
    }

    throw new ForbiddenException('Permission denied');
  }

  private getSecretValue(account: AppleAccount, field: AppleAccountSecretField) {
    if (field === 'appleId') {
      return account.appleId;
    }

    if (field === 'password') {
      return this.fieldEncryptionService.decrypt(account.passwordEncrypted);
    }

    if (field === 'securityInfo') {
      return this.fieldEncryptionService.decrypt(account.securityInfoEncrypted);
    }

    if (field === 'phone') {
      return this.fieldEncryptionService.decrypt(account.phoneEncrypted);
    }

    return this.fieldEncryptionService.decrypt(account.recoveryEmailEncrypted);
  }

  private redactSensitiveInput(input: Record<string, unknown>) {
    const redacted: Record<string, unknown> = { ...input };
    for (const key of ['password', 'securityInfo', 'phone', 'recoveryEmail']) {
      if (redacted[key]) {
        redacted[key] = '[encrypted]';
      }
    }

    if (typeof redacted.appleId === 'string') {
      redacted.appleId = this.maskAppleId(redacted.appleId);
    }

    return redacted;
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return '***';
    }

    const visiblePrefix = name.slice(0, 2);
    return `${visiblePrefix}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(account: AppleAccount) {
    return {
      id: account.id,
      appleIdMasked: this.maskAppleId(account.appleId),
      appleIdTail: account.appleId.slice(-6),
      region: account.region,
      currency: account.currency,
      currentBalance: account.currentBalance.toString(),
      balanceCostAmount: account.balanceCostAmount.toString(),
      averageCost: account.averageCost.toString(),
      status: account.status,
      isManuallyLocked: account.isManuallyLocked,
      manualLockReason: account.manualLockReason,
      hasPassword: Boolean(account.passwordEncrypted),
      hasSecurityInfo: Boolean(account.securityInfoEncrypted),
      hasPhone: Boolean(account.phoneEncrypted),
      hasRecoveryEmail: Boolean(account.recoveryEmailEncrypted),
      remark: account.remark,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }
}
