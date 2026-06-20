import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CodeService,
  Prisma,
  RedeemCode,
  RedeemCodeBatch,
  RedeemCodeStatus
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ImportRedeemCodesDto } from './dto/import-redeem-codes.dto';
import type { RevealRedeemCodeDto } from './dto/reveal-redeem-code.dto';

interface ListRedeemCodeBatchesQuery extends PaginationQuery {
  keyword?: string;
  serviceId?: string;
}

interface ListRedeemCodeInventoryQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  serviceId?: string;
  batchId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface AuditRequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface ParsedImportItem {
  rowNo: number;
  code: string;
  cost?: string | number | null;
  remark?: string | null;
  expireAt?: string | null;
}

interface ImportPlanItem {
  rowNo: number;
  code: string;
  codeHash: string;
  codeTail: string;
  cost: string;
  remark: string | null;
  expireAt: Date | null;
}

export interface ImportPlanError {
  rowNo: number;
  codeTail?: string | null;
  reason: string;
}

type RedeemCodeBatchWithRelations = RedeemCodeBatch & {
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'>;
  importedBy?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
};

type RedeemCodeWithRelations = RedeemCode & {
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'>;
  batch: Pick<RedeemCodeBatch, 'id' | 'batchNo' | 'createdAt'>;
  deliveredPlatform?: {
    id: string;
    name: string;
  } | null;
};

const REDEEM_CODE_INVENTORY_SORT_FIELDS: Record<
  string,
  keyof Prisma.RedeemCodeOrderByWithRelationInput
