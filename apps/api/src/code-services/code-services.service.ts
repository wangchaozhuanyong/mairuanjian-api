import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CodeDeliveryMode,
  CodePlatformMapping,
  CodeService,
  CodeServiceStatus,
  Prisma
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateCodePlatformMappingDto } from './dto/create-code-platform-mapping.dto';
import type { CreateCodeServiceDto } from './dto/create-code-service.dto';
import type { UpdateCodePlatformMappingDto } from './dto/update-code-platform-mapping.dto';
import type { UpdateCodeServiceDto } from './dto/update-code-service.dto';

interface ListCodeServicesQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  deliveryMode?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListCodePlatformMappingsQuery extends PaginationQuery {
  keyword?: string;
  serviceId?: string;
  platformId?: string;
  enabled?: string;
}

type CodePlatformMappingWithRelations = CodePlatformMapping & {
  platform: {
    id: string;
    name: string;
    status: string;
  };
  service: {
    id: string;
    name: string;
    faceValue: Prisma.Decimal;
    status: string;
  };
  deliveryTemplate?: {
    id: string;
    name: string;
    type: string;
    channel: string;
    status: string;
  } | null;
};

const CODE_SERVICE_SORT_FIELDS: Record<string, keyof Prisma.CodeServiceOrderByWithRelationInput> = {
  name: 'name',
  faceValue: 'faceValue',
  defaultCost: 'defaultCost',
  defaultPrice: 'defaultPrice',
  deliveryMode: 'deliveryMode',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const CODE_SERVICE_LIST_CACHE_TTL_MS = 120_000;
const CODE_PLATFORM_MAPPING_LIST_CACHE_TTL_MS = 120_000;

@Injectable()
export class CodeServicesService {
  private readonly listCache = new TimedMemoryCache();
  private readonly mappingListCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListCodeServicesQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('code-services', query),
      CODE_SERVICE_LIST_CACHE_TTL_MS,
      () => this.listUncached(query)
    );
  }

  private async listUncached(query: ListCodeServicesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const deliveryMode = this.parseDeliveryMode(query.deliveryMode, false);
    const where: Prisma.CodeServiceWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      deliveryMode: deliveryMode ?? undefined,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.codeService.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.codeService.count({ where })
    ]);

    return {
      items: items.map((service) => this.toResponse(service)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const service = await this.prisma.codeService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!service) {
      throw new NotFoundException('Code service not found');
    }

    return this.toResponse(service);
  }

  async create(dto: CreateCodeServiceDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');
    const data = this.buildCreateData(dto, operator);
    const service = await this.prisma.codeService.create({ data });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_service',
      action: 'code_service.create',
      objectType: 'code_service',
      objectId: service.id,
      afterData: this.toAuditJson(this.toResponse(service)),
      remark: `Created code service ${service.name}`
    });

    this.clearListCaches();

    return this.get(service.id);
  }

  async update(id: string, dto: UpdateCodeServiceDto, operator?: AuthenticatedUser) {
    const existingService = await this.prisma.codeService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existingService) {
      throw new NotFoundException('Code service not found');
    }

    const data = this.buildUpdateData(dto, operator);
    await this.prisma.codeService.update({
      where: { id },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_service',
      action: 'code_service.update',
      objectType: 'code_service',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingService)),
      afterData: this.toAuditJson(dto),
      remark: `Updated code service ${existingService.name}`
    });

    this.clearListCaches();

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingService = await this.prisma.codeService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existingService) {
      throw new NotFoundException('Code service not found');
    }

    await this.prisma.codeService.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_service',
      action: 'code_service.delete',
      objectType: 'code_service',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingService)),
      remark: `Deleted code service ${existingService.name}`
    });

    this.clearListCaches();

    return { deleted: true };
  }

  private buildOrderBy(query: ListCodeServicesQuery): Prisma.CodeServiceOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? CODE_SERVICE_SORT_FIELDS[query.sortBy] : undefined;

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | undefined {
    if (!value) {
      return undefined;
    }

    if (value === 'asc' || value === 'desc') {
      return value;
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  async listPlatformMappings(query: ListCodePlatformMappingsQuery) {
    return this.mappingListCache.getOrSet(
      getListCacheKey('code-platform-mappings', query),
      CODE_PLATFORM_MAPPING_LIST_CACHE_TTL_MS,
      () => this.listPlatformMappingsUncached(query)
    );
  }

  private async listPlatformMappingsUncached(query: ListCodePlatformMappingsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.CodePlatformMappingWhereInput = {
      serviceId: this.normalizeOptionalUuid(query.serviceId, 'serviceId') ?? undefined,
      platformId: this.normalizeOptionalUuid(query.platformId, 'platformId') ?? undefined,
      enabled: this.parseBooleanFilter(query.enabled),
      OR: keyword
        ? [
            { shopId: { contains: keyword, mode: 'insensitive' } },
            { platformItemId: { contains: keyword, mode: 'insensitive' } },
            { platformSkuId: { contains: keyword, mode: 'insensitive' } },
            { skuKeyword: { contains: keyword, mode: 'insensitive' } },
            { service: { name: { contains: keyword, mode: 'insensitive' } } },
            { platform: { name: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.codePlatformMapping.findMany({
        where,
        include: this.getPlatformMappingInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.codePlatformMapping.count({ where })
    ]);

    return {
      items: items.map((mapping) => this.toPlatformMappingResponse(mapping)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createPlatformMapping(dto: CreateCodePlatformMappingDto, operator?: AuthenticatedUser) {
    const data = await this.buildPlatformMappingCreateData(dto);
    await this.assertPlatformMappingAvailable({
      platformId: data.platformId,
      platformItemId: data.platformItemId,
      platformSkuId: data.platformSkuId,
      serviceId: data.serviceId
    });

    const mapping = await this.prisma.codePlatformMapping.create({
      data,
      include: this.getPlatformMappingInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_platform_mapping',
      action: 'code_platform_mapping.create',
      objectType: 'code_platform_mapping',
      objectId: mapping.id,
      afterData: this.toAuditJson(this.toPlatformMappingResponse(mapping)),
      remark: `Created code platform mapping ${mapping.id}`
    });

    this.mappingListCache.clear();

    return this.toPlatformMappingResponse(mapping);
  }

  async updatePlatformMapping(
    id: string,
    dto: UpdateCodePlatformMappingDto,
    operator?: AuthenticatedUser
  ) {
    const existingMapping = await this.findPlatformMappingOrThrow(id);
    const data = await this.buildPlatformMappingUpdateData(dto);
    const nextPlatformId =
      typeof data.platformId === 'string' ? data.platformId : existingMapping.platformId;
    const nextPlatformItemId =
      typeof data.platformItemId === 'string'
        ? data.platformItemId
        : existingMapping.platformItemId;
    const nextPlatformSkuId =
      typeof data.platformSkuId === 'string' ? data.platformSkuId : existingMapping.platformSkuId;
    const nextServiceId =
      typeof data.serviceId === 'string' ? data.serviceId : existingMapping.serviceId;

    await this.assertPlatformMappingAvailable(
      {
        platformId: nextPlatformId,
        platformItemId: nextPlatformItemId,
        platformSkuId: nextPlatformSkuId,
        serviceId: nextServiceId
      },
      id
    );

    const mapping = await this.prisma.codePlatformMapping.update({
      where: { id },
      data,
      include: this.getPlatformMappingInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_platform_mapping',
      action: 'code_platform_mapping.update',
      objectType: 'code_platform_mapping',
      objectId: id,
      beforeData: this.toAuditJson(this.toPlatformMappingResponse(existingMapping)),
      afterData: this.toAuditJson(dto),
      remark: `Updated code platform mapping ${id}`
    });

    this.mappingListCache.clear();

    return this.toPlatformMappingResponse(mapping);
  }

  async removePlatformMapping(id: string, operator?: AuthenticatedUser) {
    const existingMapping = await this.findPlatformMappingOrThrow(id);

    await this.prisma.codePlatformMapping.delete({
      where: { id }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_platform_mapping',
      action: 'code_platform_mapping.delete',
      objectType: 'code_platform_mapping',
      objectId: id,
      beforeData: this.toAuditJson(this.toPlatformMappingResponse(existingMapping)),
      remark: `Deleted code platform mapping ${id}`
    });

    this.mappingListCache.clear();

    return { deleted: true };
  }

  private clearListCaches() {
    this.listCache.clear();
    this.mappingListCache.clear();
  }

  private buildCreateData(dto: CreateCodeServiceDto, operator?: AuthenticatedUser) {
    return {
      name: dto.name.trim(),
      faceValue: this.normalizePositiveDecimal(dto.faceValue, 'faceValue'),
      defaultPrice: this.normalizeNonNegativeDecimal(dto.defaultPrice, 'defaultPrice', '0'),
      defaultCost: this.normalizeNonNegativeDecimal(dto.defaultCost, 'defaultCost', '0'),
      deliveryMode: this.parseDeliveryMode(dto.deliveryMode, true) ?? 'semi_auto',
      exactFaceValueOnly: dto.exactFaceValueOnly ?? true,
      allowCombination: dto.allowCombination ?? false,
      status: this.parseStatus(dto.status, true) ?? 'enabled',
      remark: this.normalizeNullableString(dto.remark),
      createdByUserId: operator?.id,
      updatedByUserId: operator?.id
    } satisfies Prisma.CodeServiceUncheckedCreateInput;
  }

  private buildUpdateData(dto: UpdateCodeServiceDto, operator?: AuthenticatedUser) {
    const data: Prisma.CodeServiceUncheckedUpdateInput = {};

    if (operator?.id) {
      data.updatedByUserId = operator.id;
    }

    if (dto.name !== undefined) {
      this.assertRequiredString(dto.name, 'name');
      data.name = dto.name.trim();
    }

    if (dto.faceValue !== undefined) {
      data.faceValue = this.normalizePositiveDecimal(dto.faceValue, 'faceValue');
    }

    if (dto.defaultPrice !== undefined) {
      data.defaultPrice = this.normalizeNonNegativeDecimal(dto.defaultPrice, 'defaultPrice', '0');
    }

    if (dto.defaultCost !== undefined) {
      data.defaultCost = this.normalizeNonNegativeDecimal(dto.defaultCost, 'defaultCost', '0');
    }

    if (dto.deliveryMode !== undefined) {
      data.deliveryMode = this.parseDeliveryMode(dto.deliveryMode, true);
    }

    if (dto.exactFaceValueOnly !== undefined) {
      data.exactFaceValueOnly = Boolean(dto.exactFaceValueOnly);
    }

    if (dto.allowCombination !== undefined) {
      data.allowCombination = Boolean(dto.allowCombination);
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    return data;
  }

  private async buildPlatformMappingCreateData(dto: CreateCodePlatformMappingDto) {
    const platformId = this.normalizeRequiredUuid(dto.platformId, 'platformId');
    const serviceId = this.normalizeRequiredUuid(dto.serviceId, 'serviceId');
    const service = await this.assertCodeServiceAvailable(serviceId);
    await this.assertSourcePlatformAvailable(platformId);
    await this.assertDeliveryTemplateAvailable(dto.deliveryTemplateId);

    return {
      platformId,
      shopId: this.normalizeNullableString(dto.shopId),
      platformItemId: this.normalizeRequiredString(dto.platformItemId, 'platformItemId'),
      platformSkuId: this.normalizeOptionalCode(dto.platformSkuId),
      skuKeyword: this.normalizeNullableString(dto.skuKeyword),
      serviceId,
      faceValue:
        dto.faceValue === undefined
          ? service.faceValue.toString()
          : this.normalizePositiveDecimal(dto.faceValue, 'faceValue'),
      quantity: this.normalizePositiveInteger(dto.quantity, 'quantity', 1),
      deliveryTemplateId: this.normalizeNullableUuid(dto.deliveryTemplateId, 'deliveryTemplateId'),
      enabled: dto.enabled ?? true
    } satisfies Prisma.CodePlatformMappingUncheckedCreateInput;
  }

  private async buildPlatformMappingUpdateData(dto: UpdateCodePlatformMappingDto) {
    const data: Prisma.CodePlatformMappingUncheckedUpdateInput = {};

    if (dto.platformId !== undefined) {
      const platformId = this.normalizeRequiredUuid(dto.platformId, 'platformId');
      await this.assertSourcePlatformAvailable(platformId);
      data.platformId = platformId;
    }

    if (dto.shopId !== undefined) {
      data.shopId = this.normalizeNullableString(dto.shopId);
    }

    if (dto.platformItemId !== undefined) {
      data.platformItemId = this.normalizeRequiredString(dto.platformItemId, 'platformItemId');
    }

    if (dto.platformSkuId !== undefined) {
      data.platformSkuId = this.normalizeOptionalCode(dto.platformSkuId);
    }

    if (dto.skuKeyword !== undefined) {
      data.skuKeyword = this.normalizeNullableString(dto.skuKeyword);
    }

    if (dto.serviceId !== undefined) {
      const serviceId = this.normalizeRequiredUuid(dto.serviceId, 'serviceId');
      const service = await this.assertCodeServiceAvailable(serviceId);
      data.serviceId = serviceId;

      if (dto.faceValue === undefined) {
        data.faceValue = service.faceValue.toString();
      }
    }

    if (dto.faceValue !== undefined) {
      data.faceValue = this.normalizePositiveDecimal(dto.faceValue, 'faceValue');
    }

    if (dto.quantity !== undefined) {
      data.quantity = this.normalizePositiveInteger(dto.quantity, 'quantity', 1);
    }

    if (dto.deliveryTemplateId !== undefined) {
      await this.assertDeliveryTemplateAvailable(dto.deliveryTemplateId);
      data.deliveryTemplateId = this.normalizeNullableUuid(
        dto.deliveryTemplateId,
        'deliveryTemplateId'
      );
    }

    if (dto.enabled !== undefined) {
      data.enabled = Boolean(dto.enabled);
    }

    return data;
  }

  private assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private normalizeRequiredString(value: unknown, field: string) {
    this.assertRequiredString(value, field);
    return value.trim();
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    this.assertRequiredString(value, field);
    const normalized = value.trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }

    return normalized;
  }

  private normalizeNullableUuid(value: string | null | undefined, field: string) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return this.normalizeRequiredUuid(value, field);
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

  private normalizeOptionalCode(value: string | null | undefined) {
    return this.normalizeNullableString(value) ?? '';
  }

  private normalizePositiveInteger(value: number | undefined, field: string, fallback: number) {
    const normalized = value ?? fallback;

    if (!Number.isInteger(normalized) || normalized < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return normalized;
  }

  private normalizePositiveDecimal(value: string | number | undefined, field: string) {
    const normalized = this.normalizeDecimal(value, field, undefined);

    if (Number(normalized) <= 0) {
      throw new BadRequestException(`${field} must be greater than 0`);
    }

    return normalized;
  }

  private normalizeNonNegativeDecimal(
    value: string | number | undefined,
    field: string,
    fallback: string
  ) {
    return this.normalizeDecimal(value, field, fallback);
  }

  private normalizeDecimal(value: string | number | undefined, field: string, fallback?: string) {
    const normalized = value === undefined || value === '' ? fallback : String(value).trim();

    if (!normalized || !/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return normalized;
  }

  private parseDeliveryMode(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'auto' || value === 'semi_auto' || value === 'manual') {
      return value satisfies CodeDeliveryMode;
    }

    if (strict) {
      throw new BadRequestException('Invalid code delivery mode');
    }

    return undefined;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'enabled' || value === 'paused' || value === 'disabled') {
      return value satisfies CodeServiceStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid code service status');
    }

    return undefined;
  }

  private parseBooleanFilter(value: string | undefined) {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new BadRequestException('enabled must be true or false');
  }

  private async assertCodeServiceAvailable(id: string) {
    const service = await this.prisma.codeService.findFirst({
      where: { id, deletedAt: null, status: { not: 'disabled' } },
      select: {
        id: true,
        faceValue: true
      }
    });

    if (!service) {
      throw new BadRequestException('Code service does not exist or is disabled');
    }

    return service;
  }

  private async assertSourcePlatformAvailable(id: string) {
    const sourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: { id, deletedAt: null, status: 'active' },
      select: { id: true }
    });

    if (!sourcePlatform) {
      throw new BadRequestException('Source platform does not exist or is disabled');
    }
  }

  private async assertDeliveryTemplateAvailable(id: string | null | undefined) {
    if (!id) {
      return;
    }

    const deliveryTemplateId = this.normalizeRequiredUuid(id, 'deliveryTemplateId');
    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        id: deliveryTemplateId,
        deletedAt: null,
        status: 'active',
        type: 'delivery',
        channel: 'customer_service'
      },
      select: { id: true }
    });

    if (!template) {
      throw new BadRequestException(
        'Delivery template does not exist, is disabled, or is not a delivery reply template'
      );
    }
  }

  private async assertPlatformMappingAvailable(
    mapping: {
      platformId: string;
      platformItemId: string;
      platformSkuId: string;
      serviceId: string;
    },
    currentId?: string
  ) {
    const existingMapping = await this.prisma.codePlatformMapping.findFirst({
      where: {
        platformId: mapping.platformId,
        platformItemId: mapping.platformItemId,
        platformSkuId: mapping.platformSkuId,
        serviceId: mapping.serviceId,
        id: currentId ? { not: currentId } : undefined
      },
      select: { id: true }
    });

    if (existingMapping) {
      throw new ConflictException('Code platform mapping already exists');
    }
  }

  private async findPlatformMappingOrThrow(id: string) {
    const mapping = await this.prisma.codePlatformMapping.findUnique({
      where: { id },
      include: this.getPlatformMappingInclude()
    });

    if (!mapping) {
      throw new NotFoundException('Code platform mapping not found');
    }

    return mapping;
  }

  private getPlatformMappingInclude() {
    return {
      platform: {
        select: {
          id: true,
          name: true,
          status: true
        }
      },
      service: {
        select: {
          id: true,
          name: true,
          faceValue: true,
          status: true
        }
      },
      deliveryTemplate: {
        select: {
          id: true,
          name: true,
          type: true,
          channel: true,
          status: true
        }
      }
    } satisfies Prisma.CodePlatformMappingInclude;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(service: CodeService) {
    return {
      id: service.id,
      name: service.name,
      faceValue: service.faceValue.toString(),
      defaultPrice: service.defaultPrice.toString(),
      defaultCost: service.defaultCost.toString(),
      deliveryMode: service.deliveryMode,
      exactFaceValueOnly: service.exactFaceValueOnly,
      allowCombination: service.allowCombination,
      status: service.status,
      remark: service.remark,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
  }

  private toPlatformMappingResponse(mapping: CodePlatformMappingWithRelations) {
    return {
      id: mapping.id,
      platformId: mapping.platformId,
      platform: {
        id: mapping.platform.id,
        name: mapping.platform.name,
        status: mapping.platform.status
      },
      shopId: mapping.shopId,
      platformItemId: mapping.platformItemId,
      platformSkuId: mapping.platformSkuId,
      skuKeyword: mapping.skuKeyword,
      serviceId: mapping.serviceId,
      service: {
        id: mapping.service.id,
        name: mapping.service.name,
        faceValue: mapping.service.faceValue.toString(),
        status: mapping.service.status
      },
      faceValue: mapping.faceValue.toString(),
      quantity: mapping.quantity,
      deliveryTemplateId: mapping.deliveryTemplateId,
      deliveryTemplate: mapping.deliveryTemplate
        ? {
            id: mapping.deliveryTemplate.id,
            name: mapping.deliveryTemplate.name,
            type: mapping.deliveryTemplate.type,
            channel: mapping.deliveryTemplate.channel,
            status: mapping.deliveryTemplate.status
          }
        : null,
      enabled: mapping.enabled,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt
    };
  }
}
