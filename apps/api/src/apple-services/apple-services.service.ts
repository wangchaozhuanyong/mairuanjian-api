import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma as PrismaNamespace } from '@prisma/client';
import type {
  AppleBalancePriceRuleType,
  AppleService,
  AppleServiceExpireCalcType,
  AppleServiceLockRule,
  AppleServicePeriodType,
  AppleServicePlatformFeeType,
  AppleServicePlatformMapping,
  AppleServiceStatus,
  AppleServiceRegionPriceStatus,
  Prisma
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type {
  CreateAppleServiceDto,
  SaveAppleBalancePriceRuleDto
} from './dto/create-apple-service.dto';
import type { CreateAppleServicePlatformMappingDto } from './dto/create-apple-service-platform-mapping.dto';
import type { UpdateAppleServiceDto } from './dto/update-apple-service.dto';
import type { UpdateAppleServicePlatformMappingDto } from './dto/update-apple-service-platform-mapping.dto';

interface ListAppleServicesQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  currency?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListAppleServiceRegionPricesQuery extends PaginationQuery {
  region?: string;
  category?: string;
  serviceId?: string;
  status?: string;
  orderEntryOnly?: string;
}

interface UpsertAppleServiceRegionPriceInput {
  serviceId: string;
  sourceSnapshotId?: string | null;
  provider?: string | null;
  serviceName: string;
  category: string;
  region: string;
  currency: string;
  officialPrice: Prisma.Decimal.Value;
  appleBalancePrice?: Prisma.Decimal.Value | null;
  periodType: AppleServicePeriodType;
  periodValue: number;
  collectedAt?: Date | null;
  confirmedAt?: Date | null;
  status?: AppleServiceRegionPriceStatus;
  remark?: string | null;
}

type AppleServicePlatformMappingWithRelations = AppleServicePlatformMapping & {
  sourcePlatform: {
    id: string;
    name: string;
    feeRate: Prisma.Decimal;
    feeFixed: Prisma.Decimal;
    status: string;
  };
};

type AppleServiceRegionPriceWithRelations = Prisma.AppleServiceRegionPriceGetPayload<{
  include: {
    service: true;
    sourceSnapshot: {
      select: {
        id: true;
        provider: true;
        collectedAt: true;
      };
    };
  };
}>;

const APPLE_SERVICE_SORT_FIELDS: Record<string, keyof Prisma.AppleServiceOrderByWithRelationInput> =
  {
    name: 'name',
    category: 'category',
    defaultPrice: 'defaultPrice',
    officialCostValue: 'officialCostValue',
    currency: 'currency',
    defaultPeriodValue: 'defaultPeriodValue',
    lockRule: 'lockRule',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };
const APPLE_SERVICE_LIST_CACHE_TTL_MS = 120_000;
const APPLE_SERVICE_PLATFORM_MAPPING_CACHE_TTL_MS = 120_000;
const APPLE_BALANCE_PRICE_RULE_PARAMETER_KEY = 'apple_balance_price_rule';
const DELETED_REGION_PRICE_KEYS_PARAMETER = 'apple_service_deleted_region_price_keys';
const DEFAULT_BALANCE_PRICE_RULE = {
  ruleType: 'percent' as AppleBalancePriceRuleType,
  ruleValue: '1'
};

@Injectable()
export class AppleServicesService {
  private readonly listCache = new TimedMemoryCache();
  private readonly mappingListCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListAppleServicesQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('apple-services', query),
      APPLE_SERVICE_LIST_CACHE_TTL_MS,
      () => this.listUncached(query)
    );
  }

  private async listUncached(query: ListAppleServicesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const category = this.normalizeCategoryFilter(query.category);
    const where: Prisma.AppleServiceWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      currency: query.currency ? query.currency.trim().toUpperCase() : undefined,
      category,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { category: { contains: keyword, mode: 'insensitive' } },
            { currency: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleService.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.appleService.count({ where })
    ]);

    return {
      items: items.map((service) => this.toResponse(service)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const service = await this.prisma.appleService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!service) {
      throw new NotFoundException('Apple service not found');
    }

    return this.toResponse(service);
  }

  async listRegionPrices(query: ListAppleServiceRegionPricesQuery) {
    const pagination = getPagination(query);
    const region = query.region?.trim().toUpperCase();
    const category = this.normalizeCategoryFilter(query.category);
    const status = this.parseRegionPriceStatus(query.status, false);
    const orderEntryOnly = query.orderEntryOnly !== 'false';
    const where: Prisma.AppleServiceRegionPriceWhereInput = {
      deletedAt: null,
      region: region || undefined,
      category,
      serviceId: query.serviceId || undefined,
      status: status ?? (orderEntryOnly ? 'active' : undefined),
      service: orderEntryOnly
        ? {
            deletedAt: null,
            status: 'enabled'
          }
        : {
            deletedAt: null
          }
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleServiceRegionPrice.findMany({
        where,
        include: this.getRegionPriceInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ region: 'asc' }, { category: 'asc' }, { serviceName: 'asc' }]
      }),
      this.prisma.appleServiceRegionPrice.count({ where })
    ]);

    return {
      items: items.map((price) => this.toRegionPriceResponse(price)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async listOrderOptions() {
    const prices = await this.prisma.appleServiceRegionPrice.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        service: {
          deletedAt: null,
          status: 'enabled'
        }
      },
      include: this.getRegionPriceInclude(),
      orderBy: [{ region: 'asc' }, { category: 'asc' }, { serviceName: 'asc' }]
    });

    return {
      items: prices.map((price) => this.toRegionPriceResponse(price))
    };
  }

  async upsertRegionPriceFromOfficial(input: UpsertAppleServiceRegionPriceInput) {
    const region = this.normalizeCode(input.region, 'US', true);
    const currency = this.normalizeCode(input.currency, 'USD', true);
    const regionPriceKey = this.buildRegionPriceKey(input.serviceId, region, currency);
    if (await this.isRegionPriceAutoRestoreBlocked(regionPriceKey)) {
      return null;
    }

    const officialPrice = new PrismaNamespace.Decimal(input.officialPrice);
    const appleBalancePrice = new PrismaNamespace.Decimal(
      input.appleBalancePrice ?? input.officialPrice
    );

    const price = await this.prisma.appleServiceRegionPrice.upsert({
      where: {
        serviceId_region_currency: {
          serviceId: input.serviceId,
          region,
          currency
        }
      },
      update: {
        sourceSnapshotId: input.sourceSnapshotId ?? null,
        provider: input.provider || 'official_web',
        serviceName: input.serviceName.trim(),
        category: this.normalizeCategory(input.category),
        officialPrice,
        appleBalancePrice,
        periodType: input.periodType,
        periodValue: input.periodValue,
        status: input.status ?? 'active',
        collectedAt: input.collectedAt ?? null,
        confirmedAt: input.confirmedAt ?? new Date(),
        deletedAt: null,
        remark: this.normalizeNullableString(input.remark)
      },
      create: {
        serviceId: input.serviceId,
        sourceSnapshotId: input.sourceSnapshotId ?? null,
        provider: input.provider || 'official_web',
        serviceName: input.serviceName.trim(),
        category: this.normalizeCategory(input.category),
        region,
        currency,
        officialPrice,
        appleBalancePrice,
        periodType: input.periodType,
        periodValue: input.periodValue,
        status: input.status ?? 'active',
        collectedAt: input.collectedAt ?? null,
        confirmedAt: input.confirmedAt ?? new Date(),
        remark: this.normalizeNullableString(input.remark)
      },
      include: this.getRegionPriceInclude()
    });

    this.clearListCaches();
    return this.toRegionPriceResponse(price);
  }

  async removeRegionPrice(id: string, operator?: AuthenticatedUser) {
    const priceId = this.normalizeRequiredId(id, 'id');
    const price = await this.prisma.appleServiceRegionPrice.findFirst({
      where: { id: priceId, deletedAt: null },
      include: this.getRegionPriceInclude()
    });

    if (!price) {
      throw new NotFoundException('Apple service region price not found');
    }

    const deletedKey = this.buildRegionPriceKey(price.serviceId, price.region, price.currency);
    const blockedKeys = await this.getBlockedRegionPriceAutoRestoreKeys();
    blockedKeys.add(deletedKey);
    const blockedValue = this.toAuditJson({ keys: [...blockedKeys].sort() });

    await this.prisma.$transaction([
      this.prisma.systemParameter.upsert({
        where: { key: DELETED_REGION_PRICE_KEYS_PARAMETER },
        update: {
          value: blockedValue,
          group: 'apple_service',
          remark: 'Apple ID 当前价格表手动删除记录，阻止旧价格自动恢复',
          updatedByUserId: operator?.id
        },
        create: {
          key: DELETED_REGION_PRICE_KEYS_PARAMETER,
          value: blockedValue,
          group: 'apple_service',
          remark: 'Apple ID 当前价格表手动删除记录，阻止旧价格自动恢复',
          updatedByUserId: operator?.id
        }
      }),
      this.prisma.appleServiceRegionPrice.delete({ where: { id: price.id } })
    ]);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.region_price.delete',
      objectType: 'apple_service_region_price',
      objectId: price.id,
      beforeData: this.toAuditJson(this.toRegionPriceResponse(price)),
      remark: `Deleted Apple service region price ${price.serviceName} ${price.region}/${price.currency}`
    });

    this.clearListCaches();
    return { deleted: true };
  }

  async create(dto: CreateAppleServiceDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');
    const data = await this.buildCreateData(dto, operator);
    const service = await this.prisma.appleService.create({ data });
    await this.syncServiceRegionPricesFromService(service);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.create',
      objectType: 'apple_service',
      objectId: service.id,
      afterData: this.toAuditJson(this.toResponse(service)),
      remark: `Created Apple service ${service.name}`
    });

    this.clearListCaches();

    return this.get(service.id);
  }

  async update(id: string, dto: UpdateAppleServiceDto, operator?: AuthenticatedUser) {
    const existingService = await this.prisma.appleService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existingService) {
      throw new NotFoundException('Apple service not found');
    }

    const data = await this.buildUpdateData(dto, existingService, operator);
    const updatedService = await this.prisma.appleService.update({
      where: { id },
      data
    });
    await this.syncServiceRegionPricesFromService(updatedService);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.update',
      objectType: 'apple_service',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingService)),
      afterData: this.toAuditJson(dto),
      remark: `Updated Apple service ${existingService.name}`
    });

    this.clearListCaches();

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingService = await this.prisma.appleService.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existingService) {
      throw new NotFoundException('Apple service not found');
    }

    await this.prisma.appleService.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByUserId: operator?.id
      }
    });
    await this.prisma.appleServiceRegionPrice.updateMany({
      where: {
        serviceId: id,
        deletedAt: null
      },
      data: {
        status: 'disabled',
        deletedAt: new Date()
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.delete',
      objectType: 'apple_service',
      objectId: id,
      beforeData: this.toAuditJson(this.toResponse(existingService)),
      remark: `Deleted Apple service ${existingService.name}`
    });

    this.clearListCaches();

    return { deleted: true };
  }

  async getBalancePriceRule() {
    return this.getGlobalBalancePriceRule();
  }

  async updateBalancePriceRule(dto: SaveAppleBalancePriceRuleDto, operator?: AuthenticatedUser) {
    const rule = this.normalizeGlobalBalancePriceRule(dto);
    const previous = await this.prisma.systemParameter.findUnique({
      where: { key: APPLE_BALANCE_PRICE_RULE_PARAMETER_KEY }
    });
    const parameter = await this.prisma.systemParameter.upsert({
      where: { key: APPLE_BALANCE_PRICE_RULE_PARAMETER_KEY },
      update: {
        value: this.toAuditJson(rule),
        group: 'apple',
        remark: 'Apple 余额开通价全局计算规则',
        updatedByUserId: operator?.id
      },
      create: {
        key: APPLE_BALANCE_PRICE_RULE_PARAMETER_KEY,
        value: this.toAuditJson(rule),
        group: 'apple',
        remark: 'Apple 余额开通价全局计算规则',
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.balance_price_rule.update',
      objectType: 'system_parameter',
      objectId: parameter.id,
      beforeData: previous ? this.toAuditJson(previous.value) : undefined,
      afterData: this.toAuditJson(rule),
      remark: 'Updated Apple balance price global rule'
    });

    this.clearListCaches();
    return rule;
  }

  async listPlatformMappings(serviceId: string) {
    return this.mappingListCache.getOrSet(
      getListCacheKey('apple-service-platform-mappings', { serviceId }),
      APPLE_SERVICE_PLATFORM_MAPPING_CACHE_TTL_MS,
      () => this.listPlatformMappingsUncached(serviceId)
    );
  }

  private async listPlatformMappingsUncached(serviceId: string) {
    await this.assertServiceExists(serviceId);
    const mappings = await this.prisma.appleServicePlatformMapping.findMany({
      where: { serviceId },
      include: this.getPlatformMappingInclude(),
      orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }]
    });

    return {
      items: mappings.map((mapping) => this.toPlatformMappingResponse(mapping))
    };
  }

  async createPlatformMapping(
    serviceId: string,
    dto: CreateAppleServicePlatformMappingDto,
    operator?: AuthenticatedUser
  ) {
    await this.assertServiceExists(serviceId);
    const data = await this.buildPlatformMappingCreateData(serviceId, dto);

    await this.assertPlatformMappingAvailable({
      serviceId: data.serviceId,
      sourcePlatformId: data.sourcePlatformId,
      platformItemId: data.platformItemId,
      platformSkuId: data.platformSkuId
    });

    const mapping = await this.prisma.appleServicePlatformMapping.create({
      data,
      include: this.getPlatformMappingInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.platform_mapping.create',
      objectType: 'apple_service_platform_mapping',
      objectId: mapping.id,
      afterData: this.toAuditJson(this.toPlatformMappingResponse(mapping)),
      remark: `Created Apple service platform mapping ${mapping.id}`
    });

    this.mappingListCache.clear();

    return this.toPlatformMappingResponse(mapping);
  }

  async updatePlatformMapping(
    id: string,
    dto: UpdateAppleServicePlatformMappingDto,
    operator?: AuthenticatedUser
  ) {
    const existingMapping = await this.findPlatformMappingOrThrow(id);
    const data = await this.buildPlatformMappingUpdateData(dto);
    const nextSourcePlatformId =
      typeof data.sourcePlatformId === 'string'
        ? data.sourcePlatformId
        : existingMapping.sourcePlatformId;
    const nextPlatformItemId =
      typeof data.platformItemId === 'string'
        ? data.platformItemId
        : existingMapping.platformItemId;
    const nextPlatformSkuId =
      typeof data.platformSkuId === 'string' ? data.platformSkuId : existingMapping.platformSkuId;

    await this.assertPlatformMappingAvailable(
      {
        serviceId: existingMapping.serviceId,
        sourcePlatformId: nextSourcePlatformId,
        platformItemId: nextPlatformItemId,
        platformSkuId: nextPlatformSkuId
      },
      id
    );

    const mapping = await this.prisma.appleServicePlatformMapping.update({
      where: { id },
      data,
      include: this.getPlatformMappingInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.platform_mapping.update',
      objectType: 'apple_service_platform_mapping',
      objectId: id,
      beforeData: this.toAuditJson(this.toPlatformMappingResponse(existingMapping)),
      afterData: this.toAuditJson(dto),
      remark: `Updated Apple service platform mapping ${id}`
    });

    this.mappingListCache.clear();

    return this.toPlatformMappingResponse(mapping);
  }

  async removePlatformMapping(id: string, operator?: AuthenticatedUser) {
    const existingMapping = await this.findPlatformMappingOrThrow(id);

    await this.prisma.appleServicePlatformMapping.delete({
      where: { id }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_service',
      action: 'apple_service.platform_mapping.delete',
      objectType: 'apple_service_platform_mapping',
      objectId: id,
      beforeData: this.toAuditJson(this.toPlatformMappingResponse(existingMapping)),
      remark: `Deleted Apple service platform mapping ${id}`
    });

    this.mappingListCache.clear();

    return { deleted: true };
  }

  private clearListCaches() {
    this.listCache.clear();
    this.mappingListCache.clear();
  }

  private buildOrderBy(
    query: ListAppleServicesQuery
  ): Prisma.AppleServiceOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? APPLE_SERVICE_SORT_FIELDS[query.sortBy] : undefined;

    if (!sortField || !sortOrder) {
      return [{ status: 'asc' }, { createdAt: 'desc' }];
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

  private async buildPlatformMappingCreateData(
    serviceId: string,
    dto: CreateAppleServicePlatformMappingDto
  ) {
    const sourcePlatformId = this.normalizeRequiredId(dto.sourcePlatformId, 'sourcePlatformId');
    await this.assertSourcePlatformAvailable(sourcePlatformId);

    return {
      serviceId,
      sourcePlatformId,
      shopName: this.normalizeNullableString(dto.shopName),
      platformItemId: this.normalizeRequiredString(dto.platformItemId, 'platformItemId'),
      platformSkuId: this.normalizeOptionalCode(dto.platformSkuId),
      skuKeyword: this.normalizeNullableString(dto.skuKeyword),
      platformPrice: this.normalizeDecimal(dto.platformPrice, 'platformPrice', '0'),
      platformFeeType: this.parsePlatformFeeType(dto.platformFeeType, true) ?? 'none',
      platformFeeValue: this.normalizeDecimal(dto.platformFeeValue, 'platformFeeValue', '0'),
      allowAutoOrder: Boolean(dto.allowAutoOrder),
      enabled: dto.enabled ?? true
    } satisfies Prisma.AppleServicePlatformMappingUncheckedCreateInput;
  }

  private async buildPlatformMappingUpdateData(dto: UpdateAppleServicePlatformMappingDto) {
    const data: Prisma.AppleServicePlatformMappingUncheckedUpdateInput = {};

    if (dto.sourcePlatformId !== undefined) {
      const sourcePlatformId = this.normalizeRequiredId(dto.sourcePlatformId, 'sourcePlatformId');
      await this.assertSourcePlatformAvailable(sourcePlatformId);
      data.sourcePlatformId = sourcePlatformId;
    }

    if (dto.shopName !== undefined) {
      data.shopName = this.normalizeNullableString(dto.shopName);
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

    if (dto.platformPrice !== undefined) {
      data.platformPrice = this.normalizeDecimal(dto.platformPrice, 'platformPrice', '0');
    }

    if (dto.platformFeeType !== undefined) {
      data.platformFeeType = this.parsePlatformFeeType(dto.platformFeeType, true);
    }

    if (dto.platformFeeValue !== undefined) {
      data.platformFeeValue = this.normalizeDecimal(dto.platformFeeValue, 'platformFeeValue', '0');
    }

    if (dto.allowAutoOrder !== undefined) {
      data.allowAutoOrder = Boolean(dto.allowAutoOrder);
    }

    if (dto.enabled !== undefined) {
      data.enabled = Boolean(dto.enabled);
    }

    return data;
  }

  private async buildCreatePriceData(dto: CreateAppleServiceDto) {
    const officialBasePrice = this.normalizeDecimal(
      dto.officialBasePrice ?? dto.officialCostValue,
      'officialBasePrice',
      '0'
    );
    const ruleType =
      this.parseBalancePriceRuleType(dto.appleBalancePriceRuleType, true) ??
      (dto.officialBasePrice !== undefined ? 'inherit' : 'manual');
    const ruleValue = this.normalizeBalancePriceRuleValue(dto.appleBalancePriceRuleValue, ruleType);
    const officialCostValue = await this.calculateAppleBalancePrice({
      officialBasePrice,
      ruleType,
      ruleValue,
      manualPrice: dto.officialCostValue
    });

    return {
      officialBasePrice,
      officialCostValue,
      appleBalancePriceRuleType: ruleType,
      appleBalancePriceRuleValue: ruleValue
    };
  }

  private async buildUpdatePriceData(dto: UpdateAppleServiceDto, existingService: AppleService) {
    const ruleType =
      this.parseBalancePriceRuleType(dto.appleBalancePriceRuleType, true) ??
      existingService.appleBalancePriceRuleType;
    const officialBasePrice =
      dto.officialBasePrice !== undefined
        ? this.normalizeDecimal(dto.officialBasePrice, 'officialBasePrice', '0')
        : existingService.officialBasePrice.toString();
    const ruleValue =
      dto.appleBalancePriceRuleValue !== undefined
        ? this.normalizeBalancePriceRuleValue(dto.appleBalancePriceRuleValue, ruleType)
        : (existingService.appleBalancePriceRuleValue?.toString() ?? null);
    const officialCostValue = await this.calculateAppleBalancePrice({
      officialBasePrice,
      ruleType,
      ruleValue,
      manualPrice: dto.officialCostValue ?? existingService.officialCostValue.toString()
    });

    return {
      officialBasePrice,
      officialCostValue,
      appleBalancePriceRuleType: ruleType,
      appleBalancePriceRuleValue: ruleValue
    };
  }

  private async calculateAppleBalancePrice(input: {
    officialBasePrice: string;
    ruleType: AppleBalancePriceRuleType;
    ruleValue: string | null;
    manualPrice?: string | number | null;
  }) {
    const officialBasePrice = new PrismaNamespace.Decimal(input.officialBasePrice);

    if (input.ruleType === 'manual') {
      return this.normalizeDecimal(
        input.manualPrice ?? input.officialBasePrice,
        'officialCostValue',
        '0'
      );
    }

    const effectiveRule =
      input.ruleType === 'inherit'
        ? await this.getGlobalBalancePriceRule()
        : { ruleType: input.ruleType, ruleValue: input.ruleValue };

    if (effectiveRule.ruleType === 'fixed_add') {
      return officialBasePrice.plus(effectiveRule.ruleValue ?? '0').toFixed();
    }

    if (effectiveRule.ruleType === 'percent') {
      return officialBasePrice.mul(effectiveRule.ruleValue ?? '1').toFixed();
    }

    return officialBasePrice.toFixed();
  }

  private normalizeGlobalBalancePriceRule(dto: SaveAppleBalancePriceRuleDto) {
    const ruleType = this.parseBalancePriceRuleType(dto.ruleType, true) ?? 'percent';
    if (ruleType !== 'percent' && ruleType !== 'fixed_add') {
      throw new BadRequestException('Global balance price rule must be percent or fixed_add');
    }

    return {
      ruleType,
      ruleValue:
        this.normalizeBalancePriceRuleValue(
          dto.ruleValue ?? (ruleType === 'percent' ? '1' : '0'),
          ruleType
        ) ?? '1'
    };
  }

  private async getGlobalBalancePriceRule(): Promise<{
    ruleType: AppleBalancePriceRuleType;
    ruleValue: string;
  }> {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: APPLE_BALANCE_PRICE_RULE_PARAMETER_KEY }
    });
    const value = this.isJsonRecord(parameter?.value) ? parameter.value : {};
    const ruleType =
      this.parseBalancePriceRuleType(value.ruleType, false) ?? DEFAULT_BALANCE_PRICE_RULE.ruleType;
    const normalizedRuleType =
      ruleType === 'percent' || ruleType === 'fixed_add'
        ? ruleType
        : DEFAULT_BALANCE_PRICE_RULE.ruleType;

    const rawRuleValue = value.ruleValue as string | number | null | undefined;

    return {
      ruleType: normalizedRuleType,
      ruleValue:
        rawRuleValue === undefined || rawRuleValue === null || rawRuleValue === ''
          ? normalizedRuleType === 'fixed_add'
            ? '0'
            : DEFAULT_BALANCE_PRICE_RULE.ruleValue
          : (this.normalizeBalancePriceRuleValue(rawRuleValue, normalizedRuleType) ??
            DEFAULT_BALANCE_PRICE_RULE.ruleValue)
    };
  }

  private normalizeBalancePriceRuleValue(
    value: string | number | null | undefined,
    ruleType: AppleBalancePriceRuleType
  ) {
    if (ruleType === 'inherit' || ruleType === 'manual') {
      return null;
    }

    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('appleBalancePriceRuleValue is required');
    }

    return this.normalizeDecimal(value, 'appleBalancePriceRuleValue', '0');
  }

  private async assertServiceExists(id: string) {
    const service = await this.prisma.appleService.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!service) {
      throw new NotFoundException('Apple service not found');
    }
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

  private async assertPlatformMappingAvailable(
    mapping: {
      serviceId: string;
      sourcePlatformId: string;
      platformItemId: string;
      platformSkuId: string;
    },
    currentId?: string
  ) {
    const existingMapping = await this.prisma.appleServicePlatformMapping.findFirst({
      where: {
        serviceId: mapping.serviceId,
        sourcePlatformId: mapping.sourcePlatformId,
        platformItemId: mapping.platformItemId,
        platformSkuId: mapping.platformSkuId,
        id: currentId ? { not: currentId } : undefined
      },
      select: { id: true }
    });

    if (existingMapping) {
      throw new ConflictException('Apple service platform mapping already exists');
    }
  }

  private async findPlatformMappingOrThrow(id: string) {
    const mapping = await this.prisma.appleServicePlatformMapping.findUnique({
      where: { id },
      include: this.getPlatformMappingInclude()
    });

    if (!mapping) {
      throw new NotFoundException('Apple service platform mapping not found');
    }

    return mapping;
  }

  private getPlatformMappingInclude() {
    return {
      sourcePlatform: {
        select: {
          id: true,
          name: true,
          feeRate: true,
          feeFixed: true,
          status: true
        }
      }
    } satisfies Prisma.AppleServicePlatformMappingInclude;
  }

  private getRegionPriceInclude() {
    return {
      service: true,
      sourceSnapshot: {
        select: {
          id: true,
          provider: true,
          collectedAt: true
        }
      }
    } satisfies Prisma.AppleServiceRegionPriceInclude;
  }

  private async buildCreateData(dto: CreateAppleServiceDto, operator?: AuthenticatedUser) {
    const priceData = await this.buildCreatePriceData(dto);
    return {
      name: dto.name.trim(),
      category: this.normalizeCategory(dto.category),
      defaultPrice: this.normalizeDecimal(dto.defaultPrice, 'defaultPrice', '0'),
      officialBasePrice: priceData.officialBasePrice,
      officialCostValue: priceData.officialCostValue,
      appleBalancePriceRuleType: priceData.appleBalancePriceRuleType,
      appleBalancePriceRuleValue: priceData.appleBalancePriceRuleValue,
      currency: this.normalizeCode(dto.currency, 'USD', true),
      defaultPeriodType: this.parsePeriodType(dto.defaultPeriodType, true) ?? 'month',
      defaultPeriodValue: this.normalizePositiveInteger(
        dto.defaultPeriodValue,
        'defaultPeriodValue',
        1
      ),
      expireCalcType: this.parseExpireCalcType(dto.expireCalcType, true) ?? 'by_month',
      requireAppleId: dto.requireAppleId ?? true,
      requireServiceAccount: dto.requireServiceAccount ?? true,
      autoMatchAppleId: dto.autoMatchAppleId ?? true,
      lockRule: this.parseLockRule(dto.lockRule, true) ?? 'by_service',
      allowedRegions: this.normalizeRegions(dto.allowedRegions),
      minBalanceRequired: this.normalizeDecimal(dto.minBalanceRequired, 'minBalanceRequired', '0'),
      status: this.parseStatus(dto.status, true) ?? 'enabled',
      remark: this.normalizeNullableString(dto.remark),
      createdByUserId: operator?.id,
      updatedByUserId: operator?.id
    } satisfies Prisma.AppleServiceUncheckedCreateInput;
  }

  private async buildUpdateData(
    dto: UpdateAppleServiceDto,
    existingService: AppleService,
    operator?: AuthenticatedUser
  ) {
    const data: Prisma.AppleServiceUpdateInput = {
      updatedBy: operator?.id ? { connect: { id: operator.id } } : undefined
    };

    if (dto.name !== undefined) {
      this.assertRequiredString(dto.name, 'name');
      data.name = dto.name.trim();
    }

    if (dto.category !== undefined) {
      data.category = this.normalizeCategory(dto.category);
    }

    if (dto.defaultPrice !== undefined) {
      data.defaultPrice = this.normalizeDecimal(dto.defaultPrice, 'defaultPrice', '0');
    }

    const shouldUpdatePrice =
      dto.officialBasePrice !== undefined ||
      dto.officialCostValue !== undefined ||
      dto.appleBalancePriceRuleType !== undefined ||
      dto.appleBalancePriceRuleValue !== undefined;
    if (shouldUpdatePrice) {
      const priceData = await this.buildUpdatePriceData(dto, existingService);
      data.officialBasePrice = priceData.officialBasePrice;
      data.officialCostValue = priceData.officialCostValue;
      data.appleBalancePriceRuleType = priceData.appleBalancePriceRuleType;
      data.appleBalancePriceRuleValue = priceData.appleBalancePriceRuleValue;
    }

    if (dto.currency !== undefined) {
      data.currency = this.normalizeCode(dto.currency, 'USD', true);
    }

    if (dto.defaultPeriodType !== undefined) {
      data.defaultPeriodType = this.parsePeriodType(dto.defaultPeriodType, true);
    }

    if (dto.defaultPeriodValue !== undefined) {
      data.defaultPeriodValue = this.normalizePositiveInteger(
        dto.defaultPeriodValue,
        'defaultPeriodValue',
        1
      );
    }

    if (dto.expireCalcType !== undefined) {
      data.expireCalcType = this.parseExpireCalcType(dto.expireCalcType, true);
    }

    if (dto.requireAppleId !== undefined) {
      data.requireAppleId = dto.requireAppleId;
    }

    if (dto.requireServiceAccount !== undefined) {
      data.requireServiceAccount = dto.requireServiceAccount;
    }

    if (dto.autoMatchAppleId !== undefined) {
      data.autoMatchAppleId = dto.autoMatchAppleId;
    }

    if (dto.lockRule !== undefined) {
      data.lockRule = this.parseLockRule(dto.lockRule, true);
    }

    if (dto.allowedRegions !== undefined) {
      data.allowedRegions = this.normalizeRegions(dto.allowedRegions);
    }

    if (dto.minBalanceRequired !== undefined) {
      data.minBalanceRequired = this.normalizeDecimal(
        dto.minBalanceRequired,
        'minBalanceRequired',
        '0'
      );
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    return data;
  }

  private async syncServiceRegionPricesFromService(service: AppleService) {
    const allowedRegions = Array.isArray(service.allowedRegions) ? service.allowedRegions : [];
    if (!allowedRegions.length) {
      return;
    }

    const blockedKeys = await this.getBlockedRegionPriceAutoRestoreKeys();
    const regionsToSync = allowedRegions.filter(
      (region) => !blockedKeys.has(this.buildRegionPriceKey(service.id, region, service.currency))
    );
    if (!regionsToSync.length) {
      return;
    }

    const status: AppleServiceRegionPriceStatus =
      service.status === 'disabled' ? 'disabled' : 'active';
    const confirmedAt = new Date();

    await this.prisma.$transaction(
      regionsToSync.map((region) =>
        this.prisma.appleServiceRegionPrice.upsert({
          where: {
            serviceId_region_currency: {
              serviceId: service.id,
              region,
              currency: service.currency
            }
          },
          update: {
            provider: 'service_setting',
            serviceName: service.name,
            category: service.category,
            officialPrice: service.officialBasePrice,
            appleBalancePrice: service.officialCostValue,
            periodType: service.defaultPeriodType,
            periodValue: service.defaultPeriodValue,
            status,
            confirmedAt,
            deletedAt: null,
            remark: '由 Apple ID 业务设置同步'
          },
          create: {
            serviceId: service.id,
            provider: 'service_setting',
            serviceName: service.name,
            category: service.category,
            region,
            currency: service.currency,
            officialPrice: service.officialBasePrice,
            appleBalancePrice: service.officialCostValue,
            periodType: service.defaultPeriodType,
            periodValue: service.defaultPeriodValue,
            status,
            confirmedAt,
            remark: '由 Apple ID 业务设置同步'
          }
        })
      )
    );
  }

  private buildRegionPriceKey(serviceId: string, region: string, currency: string) {
    return `${serviceId}:${region.trim().toUpperCase()}:${currency.trim().toUpperCase()}`;
  }

  private async isRegionPriceAutoRestoreBlocked(key: string) {
    const blockedKeys = await this.getBlockedRegionPriceAutoRestoreKeys();
    return blockedKeys.has(key);
  }

  private async getBlockedRegionPriceAutoRestoreKeys() {
    const parameter = await this.prisma.systemParameter.findUnique({
      where: { key: DELETED_REGION_PRICE_KEYS_PARAMETER },
      select: { value: true }
    });
    return this.parseStringSetParameter(parameter?.value);
  }

  private parseStringSetParameter(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return new Set<string>();
    }

    const keys = (value as { keys?: unknown }).keys;
    if (!Array.isArray(keys)) {
      return new Set<string>();
    }

    return new Set(keys.filter((key): key is string => typeof key === 'string' && key.length > 0));
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

  private normalizeRequiredId(value: unknown, field: string) {
    this.assertRequiredString(value, field);
    const normalized = value.trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
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

  private normalizeOptionalCode(value: string | null | undefined) {
    return this.normalizeNullableString(value) ?? '';
  }

  private normalizeCode(value: string | undefined, fallback: string, upperCase: boolean) {
    const normalized = (value || fallback).trim();
    const formatted = upperCase ? normalized.toUpperCase() : normalized.toLowerCase();

    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(formatted)) {
      throw new BadRequestException('Invalid code format');
    }

    return formatted;
  }

  private normalizeCategory(value: string | undefined) {
    const normalized = (value || '通用').trim();
    const formatted = normalized === 'default' ? '通用' : normalized;

    if (formatted.length > 40 || !/^[\p{L}\p{N}_\-\s]+$/u.test(formatted)) {
      throw new BadRequestException('Invalid category format');
    }

    return formatted;
  }

  private normalizeCategoryFilter(
    value: string | undefined
  ): Prisma.StringFilter | string | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized === '通用' || normalized === 'default') {
      return { in: ['通用', 'default'] };
    }

    return normalized;
  }

  private normalizeRegions(regions?: string[]) {
    return [
      ...new Set((regions ?? []).map((region) => region.trim().toUpperCase()).filter(Boolean))
    ];
  }

  private normalizePositiveInteger(value: number | undefined, field: string, fallback: number) {
    const normalized = value ?? fallback;

    if (!Number.isInteger(normalized) || normalized < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return normalized;
  }

  private normalizeDecimal(value: string | number | undefined, field: string, fallback: string) {
    const normalized = value === undefined || value === '' ? fallback : String(value).trim();

    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return normalized;
  }

  private parsePlatformFeeType(
    value: string | undefined,
    strict: boolean
  ): AppleServicePlatformFeeType | undefined {
    if (!value) {
      return undefined;
    }

    if (value === 'none' || value === 'rate' || value === 'fixed' || value === 'mixed') {
      return value;
    }

    if (strict) {
      throw new BadRequestException('Invalid platform fee type');
    }

    return undefined;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'enabled' || value === 'paused' || value === 'disabled') {
      return value satisfies AppleServiceStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple service status');
    }

    return undefined;
  }

  private parseRegionPriceStatus(
    value?: string,
    strict = false
  ): AppleServiceRegionPriceStatus | undefined {
    if (!value) {
      return undefined;
    }

    if (value === 'active' || value === 'disabled' || value === 'needs_review') {
      return value;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple service region price status');
    }

    return undefined;
  }

  private parsePeriodType(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'month' || value === 'day' || value === 'manual') {
      return value satisfies AppleServicePeriodType;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple service period type');
    }

    return undefined;
  }

  private parseExpireCalcType(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'by_month' || value === 'by_day' || value === 'manual') {
      return value satisfies AppleServiceExpireCalcType;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple service expire calc type');
    }

    return undefined;
  }

  private parseLockRule(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'by_service' || value === 'global') {
      return value satisfies AppleServiceLockRule;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple service lock rule');
    }

    return undefined;
  }

  private parseBalancePriceRuleType(value: unknown, strict: true): AppleBalancePriceRuleType;
  private parseBalancePriceRuleType(
    value: unknown,
    strict?: false
  ): AppleBalancePriceRuleType | undefined;
  private parseBalancePriceRuleType(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'inherit' || value === 'percent' || value === 'fixed_add' || value === 'manual') {
      return value;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple balance price rule type');
    }

    return undefined;
  }

  private isJsonRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(service: AppleService) {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      defaultPrice: service.defaultPrice.toString(),
      officialBasePrice: service.officialBasePrice.toString(),
      officialCostValue: service.officialCostValue.toString(),
      appleBalancePriceRuleType: service.appleBalancePriceRuleType,
      appleBalancePriceRuleValue: service.appleBalancePriceRuleValue?.toString() ?? null,
      currency: service.currency,
      defaultPeriodType: service.defaultPeriodType,
      defaultPeriodValue: service.defaultPeriodValue,
      expireCalcType: service.expireCalcType,
      requireAppleId: service.requireAppleId,
      requireServiceAccount: service.requireServiceAccount,
      autoMatchAppleId: service.autoMatchAppleId,
      lockRule: service.lockRule,
      allowedRegions: Array.isArray(service.allowedRegions) ? service.allowedRegions : [],
      minBalanceRequired: service.minBalanceRequired.toString(),
      status: service.status,
      remark: service.remark,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
  }

  private toRegionPriceResponse(price: AppleServiceRegionPriceWithRelations) {
    return {
      id: price.id,
      serviceId: price.serviceId,
      sourceSnapshotId: price.sourceSnapshotId,
      sourceSnapshot: price.sourceSnapshot,
      provider: price.provider,
      serviceName: price.serviceName,
      category: price.category,
      region: price.region,
      currency: price.currency,
      officialPrice: price.officialPrice.toString(),
      appleBalancePrice: price.appleBalancePrice.toString(),
      periodType: price.periodType,
      periodValue: price.periodValue,
      status: price.status,
      collectedAt: price.collectedAt,
      confirmedAt: price.confirmedAt,
      remark: price.remark,
      service: this.toResponse(price.service),
      createdAt: price.createdAt,
      updatedAt: price.updatedAt
    };
  }

  private toPlatformMappingResponse(mapping: AppleServicePlatformMappingWithRelations) {
    return {
      id: mapping.id,
      serviceId: mapping.serviceId,
      sourcePlatformId: mapping.sourcePlatformId,
      sourcePlatform: {
        id: mapping.sourcePlatform.id,
        name: mapping.sourcePlatform.name,
        feeRate: mapping.sourcePlatform.feeRate.toString(),
        feeFixed: mapping.sourcePlatform.feeFixed.toString(),
        status: mapping.sourcePlatform.status
      },
      shopName: mapping.shopName,
      platformItemId: mapping.platformItemId,
      platformSkuId: mapping.platformSkuId,
      skuKeyword: mapping.skuKeyword,
      platformPrice: mapping.platformPrice.toString(),
      platformFeeType: mapping.platformFeeType,
      platformFeeValue: mapping.platformFeeValue.toString(),
      allowAutoOrder: mapping.allowAutoOrder,
      enabled: mapping.enabled,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt
    };
  }
}