> = {
  codeTail: 'codeTail',
  faceValue: 'faceValue',
  cost: 'cost',
  status: 'status',
  deliveredAt: 'deliveredAt',
  expireAt: 'expireAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const REDEEM_CODE_LIST_CACHE_TTL_MS = 120_000;

@Injectable()
export class RedeemCodesService {
  private readonly lowInventoryThreshold = 5;
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService,
    private readonly notificationsService: NotificationsService
  ) {}

  async listBatches(query: ListRedeemCodeBatchesQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('redeem-code-batches', query),
      REDEEM_CODE_LIST_CACHE_TTL_MS,
      async () => {
        const pagination = getPagination(query);
        const keyword = query.keyword?.trim();
        const where: Prisma.RedeemCodeBatchWhereInput = {
          serviceId: this.normalizeOptionalUuid(query.serviceId, 'serviceId') ?? undefined,
          OR: keyword
            ? [
                { batchNo: { contains: keyword, mode: 'insensitive' } },
                { remark: { contains: keyword, mode: 'insensitive' } },
                { service: { name: { contains: keyword, mode: 'insensitive' } } }
              ]
            : undefined
        };

        const [items, total] = await Promise.all([
          this.prisma.redeemCodeBatch.findMany({
            where,
            include: this.getBatchInclude(),
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { createdAt: 'desc' }
          }),
          this.prisma.redeemCodeBatch.count({ where })
        ]);

        return {
          items: items.map((batch) => this.toBatchResponse(batch)),
          total,
          page: pagination.page,
          pageSize: pagination.pageSize
        };
      }
    );
  }

  async importBatch(dto: ImportRedeemCodesDto, operator?: AuthenticatedUser) {
    const serviceId = this.normalizeRequiredUuid(dto.serviceId, 'serviceId');
    const service = await this.prisma.codeService.findFirst({
      where: { id: serviceId, deletedAt: null }
    });

    if (!service) {
      throw new NotFoundException('Code service not found');
    }

    if (service.status === 'disabled') {
      throw new BadRequestException('Code service is disabled');
    }

    const parsedItems = this.parseImportItems(dto.codes);
    const candidateHashes = this.extractCandidateHashes(parsedItems);
    const existingCodes = candidateHashes.length
      ? await this.prisma.redeemCode.findMany({
          where: { codeHash: { in: candidateHashes } },
          select: { codeHash: true }
        })
      : [];
    const existingHashSet = new Set(existingCodes.map((code) => code.codeHash));
    const defaultCost = this.normalizeNonNegativeDecimal(
      dto.defaultCost ?? service.defaultCost.toString(),
      'defaultCost',
      service.defaultCost.toString()
    );
    const defaultExpireAt = this.normalizeNullableDate(dto.expireAt, 'expireAt');
    const importPlan = this.buildImportPlan(
      parsedItems,
      existingHashSet,
      defaultCost,
      defaultExpireAt
    );
    const batchNo = this.normalizeBatchNo(dto.batchNo) ?? this.createBatchNo();

    await this.assertBatchNoAvailable(batchNo);

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.redeemCodeBatch.create({
        data: {
          batchNo,
          serviceId: service.id,
          faceValue: service.faceValue,
          totalCount: parsedItems.length,
          successCount: importPlan.items.length,
          failedCount: importPlan.errors.length,
          defaultCost,
          remark: this.normalizeNullableString(dto.remark),
          importedById: operator?.id
        }
      });

      if (importPlan.items.length) {
        await tx.redeemCode.createMany({
          data: importPlan.items.map((item) => ({
            serviceId: service.id,
            batchId: createdBatch.id,
            codeEncrypted: this.encryptRequired(item.code),
            codeHash: item.codeHash,
            codeTail: item.codeTail,
            faceValue: service.faceValue,
            cost: item.cost,
            status: 'unsold',
            expireAt: item.expireAt,
            remark: item.remark
          }))
        });
      }

      return createdBatch;
    });

    this.listCache.clear();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'redeem_code',
      action: 'redeem_code.batch_import',
      objectType: 'redeem_code_batch',
      objectId: batch.id,
      afterData: this.toAuditJson({
        batchNo,
        serviceId: service.id,
        totalCount: parsedItems.length,
        successCount: importPlan.items.length,
        failedCount: importPlan.errors.length
      }),
      remark: `Imported redeem code batch ${batchNo}`
    });

    await this.notifyImportResult(service, batchNo, parsedItems.length, importPlan);
    await this.notifyInventoryLevel(service);

    return {
      batch: await this.getBatch(batch.id),
      successCount: importPlan.items.length,
      failedCount: importPlan.errors.length,
      errors: importPlan.errors
    };
  }

  private async notifyImportResult(
    service: CodeService,
    batchNo: string,
    totalCount: number,
    importPlan: {
      items: ImportPlanItem[];
      errors: ImportPlanError[];
    }
  ) {
    const duplicateErrors = importPlan.errors.filter(
      (error) => error.reason === '本次导入内重复' || error.reason === '兑换码已存在'
    );

    if (duplicateErrors.length) {
      await this.notificationsService.triggerEvent({
        eventCode: 'code.import.duplicate',
        module: 'code',
        title: '兑换码重复导入',
        content: `批次 ${batchNo} 发现 ${duplicateErrors.length} 条重复兑换码`,
        payload: {
          title: '兑换码重复导入',
          summary: `批次 ${batchNo} 发现 ${duplicateErrors.length} 条重复兑换码`,
          detail: `业务：${service.name}，总行数 ${totalCount}，成功 ${importPlan.items.length}，失败 ${importPlan.errors.length}。`,
          serviceId: service.id,
          serviceName: service.name,
          batchNo,
          totalCount,
          successCount: importPlan.items.length,
          failedCount: importPlan.errors.length,
          duplicateCount: duplicateErrors.length,
          examples: duplicateErrors.slice(0, 10)
        }
      });
    }

    if (importPlan.errors.length) {
      await this.notificationsService.triggerEvent({
        eventCode: 'code.import.failed',
        module: 'code',
        title: '批量导入失败',
        content: `批次 ${batchNo} 有 ${importPlan.errors.length} 条兑换码导入失败`,
        payload: {
          title: '批量导入失败',
          summary: `批次 ${batchNo} 有 ${importPlan.errors.length} 条兑换码导入失败`,
          detail: `业务：${service.name}，请查看导入错误报告并处理失败行。`,
          serviceId: service.id,
          serviceName: service.name,
          batchNo,
          totalCount,
          successCount: importPlan.items.length,
          failedCount: importPlan.errors.length,
          examples: importPlan.errors.slice(0, 10)
        }
      });
    }
  }

  private async notifyInventoryLevel(service: CodeService) {
    const unsoldCount = await this.prisma.redeemCode.count({
      where: {
        serviceId: service.id,
        status: 'unsold'
      }
    });

    if (unsoldCount === 0) {
      await this.notificationsService.triggerEvent({
        eventCode: 'code.inventory.out_of_stock',
        module: 'code',
        title: '某面值缺货',
        content: `${service.name} 当前无可售兑换码`,
        payload: {
          title: '某面值缺货',
          summary: `${service.name} 当前无可售兑换码`,
          detail: `面值 ${service.faceValue.toString()}，请及时补充库存。`,
          serviceId: service.id,
          serviceName: service.name,
          faceValue: service.faceValue.toString(),
          unsoldCount
        }
      });
      return;
    }

    if (unsoldCount <= this.lowInventoryThreshold) {
      await this.notificationsService.triggerEvent({
        eventCode: 'code.inventory.low',
        module: 'code',
        title: '兑换码低库存',
        content: `${service.name} 可售库存仅剩 ${unsoldCount} 张`,
        payload: {
          title: '兑换码低库存',
          summary: `${service.name} 可售库存仅剩 ${unsoldCount} 张`,
          detail: `面值 ${service.faceValue.toString()}，低库存阈值 ${this.lowInventoryThreshold}。`,
          serviceId: service.id,
          serviceName: service.name,
          faceValue: service.faceValue.toString(),
          unsoldCount,
          threshold: this.lowInventoryThreshold
        }
      });
    }
  }

  async listInventory(query: ListRedeemCodeInventoryQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('redeem-code-inventory', query),
      REDEEM_CODE_LIST_CACHE_TTL_MS,
      async () => {
        const pagination = getPagination(query);
        const keyword = query.keyword?.trim();
        const status = this.parseRedeemCodeStatus(query.status, false);
        const where: Prisma.RedeemCodeWhereInput = {
          status: status ?? undefined,
          serviceId: this.normalizeOptionalUuid(query.serviceId, 'serviceId') ?? undefined,
          batchId: this.normalizeOptionalUuid(query.batchId, 'batchId') ?? undefined,
          OR: keyword
            ? [
                { codeTail: { contains: keyword, mode: 'insensitive' } },
                { remark: { contains: keyword, mode: 'insensitive' } },
                { batch: { batchNo: { contains: keyword, mode: 'insensitive' } } },
                { service: { name: { contains: keyword, mode: 'insensitive' } } }
              ]
            : undefined
        };

        const [items, total] = await Promise.all([
          this.prisma.redeemCode.findMany({
            where,
            include: this.getInventoryInclude(),
            skip: pagination.skip,
            take: pagination.take,
            orderBy: this.buildInventoryOrderBy(query)
          }),
          this.prisma.redeemCode.count({ where })
        ]);

        return {
          items: items.map((code) => this.toInventoryResponse(code)),
          total,
          page: pagination.page,
          pageSize: pagination.pageSize
        };
      }
    );
  }

  async getInventoryItem(id: string) {
    const code = await this.prisma.redeemCode.findUnique({
      where: { id },
      include: this.getInventoryInclude()
    });

    if (!code) {
      throw new NotFoundException('Redeem code not found');
    }

    return this.toInventoryResponse(code);
  }

  async revealRedeemCode(
    id: string,
    dto: RevealRedeemCodeDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const code = await this.prisma.redeemCode.findUnique({
      where: { id },
      select: {
        id: true,
        serviceId: true,
        batchId: true,
        codeEncrypted: true,
        codeTail: true,
        status: true
      }
    });

    if (!code) {
      throw new NotFoundException('Redeem code not found');
    }

    const redeemCode = this.fieldEncryptionService.decrypt(code.codeEncrypted);

    if (!redeemCode) {
      throw new NotFoundException('Redeem code not found');
    }

    await this.prisma.sensitiveAccessLog.create({
      data: {
        userId: operator?.id,
        module: 'redeem_code',
        fieldName: 'redeemCode',
        objectType: 'redeem_code',
        objectId: code.id,
        accessReason: reason,
        approved: true,
        ip: requestMeta?.ip,
        userAgent: requestMeta?.userAgent
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'redeem_code',
      action: 'redeem_code.reveal',
      objectType: 'redeem_code',
      objectId: code.id,
      afterData: this.toAuditJson({
        serviceId: code.serviceId,
        batchId: code.batchId,
        field: 'redeemCode',
        codeTail: code.codeTail,
        status: code.status,
        reason
      }),
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
      remark: `Revealed redeem code ${code.id}`
    });

    return {
      id: code.id,
      serviceId: code.serviceId,
      batchId: code.batchId,
      redeemCode,
      codeTail: code.codeTail,
      revealedAt: new Date()
    };
  }

  buildImportPlan(
    items: ParsedImportItem[],
    existingHashes: Set<string>,
    defaultCost: string,
    defaultExpireAt: Date | null
  ) {
    const seenHashes = new Set<string>();
    const planItems: ImportPlanItem[] = [];
    const errors: ImportPlanError[] = [];

    for (const item of items) {
      const code = item.code.trim();

      if (!code) {
        errors.push({
          rowNo: item.rowNo,
          reason: '兑换码为空'
        });
        continue;
      }

      const codeHash = this.fieldEncryptionService.hash(code);
      const codeTail = this.getTail(code);

      if (!codeHash) {
        errors.push({
          rowNo: item.rowNo,
          codeTail,
          reason: '兑换码无法生成重复检测 hash'
        });
        continue;
      }

      if (seenHashes.has(codeHash)) {
        errors.push({
          rowNo: item.rowNo,
          codeTail,
          reason: '本次导入内重复'
        });
        continue;
      }

      if (existingHashes.has(codeHash)) {
        errors.push({
          rowNo: item.rowNo,
          codeTail,
          reason: '兑换码已存在'
        });
        continue;
      }

      seenHashes.add(codeHash);
      planItems.push({
        rowNo: item.rowNo,
        code,
        codeHash,
        codeTail,
        cost: this.normalizeNonNegativeDecimal(item.cost ?? defaultCost, 'cost', defaultCost),
        remark: this.normalizeNullableString(item.remark),
        expireAt: item.expireAt
          ? this.normalizeNullableDate(item.expireAt, `expireAt row ${item.rowNo}`)
          : defaultExpireAt
      });
    }

    return {
      items: planItems,
      errors
    };
  }

  private async getBatch(id: string) {
    const batch = await this.prisma.redeemCodeBatch.findUnique({
      where: { id },
      include: this.getBatchInclude()
    });

    if (!batch) {
      throw new NotFoundException('Redeem code batch not found');
    }

    return this.toBatchResponse(batch);
  }

  private parseImportItems(codes: ImportRedeemCodesDto['codes']) {
    if (!Array.isArray(codes) || !codes.length) {
      throw new BadRequestException('codes is required');
    }

    return codes.map((item, index): ParsedImportItem => {
      const rowNo = index + 1;

      if (typeof item === 'string') {
        return {
          rowNo,
          code: item
        };
      }

      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`codes[${index}] must be a string or object`);
      }

      return {
        rowNo,
        code: item.code,
        cost: item.cost,
        remark: item.remark,
        expireAt: item.expireAt
      };
    });
  }

  private extractCandidateHashes(items: ParsedImportItem[]) {
    return [
      ...new Set(
        items
          .map((item) => this.fieldEncryptionService.hash(item.code.trim()))
          .filter((hash): hash is string => Boolean(hash))
      )
    ];
  }

  private async assertBatchNoAvailable(batchNo: string) {
    const existingBatch = await this.prisma.redeemCodeBatch.findUnique({
      where: { batchNo },
      select: { id: true }
    });

    if (existingBatch) {
      throw new ConflictException('Redeem code batch number already exists');
    }
  }

  private encryptRequired(code: string) {
    const encrypted = this.fieldEncryptionService.encrypt(code);

    if (!encrypted) {
      throw new BadRequestException('Redeem code cannot be encrypted');
    }

    return encrypted;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    const normalized = value.trim();

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

  private normalizeBatchNo(value: string | null | undefined) {
    const normalized = this.normalizeNullableString(value);

    if (!normalized) {
      return null;
    }

    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(normalized)) {
      throw new BadRequestException('batchNo format is invalid');
    }

    return normalized;
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeNonNegativeDecimal(
    value: string | number | null | undefined,
    field: string,
    fallback: string
  ) {
    const normalized =
      value === null || value === undefined || value === '' ? fallback : String(value).trim();

    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return normalized;
  }

  private normalizeNullableDate(value: string | null | undefined, field: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private parseRedeemCodeStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'unsold' ||
      value === 'locked' ||
      value === 'delivered' ||
      value === 'delivery_failed' ||
      value === 'after_sale' ||
      value === 'reissued' ||
      value === 'voided' ||
      value === 'refunded'
    ) {
      return value satisfies RedeemCodeStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid redeem code status');
    }

    return undefined;
  }

  private buildInventoryOrderBy(
    query: ListRedeemCodeInventoryQuery
  ): Prisma.RedeemCodeOrderByWithRelationInput[] {
    const sortField = query.sortBy ? REDEEM_CODE_INVENTORY_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
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

  private createBatchNo() {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return `RC-${timestamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private getTail(code: string) {
    return code.trim().slice(-4);
  }

  private getBatchInclude() {
    return {
      service: {
        select: {
          id: true,
          name: true,
          faceValue: true,
          defaultCost: true,
          status: true
        }
      },
      importedBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.RedeemCodeBatchInclude;
  }

  private getInventoryInclude() {
    return {
      service: {
        select: {
          id: true,
          name: true,
          faceValue: true,
          defaultCost: true,
          status: true
        }
      },
      batch: {
        select: {
          id: true,
          batchNo: true,
          createdAt: true
        }
      },
      deliveredPlatform: {
        select: {
          id: true,
          name: true
        }
      }
    } satisfies Prisma.RedeemCodeInclude;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toBatchResponse(batch: RedeemCodeBatchWithRelations) {
    return {
      id: batch.id,
      batchNo: batch.batchNo,
      serviceId: batch.serviceId,
      service: {
        id: batch.service.id,
        name: batch.service.name,
        faceValue: batch.service.faceValue.toString(),
        defaultCost: batch.service.defaultCost.toString(),
        status: batch.service.status
      },
      faceValue: batch.faceValue.toString(),
      totalCount: batch.totalCount,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      defaultCost: batch.defaultCost.toString(),
      remark: batch.remark,
      importedBy: batch.importedBy
        ? {
            id: batch.importedBy.id,
            username: batch.importedBy.username,
            displayName: batch.importedBy.displayName
          }
        : null,
      createdAt: batch.createdAt
    };
  }

  private toInventoryResponse(code: RedeemCodeWithRelations) {
    return {
      id: code.id,
      serviceId: code.serviceId,
      service: {
        id: code.service.id,
        name: code.service.name,
        faceValue: code.service.faceValue.toString(),
        defaultCost: code.service.defaultCost.toString(),
        status: code.service.status
      },
      batchId: code.batchId,
      batch: {
        id: code.batch.id,
        batchNo: code.batch.batchNo,
        createdAt: code.batch.createdAt
      },
      codeTail: code.codeTail,
      hasCode: Boolean(code.codeEncrypted),
      faceValue: code.faceValue.toString(),
      cost: code.cost.toString(),
      status: code.status,
      lockedOrderId: code.lockedOrderId,
      deliveredOrderId: code.deliveredOrderId,
      deliveredPlatformId: code.deliveredPlatformId,
      deliveredPlatform: code.deliveredPlatform
        ? {
            id: code.deliveredPlatform.id,
            name: code.deliveredPlatform.name
          }
        : null,
      deliveredAt: code.deliveredAt,
      expireAt: code.expireAt,
      remark: code.remark,
      createdAt: code.createdAt,
      updatedAt: code.updatedAt
    };
  }
}
