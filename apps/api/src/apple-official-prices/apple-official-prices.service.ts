import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppleOfficialPriceCollectMethod,
  AppleOfficialPriceSnapshot,
  AppleOfficialPriceSource,
  AppleOfficialPriceSourceStatus,
  ApplePriceChangeReview,
  ApplePriceChangeReviewStatus,
  ApplePriceChangeType,
  AppleService,
  AppleServicePeriodType,
  Prisma
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleServicesService } from '../apple-services/apple-services.service';
import type {
  CheckOfficialPriceSourceDto,
  OfficialPriceCollectedItemDto
} from './dto/check-official-price-source.dto';
import type { CreateOfficialPriceSourceDto } from './dto/create-official-price-source.dto';
import type { UpdateOfficialPriceSourceDto } from './dto/update-official-price-source.dto';

interface ListSourcesQuery extends PaginationQuery {
  keyword?: string;
  provider?: string;
  region?: string;
  currency?: string;
  collectMethod?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListSnapshotsQuery extends PaginationQuery {
  sourceId?: string;
  appleServiceId?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListReviewsQuery extends PaginationQuery {
  sourceId?: string;
  appleServiceId?: string;
  status?: string;
  changeType?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

type OfficialPriceSourceWithUsers = AppleOfficialPriceSource & {
  createdBy?: UserSnapshot | null;
  updatedBy?: UserSnapshot | null;
};

type OfficialPriceSnapshotWithRelations = AppleOfficialPriceSnapshot & {
  source?: Pick<
    AppleOfficialPriceSource,
    'id' | 'name' | 'provider' | 'region' | 'currency'
  > | null;
  appleService?: Pick<AppleService, 'id' | 'name' | 'category' | 'currency'> | null;
};

type PriceChangeReviewWithRelations = ApplePriceChangeReview & {
  source?: Pick<
    AppleOfficialPriceSource,
    'id' | 'name' | 'provider' | 'region' | 'currency'
  > | null;
  snapshot?: Pick<
    AppleOfficialPriceSnapshot,
    | 'id'
    | 'provider'
    | 'planCode'
    | 'serviceName'
    | 'region'
    | 'currency'
    | 'officialPrice'
    | 'appleBalancePrice'
    | 'collectedAt'
  > | null;
  appleService?: Pick<
    AppleService,
    | 'id'
    | 'name'
    | 'category'
    | 'currency'
    | 'officialBasePrice'
    | 'officialCostValue'
    | 'appleBalancePriceRuleType'
    | 'appleBalancePriceRuleValue'
    | 'defaultPeriodType'
    | 'defaultPeriodValue'
    | 'remark'
    | 'status'
  > | null;
  reviewedBy?: UserSnapshot | null;
};

export interface UserSnapshot {
  id: string;
  username: string;
  displayName: string;
}

interface NormalizedCollectedItem {
  appleServiceId?: string | null;
  provider: string;
  planCode?: string | null;
  serviceName: string;
  category: string;
  region: string;
  currency: string;
  officialPrice: string;
  periodType: AppleServicePeriodType;
  periodValue: number;
  rawPayload: Record<string, unknown> | null;
}

type JsonRecord = Record<string, unknown>;

const AUTO_COLLECT_LIMIT = 200;
const OFFICIAL_PRICE_FETCH_TIMEOUT_MS = 15_000;

const SOURCE_SORT_FIELDS: Record<
  string,
  keyof Prisma.AppleOfficialPriceSourceOrderByWithRelationInput
> = {
  name: 'name',
  provider: 'provider',
  region: 'region',
  currency: 'currency',
  collectMethod: 'collectMethod',
  status: 'status',
  lastCheckedAt: 'lastCheckedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

const SNAPSHOT_SORT_FIELDS: Record<
  string,
  keyof Prisma.AppleOfficialPriceSnapshotOrderByWithRelationInput
> = {
  serviceName: 'serviceName',
  region: 'region',
  currency: 'currency',
  officialPrice: 'officialPrice',
  collectedAt: 'collectedAt'
};

const REVIEW_SORT_FIELDS: Record<
  string,
  keyof Prisma.ApplePriceChangeReviewOrderByWithRelationInput
> = {
  changeType: 'changeType',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  reviewedAt: 'reviewedAt'
};

@Injectable()
export class AppleOfficialPricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly appleServicesService: AppleServicesService,
    private readonly realtimeService: RealtimeService
  ) {}

  async listSources(query: ListSourcesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const collectMethod = this.parseCollectMethod(query.collectMethod, false);
    const status = this.parseSourceStatus(query.status, false);
    const where: Prisma.AppleOfficialPriceSourceWhereInput = {
      deletedAt: null,
      provider: query.provider ? this.normalizeCode(query.provider, 'manual', false) : undefined,
      region: query.region ? query.region.trim().toUpperCase() : undefined,
      currency: query.currency ? query.currency.trim().toUpperCase() : undefined,
      collectMethod,
      status,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { provider: { contains: keyword, mode: 'insensitive' } },
            { region: { contains: keyword, mode: 'insensitive' } },
            { currency: { contains: keyword, mode: 'insensitive' } },
            { sourceUrl: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleOfficialPriceSource.findMany({
        where,
        include: this.getSourceInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildSourceOrderBy(query)
      }),
      this.prisma.appleOfficialPriceSource.count({ where })
    ]);

    return {
      items: items.map((item) => this.toSourceResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createSource(dto: CreateOfficialPriceSourceDto, operator?: AuthenticatedUser) {
    const data = this.buildSourceCreateData(dto, operator);
    const source = await this.prisma.appleOfficialPriceSource.create({
      data,
      include: this.getSourceInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_official_price',
      action: 'apple_official_price.source.create',
      objectType: 'apple_official_price_source',
      objectId: source.id,
      afterData: this.toJson(this.toSourceResponse(source)),
      remark: `Created Apple official price source ${source.name}`
    });

    this.publishChanged('apple.official_price.source_created', 'source', 'created', source.id);
    return this.toSourceResponse(source);
  }

  async updateSource(id: string, dto: UpdateOfficialPriceSourceDto, operator?: AuthenticatedUser) {
    const sourceId = this.normalizeRequiredUuid(id, 'id');
    const existing = await this.findSourceOrThrow(sourceId);
    const data = this.buildSourceUpdateData(dto, operator);
    const updated = await this.prisma.appleOfficialPriceSource.update({
      where: { id: sourceId },
      data,
      include: this.getSourceInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_official_price',
      action: 'apple_official_price.source.update',
      objectType: 'apple_official_price_source',
      objectId: sourceId,
      beforeData: this.toJson(this.toSourceResponse(existing)),
      afterData: this.toJson(dto),
      remark: `Updated Apple official price source ${existing.name}`
    });

    this.publishChanged('apple.official_price.source_updated', 'source', 'updated', sourceId);
    return this.toSourceResponse(updated);
  }

  async removeSource(id: string, operator?: AuthenticatedUser) {
    const sourceId = this.normalizeRequiredUuid(id, 'id');
    const existing = await this.findSourceOrThrow(sourceId);

    await this.prisma.appleOfficialPriceSource.update({
      where: { id: sourceId },
      data: {
        status: 'disabled',
        deletedAt: new Date(),
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_official_price',
      action: 'apple_official_price.source.delete',
      objectType: 'apple_official_price_source',
      objectId: sourceId,
      beforeData: this.toJson(this.toSourceResponse(existing)),
      remark: `Deleted Apple official price source ${existing.name}`
    });

    this.publishChanged('apple.official_price.source_deleted', 'source', 'deleted', sourceId);
    return { deleted: true };
  }

  async checkSource(
    id: string,
    dto: CheckOfficialPriceSourceDto = {},
    operator?: AuthenticatedUser
  ) {
    const sourceId = this.normalizeRequiredUuid(id, 'id');
    const source = await this.findSourceOrThrow(sourceId);
    const trigger = this.normalizeTrigger(dto.trigger);
    const startedAt = new Date();
    const task = await this.prisma.automationTask.create({
      data: {
        taskType: 'official_price_check',
        priority: 'medium',
        status: 'running',
        resultPayload: this.toJson({
          sourceId,
          sourceName: source.name,
          trigger,
          collectMethod: source.collectMethod
        }),
        queueJobId: this.createQueueJobId('official_price_check'),
        createdByUserId: operator?.id
      }
    });
    const cronLog = await this.prisma.cronJobLog.create({
      data: {
        jobName: `apple.official_price.${source.id}.check`,
        status: 'running',
        startedAt,
        metadata: this.toJson({
          sourceId,
          sourceName: source.name,
          trigger,
          collectMethod: source.collectMethod
        })
      }
    });

    try {
      let collectedItems = this.normalizeCollectedItems(dto.items, source);
      const attemptedAutoCollect = collectedItems.length === 0 && source.collectMethod !== 'manual';

      if (!collectedItems.length) {
        collectedItems = await this.collectSourceItems(source);
      }

      if (!collectedItems.length) {
        const message = this.buildCollectorUnavailableMessage(source, attemptedAutoCollect);
        const finishedAt = new Date();

        await this.prisma.$transaction([
          this.prisma.appleOfficialPriceSource.update({
            where: { id: source.id },
            data: { lastCheckedAt: finishedAt }
          }),
          this.prisma.automationTask.update({
            where: { id: task.id },
            data: {
              status: 'waiting_manual_verify',
              manualRequired: true,
              errorCode: 'official_price_collector_not_configured',
              errorMessage: message,
              finishedAt,
              resultPayload: this.toJson({
                sourceId,
                sourceName: source.name,
                collectMethod: source.collectMethod,
                message
              })
            }
          }),
          this.prisma.automationTaskLog.create({
            data: {
              taskId: task.id,
              level: 'warning',
              message,
              payload: this.toJson({
                sourceId,
                sourceName: source.name,
                collectMethod: source.collectMethod
              })
            }
          }),
          this.prisma.cronJobLog.update({
            where: { id: cronLog.id },
            data: {
              status: 'skipped',
              finishedAt,
              errorMessage: message,
              metadata: this.toJson({
                sourceId,
                sourceName: source.name,
                trigger,
                collectMethod: source.collectMethod,
                taskId: task.id,
                message
              })
            }
          })
        ]);

        this.publishChanged(
          'apple.official_price.check_manual_required',
          'official_price_check',
          'manual_required',
          task.id
        );

        return {
          status: 'manual_required' as const,
          taskId: task.id,
          source: this.toSourceResponse(source),
          snapshotCount: 0,
          reviewCount: 0,
          message
        };
      }

      const result = await this.persistCollectedItems({
        source,
        items: collectedItems,
        scanRemovedPlans: Boolean(dto.scanRemovedPlans),
        taskId: task.id,
        cronLogId: cronLog.id,
        startedAt,
        trigger,
        operator
      });

      await this.auditLogsService.create({
        userId: operator?.id,
        module: 'apple_official_price',
        action: 'apple_official_price.check',
        objectType: 'apple_official_price_source',
        objectId: source.id,
        afterData: this.toJson(result),
        remark: `Checked official prices for ${source.name}`
      });

      this.publishChanged(
        result.reviewCount > 0
          ? 'apple.official_price.review_created'
          : 'apple.official_price.check_completed',
        'official_price_check',
        result.reviewCount > 0 ? 'review_created' : 'checked',
        task.id,
        { pendingReviewCount: result.pendingReviewCount }
      );

      return {
        status: 'checked' as const,
        taskId: task.id,
        source: result.source,
        snapshotCount: result.snapshotCount,
        reviewCount: result.reviewCount,
        pendingReviewCount: result.pendingReviewCount,
        message:
          result.reviewCount > 0
            ? `发现 ${result.reviewCount} 条价格/套餐变化，等待人工确认`
            : '本次没有发现价格或套餐变化'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '官方价格巡检失败';
      const finishedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.automationTask.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            manualRequired: true,
            errorCode: 'official_price_check_failed',
            errorMessage: message,
            finishedAt
          }
        }),
        this.prisma.automationTaskLog.create({
          data: {
            taskId: task.id,
            level: 'error',
            message,
            payload: this.toJson({ sourceId, sourceName: source.name })
          }
        }),
        this.prisma.cronJobLog.update({
          where: { id: cronLog.id },
          data: {
            status: 'failed',
            finishedAt,
            errorMessage: message,
            metadata: this.toJson({ sourceId, sourceName: source.name, taskId: task.id, message })
          }
        })
      ]);

      throw error;
    }
  }

  async listSnapshots(query: ListSnapshotsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AppleOfficialPriceSnapshotWhereInput = {
      sourceId: query.sourceId ? this.normalizeRequiredUuid(query.sourceId, 'sourceId') : undefined,
      appleServiceId: query.appleServiceId
        ? this.normalizeRequiredUuid(query.appleServiceId, 'appleServiceId')
        : undefined,
      OR: keyword
        ? [
            { serviceName: { contains: keyword, mode: 'insensitive' } },
            { category: { contains: keyword, mode: 'insensitive' } },
            { region: { contains: keyword, mode: 'insensitive' } },
            { currency: { contains: keyword, mode: 'insensitive' } },
            { source: { name: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleOfficialPriceSnapshot.findMany({
        where,
        include: this.getSnapshotInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildSnapshotOrderBy(query)
      }),
      this.prisma.appleOfficialPriceSnapshot.count({ where })
    ]);

    return {
      items: items.map((item) => this.toSnapshotResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async listReviews(query: ListReviewsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseReviewStatus(query.status, false);
    const changeType = this.parseChangeType(query.changeType, false);
    const where: Prisma.ApplePriceChangeReviewWhereInput = {
      sourceId: query.sourceId ? this.normalizeRequiredUuid(query.sourceId, 'sourceId') : undefined,
      appleServiceId: query.appleServiceId
        ? this.normalizeRequiredUuid(query.appleServiceId, 'appleServiceId')
        : undefined,
      status,
      changeType,
      OR: keyword
        ? [
            { source: { name: { contains: keyword, mode: 'insensitive' } } },
            { snapshot: { serviceName: { contains: keyword, mode: 'insensitive' } } },
            { appleService: { name: { contains: keyword, mode: 'insensitive' } } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.applePriceChangeReview.findMany({
        where,
        include: this.getReviewInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildReviewOrderBy(query)
      }),
      this.prisma.applePriceChangeReview.count({ where })
    ]);

    return {
      items: items.map((item) => this.toReviewResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async approveReview(id: string, operator?: AuthenticatedUser) {
    const review = await this.findReviewOrThrow(id);
    if (review.status !== 'pending') {
      throw new ConflictException('Only pending official price review can be approved');
    }

    const newValue = this.parseReviewNewValue(review.newValue);
    let serviceId = review.appleServiceId;

    if (review.changeType === 'new_plan' || !review.appleServiceId) {
      const createdService = await this.appleServicesService.create(
        {
          name: newValue.serviceName,
          category: newValue.category,
          defaultPrice: '0',
          officialBasePrice: newValue.officialPrice,
          appleBalancePriceRuleType: 'inherit',
          currency: newValue.currency,
          defaultPeriodType: newValue.periodType,
          defaultPeriodValue: newValue.periodValue,
          status: 'paused',
          remark: `官方价格巡检发现的新套餐，来源：${review.source?.name ?? '未知来源'}`
        },
        operator
      );
      serviceId = createdService.id;
    } else {
      await this.appleServicesService.update(
        review.appleServiceId,
        {
          category: newValue.category,
          officialBasePrice: newValue.officialPrice,
          currency: newValue.currency,
          defaultPeriodType: newValue.periodType,
          defaultPeriodValue: newValue.periodValue,
          remark: this.mergeOfficialPriceRemark(review.appleService?.remark, review.source?.name)
        },
        operator
      );
    }

    const updated = await this.prisma.applePriceChangeReview.update({
      where: { id: review.id },
      data: {
        status: 'approved',
        reviewedByUserId: operator?.id,
        reviewedAt: new Date(),
        appleServiceId: serviceId,
        remark: this.normalizeNullableString(review.remark) ?? '已确认同步到 Apple ID 业务设置'
      },
      include: this.getReviewInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_official_price',
      action: 'apple_official_price.review.approve',
      objectType: 'apple_price_change_review',
      objectId: review.id,
      beforeData: this.toJson(this.toReviewResponse(review)),
      afterData: this.toJson(this.toReviewResponse(updated)),
      remark: `Approved Apple official price review ${review.id}`
    });

    this.publishChanged(
      'apple.official_price.review_approved',
      'price_change_review',
      'approved',
      review.id
    );

    return this.toReviewResponse(updated);
  }

  async ignoreReview(id: string, remark?: string | null, operator?: AuthenticatedUser) {
    const review = await this.findReviewOrThrow(id);
    if (review.status !== 'pending') {
      throw new ConflictException('Only pending official price review can be ignored');
    }

    const updated = await this.prisma.applePriceChangeReview.update({
      where: { id: review.id },
      data: {
        status: 'ignored',
        reviewedByUserId: operator?.id,
        reviewedAt: new Date(),
        remark: this.normalizeNullableString(remark) ?? '已忽略'
      },
      include: this.getReviewInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_official_price',
      action: 'apple_official_price.review.ignore',
      objectType: 'apple_price_change_review',
      objectId: review.id,
      beforeData: this.toJson(this.toReviewResponse(review)),
      afterData: this.toJson(this.toReviewResponse(updated)),
      remark: `Ignored Apple official price review ${review.id}`
    });

    this.publishChanged(
      'apple.official_price.review_ignored',
      'price_change_review',
      'ignored',
      review.id
    );

    return this.toReviewResponse(updated);
  }

  async runDueSourceChecks(trigger: 'worker' | 'system' = 'worker') {
    const now = new Date();
    const sources = await this.prisma.appleOfficialPriceSource.findMany({
      where: {
        deletedAt: null,
        status: 'enabled'
      },
      orderBy: { lastCheckedAt: 'asc' }
    });
    const dueSources = sources.filter((source) => {
      if (!source.lastCheckedAt) return true;
      const nextCheckAt =
        source.lastCheckedAt.getTime() + Math.max(source.checkIntervalHours, 1) * 60 * 60 * 1000;
      return nextCheckAt <= now.getTime();
    });
    const results = [];

    for (const source of dueSources) {
      results.push(await this.checkSource(source.id, { trigger }));
    }

    return {
      scannedCount: sources.length,
      dueCount: dueSources.length,
      results
    };
  }

  private async collectSourceItems(
    source: AppleOfficialPriceSource
  ): Promise<NormalizedCollectedItem[]> {
    if (source.collectMethod === 'manual') return [];

    const sourceUrl = this.normalizeNullableString(source.sourceUrl);
    if (!sourceUrl) return [];

    const response = await this.fetchOfficialPriceSource(sourceUrl);
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    const collectedItems =
      source.collectMethod === 'api' || contentType.toLowerCase().includes('json')
        ? this.collectApiItems(body, source)
        : this.collectWebpageItems(body, source);

    return this.normalizeCollectedItems(collectedItems.slice(0, AUTO_COLLECT_LIMIT), source);
  }

  private async fetchOfficialPriceSource(sourceUrl: string) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
          'user-agent':
            'Mozilla/5.0 AppleOfficialPriceChecker/1.0 (+https://localhost/apple-official-prices)'
        },
        signal: AbortSignal.timeout(OFFICIAL_PRICE_FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new BadRequestException(`官方价格采集失败：官方地址返回 HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
          ? '官方价格采集超时，请检查官方地址是否可访问'
          : `官方价格采集失败：${error instanceof Error ? error.message : '官方地址无法访问'}`;
      throw new BadRequestException(message);
    }
  }

  private collectApiItems(
    body: string,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto[] {
    try {
      return this.dedupeCollectedItems(this.extractItemsFromJson(JSON.parse(body), source));
    } catch {
      throw new BadRequestException('API 采集来源没有返回可解析的 JSON');
    }
  }

  private collectWebpageItems(
    html: string,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto[] {
    const structuredItems = this.extractStructuredItemsFromHtml(html, source);
    if (structuredItems.length) return this.dedupeCollectedItems(structuredItems);

    const metaItem = this.extractMetaPriceItem(html, source);
    if (metaItem) return [metaItem];

    const textItem = this.extractTextPriceItem(html, source);
    return textItem ? [textItem] : [];
  }

  private extractStructuredItemsFromHtml(
    html: string,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto[] {
    const items: OfficialPriceCollectedItemDto[] = [];
    const scriptPattern =
      /<script\b[^>]*(?:type=["']application\/ld\+json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(scriptPattern)) {
      const rawJson = this.decodeHtmlEntities(match[1]?.trim() ?? '');
      if (!rawJson) continue;
      try {
        items.push(...this.extractItemsFromJson(JSON.parse(rawJson), source));
      } catch {
        // Ignore unrelated scripts; a later parser can still extract a price.
      }
    }

    return items;
  }

  private extractItemsFromJson(
    value: unknown,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto[] {
    const records = this.collectPriceRecords(value);
    return records
      .map((record) => this.itemFromRecord(record, source))
      .filter((item): item is OfficialPriceCollectedItemDto => Boolean(item));
  }

  private collectPriceRecords(value: unknown, records: JsonRecord[] = [], depth = 0) {
    if (depth > 6 || records.length >= 500) return records;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectPriceRecords(item, records, depth + 1);
      }
      return records;
    }

    if (!this.isJsonRecord(value)) return records;

    if (this.recordLooksLikePriceItem(value)) {
      records.push(value);
    }

    for (const child of Object.values(value)) {
      if (this.isJsonRecord(child) || Array.isArray(child)) {
        this.collectPriceRecords(child, records, depth + 1);
      }
    }

    return records;
  }

  private recordLooksLikePriceItem(record: JsonRecord) {
    return Boolean(this.readServiceName(record) && this.readOfficialPrice(record));
  }

  private itemFromRecord(
    record: JsonRecord,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto | null {
    const serviceName = this.readServiceName(record);
    const officialPrice = this.readOfficialPrice(record);
    if (!serviceName || !officialPrice) return null;

    const period = this.readPeriod(record);

    return {
      serviceName,
      planCode: this.readPlanCode(record),
      category: this.readStringField(record, ['category', 'group', 'type']) ?? '通用',
      region: this.readStringField(record, ['region', 'country', 'storefront']) ?? source.region,
      currency: this.readCurrency(record, source.currency),
      officialPrice,
      periodType: period.periodType,
      periodValue: period.periodValue,
      rawPayload: this.safeRawPayload(record)
    };
  }

  private extractMetaPriceItem(
    html: string,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto | null {
    const title = this.extractHtmlTitle(html) ?? source.name;
    const price =
      this.extractDecimalString(
        this.getMetaContent(html, ['product:price:amount', 'og:price:amount', 'twitter:data1'])
      ) ?? this.extractCurrencyPrice(html, source.currency);

    if (!title || !price) return null;

    return {
      serviceName: title,
      category: '通用',
      region: source.region,
      currency:
        this.getMetaContent(html, ['product:price:currency', 'og:price:currency']) ??
        source.currency,
      officialPrice: price,
      periodType: 'month',
      periodValue: 1,
      rawPayload: {
        sourceUrl: source.sourceUrl,
        parser: 'meta'
      }
    };
  }

  private extractTextPriceItem(
    html: string,
    source: AppleOfficialPriceSource
  ): OfficialPriceCollectedItemDto | null {
    const plainText = this.normalizeWhitespace(this.stripHtml(html));
    const price = this.extractCurrencyPrice(plainText, source.currency);
    if (!price) return null;

    return {
      serviceName: this.extractHtmlTitle(html) ?? source.name,
      category: '通用',
      region: source.region,
      currency: source.currency,
      officialPrice: price,
      periodType: 'month',
      periodValue: 1,
      rawPayload: {
        sourceUrl: source.sourceUrl,
        parser: 'text',
        matchedCurrency: source.currency
      }
    };
  }

  private readServiceName(record: JsonRecord) {
    return this.readStringField(record, [
      'serviceName',
      'service_name',
      'planName',
      'plan_name',
      'productName',
      'product_name',
      'subscriptionName',
      'subscription_name',
      'displayName',
      'display_name',
      'name',
      'title'
    ]);
  }

  private readOfficialPrice(record: JsonRecord): string | null {
    const directPrice = this.extractDecimalString(
      this.readUnknownField(record, [
        'officialPrice',
        'official_price',
        'price',
        'amount',
        'priceAmount',
        'price_amount',
        'cost',
        'value',
        'monthlyPrice',
        'monthly_price'
      ])
    );
    if (directPrice) return directPrice;

    const nestedRecord = this.firstRecordFrom(
      this.readUnknownField(record, [
        'offers',
        'offer',
        'priceSpecification',
        'price_specification'
      ])
    );

    return nestedRecord ? this.readOfficialPrice(nestedRecord) : null;
  }

  private readPlanCode(record: JsonRecord) {
    return this.readStringField(record, [
      'planCode',
      'plan_code',
      'productId',
      'product_id',
      'sku',
      'skuId',
      'sku_id',
      'id'
    ]);
  }

  private readCurrency(record: JsonRecord, fallback: string): string {
    const currency = this.readStringField(record, [
      'currency',
      'currencyCode',
      'currency_code',
      'priceCurrency',
      'price_currency'
    ]);
    if (currency) return currency.toUpperCase();

    const nestedRecord = this.firstRecordFrom(
      this.readUnknownField(record, [
        'offers',
        'offer',
        'priceSpecification',
        'price_specification'
      ])
    );
    return nestedRecord ? this.readCurrency(nestedRecord, fallback) : fallback;
  }

  private readPeriod(record: JsonRecord): {
    periodType: AppleServicePeriodType;
    periodValue: number;
  } {
    const periodText =
      this.readStringField(record, [
        'periodType',
        'period_type',
        'period',
        'interval',
        'billingPeriod',
        'billing_period',
        'recurrence',
        'duration',
        'unit'
      ]) ?? '';
    const periodValue = this.extractInteger(
      this.readUnknownField(record, [
        'periodValue',
        'period_value',
        'intervalCount',
        'interval_count',
        'billingIntervalCount',
        'billing_interval_count',
        'durationValue',
        'duration_value'
      ])
    );

    return this.parseCollectedPeriod(periodText, periodValue ?? 1);
  }

  private parseCollectedPeriod(
    rawPeriod: string,
    rawCount: number
  ): { periodType: AppleServicePeriodType; periodValue: number } {
    const period = rawPeriod.trim().toLowerCase();
    const isoMatch = period.match(/^p(\d+)([dwmy])$/i);
    const count = Math.max(rawCount || Number(isoMatch?.[1] ?? 1), 1);
    const unit = isoMatch?.[2]?.toLowerCase() ?? period;

    if (unit.includes('year') || unit.includes('annual') || unit === 'y') {
      return { periodType: 'month', periodValue: count * 12 };
    }
    if (unit.includes('week') || unit === 'w') {
      return { periodType: 'day', periodValue: count * 7 };
    }
    if (unit.includes('day') || unit === 'd') {
      return { periodType: 'day', periodValue: count };
    }
    if (unit.includes('manual')) {
      return { periodType: 'manual', periodValue: 1 };
    }

    return { periodType: 'month', periodValue: unit.includes('month') || unit === 'm' ? count : 1 };
  }

  private readStringField(record: JsonRecord, keys: string[]): string | null {
    const value = this.readUnknownField(record, keys);
    return typeof value === 'string' && value.trim() ? this.normalizeWhitespace(value) : null;
  }

  private readUnknownField(record: JsonRecord, keys: string[]) {
    const lowerKeys = new Set(keys.map((key) => key.toLowerCase()));
    for (const [key, value] of Object.entries(record)) {
      if (lowerKeys.has(key.toLowerCase())) return value;
    }
    return undefined;
  }

  private firstRecordFrom(value: unknown): JsonRecord | null {
    if (this.isJsonRecord(value)) return value;
    if (Array.isArray(value)) {
      return value.find((item): item is JsonRecord => this.isJsonRecord(item)) ?? null;
    }
    return null;
  }

  private isJsonRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  private extractDecimalString(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return new PrismaNamespace.Decimal(value).toFixed();
    }
    if (typeof value !== 'string') return null;

    const normalized = value.replace(/,/g, '').trim();
    const match = normalized.match(
      /(?:us\$|hk\$|rm|myr|usd|hkd|cny|rmb|[$€£¥￥])?\s*(\d+(?:\.\d{1,8})?)/i
    );
    return match ? new PrismaNamespace.Decimal(match[1]).toFixed() : null;
  }

  private extractInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string') {
      const normalized = Number(value.trim());
      if (Number.isInteger(normalized) && normalized > 0) return normalized;
    }
    return null;
  }

  private extractCurrencyPrice(text: string, currency: string): string | null {
    const tokens = this.getCurrencyTokens(currency).map((token) => this.escapeRegExp(token));
    if (!tokens.length) return this.extractDecimalString(text);

    const amountPattern = '([0-9][0-9,]*(?:\\.\\d{1,8})?)';
    const tokenPattern = tokens.join('|');
    const pattern = new RegExp(
      `(?:${tokenPattern})\\s*${amountPattern}|${amountPattern}\\s*(?:${tokenPattern})`,
      'i'
    );
    const match = text.match(pattern);
    return this.extractDecimalString(match?.[1] ?? match?.[2]);
  }

  private getCurrencyTokens(currency: string) {
    const normalized = currency.toUpperCase();
    const tokens = [normalized];
    if (normalized === 'USD') tokens.push('US$', '$');
    if (normalized === 'HKD') tokens.push('HK$');
    if (normalized === 'MYR') tokens.push('RM');
    if (normalized === 'CNY' || normalized === 'RMB') tokens.push('¥', '￥', 'RMB');
    return tokens;
  }

  private getMetaContent(html: string, names: string[]) {
    const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
    for (const tag of metaTags) {
      const name = this.getHtmlAttribute(tag, 'property') ?? this.getHtmlAttribute(tag, 'name');
      if (!name || !names.includes(name)) continue;
      const content = this.getHtmlAttribute(tag, 'content');
      if (content) return this.decodeHtmlEntities(content);
    }
    return null;
  }

  private extractHtmlTitle(html: string) {
    const ogTitle = this.getMetaContent(html, ['og:title', 'twitter:title']);
    if (ogTitle) return ogTitle;
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return titleMatch ? this.normalizeWhitespace(this.decodeHtmlEntities(titleMatch[1])) : null;
  }

  private getHtmlAttribute(tag: string, attribute: string) {
    const match = tag.match(new RegExp(`${attribute}=["']([^"']*)["']`, 'i'));
    return match?.[1] ?? null;
  }

  private stripHtml(html: string) {
    return this.decodeHtmlEntities(
      html
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    );
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  private normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private safeRawPayload(record: JsonRecord): JsonRecord {
    const serialized = JSON.stringify(record);
    if (serialized.length <= 4000) return record;
    return {
      truncated: true,
      preview: serialized.slice(0, 4000)
    };
  }

  private dedupeCollectedItems(items: OfficialPriceCollectedItemDto[]) {
    const seen = new Set<string>();
    const deduped: OfficialPriceCollectedItemDto[] = [];

    for (const item of items) {
      const key = [
        item.serviceName?.trim().toLowerCase(),
        item.region,
        item.currency,
        item.officialPrice,
        item.periodType,
        item.periodValue
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= AUTO_COLLECT_LIMIT) break;
    }

    return deduped;
  }

  private async persistCollectedItems(input: {
    source: OfficialPriceSourceWithUsers;
    items: NormalizedCollectedItem[];
    scanRemovedPlans: boolean;
    taskId: string;
    cronLogId: string;
    startedAt: Date;
    trigger: string;
    operator?: AuthenticatedUser;
  }) {
    const finishedAt = new Date();
    const snapshots: OfficialPriceSnapshotWithRelations[] = [];
    const reviews: PriceChangeReviewWithRelations[] = [];
    const globalBalanceRule = await this.appleServicesService.getBalancePriceRule();

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const matchedService = await this.findMatchedService(tx, item);
        const appleBalancePrice = this.buildAppleBalancePricePreview(
          item,
          matchedService,
          globalBalanceRule
        );
        const snapshot = await tx.appleOfficialPriceSnapshot.create({
          data: {
            sourceId: input.source.id,
            appleServiceId: matchedService?.id ?? null,
            provider: item.provider,
            planCode: item.planCode ?? null,
            serviceName: item.serviceName,
            category: item.category,
            region: item.region,
            currency: item.currency,
            officialPrice: item.officialPrice,
            appleBalancePrice,
            periodType: item.periodType,
            periodValue: item.periodValue,
            rawPayload: this.toJson(item.rawPayload ?? item)
          },
          include: this.getSnapshotInclude()
        });
        snapshots.push(snapshot);

        const change = this.detectChange(matchedService, item);
        if (change) {
          const review = await tx.applePriceChangeReview.create({
            data: {
              sourceId: input.source.id,
              snapshotId: snapshot.id,
              appleServiceId: matchedService?.id ?? null,
              changeType: change,
              oldValue: matchedService
                ? this.toJson(this.buildServiceValue(matchedService))
                : PrismaNamespace.JsonNull,
              newValue: this.toJson(this.buildCollectedValue(item, appleBalancePrice)),
              status: 'pending'
            },
            include: this.getReviewInclude()
          });
          reviews.push(review);
        }
      }

      if (input.scanRemovedPlans) {
        const collectedNames = new Set(
          input.items.map((item) => this.normalizeComparableName(item.serviceName))
        );
        const existingServices = await tx.appleService.findMany({
          where: {
            deletedAt: null,
            currency: input.source.currency,
            status: { in: ['enabled', 'paused'] }
          }
        });

        for (const service of existingServices) {
          if (collectedNames.has(this.normalizeComparableName(service.name))) continue;
          const review = await tx.applePriceChangeReview.create({
            data: {
              sourceId: input.source.id,
              appleServiceId: service.id,
              changeType: 'removed_plan',
              oldValue: this.toJson(this.buildServiceValue(service)),
              newValue: this.toJson({
                provider: input.source.provider,
                serviceName: service.name,
                region: input.source.region,
                currency: input.source.currency,
                removedFromOfficialSource: true
              }),
              status: 'pending'
            },
            include: this.getReviewInclude()
          });
          reviews.push(review);
        }
      }

      await tx.appleOfficialPriceSource.update({
        where: { id: input.source.id },
        data: { lastCheckedAt: finishedAt }
      });
      await tx.automationTask.update({
        where: { id: input.taskId },
        data: {
          status: 'success',
          manualRequired: false,
          resultPayload: this.toJson({
            sourceId: input.source.id,
            snapshotCount: snapshots.length,
            reviewCount: reviews.length
          }),
          finishedAt
        }
      });
      await tx.automationTaskLog.create({
        data: {
          taskId: input.taskId,
          level: reviews.length ? 'warning' : 'success',
          message: reviews.length
            ? `官方价格巡检完成，发现 ${reviews.length} 条待确认变化`
            : '官方价格巡检完成，没有发现变化',
          payload: this.toJson({
            sourceId: input.source.id,
            snapshotCount: snapshots.length,
            reviewCount: reviews.length
          })
        }
      });
      await tx.cronJobLog.update({
        where: { id: input.cronLogId },
        data: {
          status: 'success',
          finishedAt,
          metadata: this.toJson({
            sourceId: input.source.id,
            trigger: input.trigger,
            taskId: input.taskId,
            snapshotCount: snapshots.length,
            reviewCount: reviews.length
          })
        }
      });
    });

    const pendingReviewCount = await this.prisma.applePriceChangeReview.count({
      where: { status: 'pending' }
    });
    const source = await this.findSourceOrThrow(input.source.id);

    return {
      source: this.toSourceResponse(source),
      snapshotCount: snapshots.length,
      reviewCount: reviews.length,
      pendingReviewCount,
      snapshots: snapshots.map((snapshot) => this.toSnapshotResponse(snapshot)),
      reviews: reviews.map((review) => this.toReviewResponse(review))
    };
  }

  private async findMatchedService(tx: Prisma.TransactionClient, item: NormalizedCollectedItem) {
    if (item.appleServiceId) {
      return tx.appleService.findFirst({
        where: { id: item.appleServiceId, deletedAt: null }
      });
    }

    return tx.appleService.findFirst({
      where: {
        deletedAt: null,
        name: { equals: item.serviceName, mode: 'insensitive' },
        currency: item.currency
      }
    });
  }

  private detectChange(service: AppleService | null, item: NormalizedCollectedItem) {
    if (!service) {
      return 'new_plan' satisfies ApplePriceChangeType;
    }

    if (!service.officialBasePrice.equals(item.officialPrice)) {
      return 'price_changed' satisfies ApplePriceChangeType;
    }

    if (service.currency !== item.currency) {
      return 'currency_changed' satisfies ApplePriceChangeType;
    }

    if (
      service.defaultPeriodType !== item.periodType ||
      service.defaultPeriodValue !== item.periodValue
    ) {
      return 'period_changed' satisfies ApplePriceChangeType;
    }

    return null;
  }

  private buildAppleBalancePricePreview(
    item: NormalizedCollectedItem,
    service: AppleService | null,
    globalRule: { ruleType: string; ruleValue: string }
  ) {
    if (service?.appleBalancePriceRuleType === 'manual') {
      return service.officialCostValue.toString();
    }

    const ruleType =
      service && service.appleBalancePriceRuleType !== 'inherit'
        ? service.appleBalancePriceRuleType
        : globalRule.ruleType;
    const ruleValue =
      service && service.appleBalancePriceRuleType !== 'inherit'
        ? service.appleBalancePriceRuleValue?.toString()
        : globalRule.ruleValue;
    const officialPrice = new PrismaNamespace.Decimal(item.officialPrice);

    if (ruleType === 'fixed_add') {
      return officialPrice.plus(ruleValue ?? '0').toFixed();
    }

    if (ruleType === 'percent') {
      return officialPrice.mul(ruleValue ?? '1').toFixed();
    }

    return officialPrice.toFixed();
  }

  private buildCollectedValue(item: NormalizedCollectedItem, appleBalancePrice: string) {
    return {
      ...item,
      officialBasePrice: item.officialPrice,
      appleBalancePrice
    };
  }

  private buildSourceCreateData(dto: CreateOfficialPriceSourceDto, operator?: AuthenticatedUser) {
    const name = this.normalizeRequiredString(dto.name, 'name');
    return {
      name,
      provider: this.normalizeCode(dto.provider, this.inferProviderFromName(name), false),
      priceSourceType: this.normalizeCode(dto.priceSourceType, 'official_web', false),
      region: this.normalizeCode(dto.region, 'US'),
      currency: this.normalizeCode(dto.currency, 'USD'),
      sourceUrl: this.normalizeNullableUrl(dto.sourceUrl),
      collectMethod: this.parseCollectMethod(dto.collectMethod, true) ?? 'manual',
      checkIntervalHours: this.normalizeIntervalHours(dto.checkIntervalHours),
      status: this.parseSourceStatus(dto.status, true) ?? 'enabled',
      remark: this.normalizeNullableString(dto.remark),
      createdByUserId: operator?.id,
      updatedByUserId: operator?.id
    } satisfies Prisma.AppleOfficialPriceSourceUncheckedCreateInput;
  }

  private buildSourceUpdateData(dto: UpdateOfficialPriceSourceDto, operator?: AuthenticatedUser) {
    const data: Prisma.AppleOfficialPriceSourceUncheckedUpdateInput = {
      updatedByUserId: operator?.id
    };

    if (dto.name !== undefined) {
      data.name = this.normalizeRequiredString(dto.name, 'name');
    }
    if (dto.provider !== undefined) {
      data.provider = this.normalizeCode(dto.provider, 'manual', false);
    }
    if (dto.priceSourceType !== undefined) {
      data.priceSourceType = this.normalizeCode(dto.priceSourceType, 'official_web', false);
    }
    if (dto.region !== undefined) {
      data.region = this.normalizeCode(dto.region, 'US');
    }
    if (dto.currency !== undefined) {
      data.currency = this.normalizeCode(dto.currency, 'USD');
    }
    if (dto.sourceUrl !== undefined) {
      data.sourceUrl = this.normalizeNullableUrl(dto.sourceUrl);
    }
    if (dto.collectMethod !== undefined) {
      data.collectMethod = this.parseCollectMethod(dto.collectMethod, true);
    }
    if (dto.checkIntervalHours !== undefined) {
      data.checkIntervalHours = this.normalizeIntervalHours(dto.checkIntervalHours);
    }
    if (dto.status !== undefined) {
      data.status = this.parseSourceStatus(dto.status, true);
    }
    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    return data;
  }

  private normalizeCollectedItems(
    value: CheckOfficialPriceSourceDto['items'],
    source: AppleOfficialPriceSource
  ): NormalizedCollectedItem[] {
    if (!Array.isArray(value) || value.length === 0) {
      return [];
    }

    if (value.length > 200) {
      throw new BadRequestException('items cannot exceed 200');
    }

    return value.map((item, index) => {
      const serviceName = this.normalizeRequiredString(
        item.serviceName,
        `items[${index}].serviceName`
      );
      return {
        appleServiceId: item.appleServiceId
          ? this.normalizeRequiredUuid(item.appleServiceId, `items[${index}].appleServiceId`)
          : null,
        provider: source.provider,
        planCode: this.normalizeNullableString(item.planCode),
        serviceName,
        category: this.normalizeCategory(item.category ?? '通用'),
        region: this.normalizeCode(item.region ?? source.region, source.region),
        currency: this.normalizeCode(item.currency ?? source.currency, source.currency),
        officialPrice: this.normalizeDecimal(
          item.officialPrice,
          `items[${index}].officialPrice`,
          '0'
        ),
        periodType: this.parsePeriodType(item.periodType, true) ?? 'month',
        periodValue: this.normalizePositiveInteger(
          item.periodValue,
          `items[${index}].periodValue`,
          1
        ),
        rawPayload: item.rawPayload ?? null
      };
    });
  }

  private buildCollectorUnavailableMessage(
    source: AppleOfficialPriceSource,
    attemptedAutoCollect = false
  ) {
    if (source.collectMethod === 'manual') {
      return '这个官方价格来源是手动采集，请录入本次官方套餐和价格后再生成对比。';
    }
    if (!source.sourceUrl) {
      return '这个官方价格来源没有填写官方地址，已转人工确认。';
    }
    if (attemptedAutoCollect) {
      return '已访问官方地址，但没有识别到可用套餐价格，已转人工确认。请检查页面是否需要登录、是否屏蔽服务端访问，或改用 API JSON 来源。';
    }
    return '这个官方价格来源还没有配置稳定解析规则，已转人工确认，避免误采集后自动改错价格。';
  }

  private parseReviewNewValue(value: Prisma.JsonValue) {
    const data = value as Record<string, unknown>;
    const serviceName = this.normalizeRequiredString(data.serviceName, 'newValue.serviceName');
    return {
      serviceName,
      category: this.normalizeCategory(typeof data.category === 'string' ? data.category : '通用'),
      currency: this.normalizeCode(
        typeof data.currency === 'string' ? data.currency : 'USD',
        'USD'
      ),
      officialPrice: this.normalizeDecimal(
        data.officialPrice as string | number,
        'newValue.officialPrice',
        '0'
      ),
      periodType: this.parsePeriodType(data.periodType, true) ?? 'month',
      periodValue: this.normalizePositiveInteger(
        data.periodValue as number | string,
        'newValue.periodValue',
        1
      )
    };
  }

  private buildServiceValue(service: AppleService) {
    return {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      currency: service.currency,
      officialPrice: service.officialBasePrice.toString(),
      officialBasePrice: service.officialBasePrice.toString(),
      appleBalancePrice: service.officialCostValue.toString(),
      appleBalancePriceRuleType: service.appleBalancePriceRuleType,
      appleBalancePriceRuleValue: service.appleBalancePriceRuleValue?.toString() ?? null,
      periodType: service.defaultPeriodType,
      periodValue: service.defaultPeriodValue,
      status: service.status
    };
  }

  private mergeOfficialPriceRemark(
    existingRemark: string | null | undefined,
    sourceName?: string | null
  ) {
    const note = `官方价格巡检已确认更新，来源：${sourceName ?? '未知来源'}`;
    if (!existingRemark) return note;
    return existingRemark.includes(note) ? existingRemark : `${existingRemark}\n${note}`;
  }

  private async findSourceOrThrow(id: string) {
    const source = await this.prisma.appleOfficialPriceSource.findFirst({
      where: { id, deletedAt: null },
      include: this.getSourceInclude()
    });

    if (!source) {
      throw new NotFoundException('Apple official price source not found');
    }

    return source;
  }

  private async findReviewOrThrow(id: string) {
    const reviewId = this.normalizeRequiredUuid(id, 'id');
    const review = await this.prisma.applePriceChangeReview.findUnique({
      where: { id: reviewId },
      include: this.getReviewInclude()
    });

    if (!review) {
      throw new NotFoundException('Apple official price review not found');
    }

    return review;
  }

  private getSourceInclude() {
    return {
      createdBy: { select: this.getUserSelect() },
      updatedBy: { select: this.getUserSelect() }
    } satisfies Prisma.AppleOfficialPriceSourceInclude;
  }

  private getSnapshotInclude() {
    return {
      source: { select: { id: true, name: true, provider: true, region: true, currency: true } },
      appleService: { select: { id: true, name: true, category: true, currency: true } }
    } satisfies Prisma.AppleOfficialPriceSnapshotInclude;
  }

  private getReviewInclude() {
    return {
      source: { select: { id: true, name: true, provider: true, region: true, currency: true } },
      snapshot: {
        select: {
          id: true,
          provider: true,
          planCode: true,
          serviceName: true,
          region: true,
          currency: true,
          officialPrice: true,
          appleBalancePrice: true,
          collectedAt: true
        }
      },
      appleService: {
        select: {
          id: true,
          name: true,
          category: true,
          currency: true,
          officialBasePrice: true,
          officialCostValue: true,
          appleBalancePriceRuleType: true,
          appleBalancePriceRuleValue: true,
          defaultPeriodType: true,
          defaultPeriodValue: true,
          remark: true,
          status: true
        }
      },
      reviewedBy: { select: this.getUserSelect() }
    } satisfies Prisma.ApplePriceChangeReviewInclude;
  }

  private getUserSelect() {
    return {
      id: true,
      username: true,
      displayName: true
    } satisfies Prisma.UserSelect;
  }

  private buildSourceOrderBy(
    query: ListSourcesQuery
  ): Prisma.AppleOfficialPriceSourceOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? SOURCE_SORT_FIELDS[query.sortBy] : undefined;
    if (!sortField || !sortOrder) return [{ createdAt: 'desc' }];
    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private buildSnapshotOrderBy(
    query: ListSnapshotsQuery
  ): Prisma.AppleOfficialPriceSnapshotOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? SNAPSHOT_SORT_FIELDS[query.sortBy] : undefined;
    if (!sortField || !sortOrder) return [{ collectedAt: 'desc' }];
    return [{ [sortField]: sortOrder }, { collectedAt: 'desc' }];
  }

  private buildReviewOrderBy(
    query: ListReviewsQuery
  ): Prisma.ApplePriceChangeReviewOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? REVIEW_SORT_FIELDS[query.sortBy] : undefined;
    if (!sortField || !sortOrder) return [{ createdAt: 'desc' }];
    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | undefined {
    if (!value) return undefined;
    if (value === 'asc' || value === 'desc') return value;
    throw new BadRequestException('sortOrder is invalid');
  }

  private parseCollectMethod(value: unknown, strict: true): AppleOfficialPriceCollectMethod;
  private parseCollectMethod(
    value: unknown,
    strict?: false
  ): AppleOfficialPriceCollectMethod | undefined;
  private parseCollectMethod(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'manual' || value === 'webpage' || value === 'api') return value;
    if (strict) throw new BadRequestException('collectMethod is invalid');
    return undefined;
  }

  private parseSourceStatus(value: unknown, strict: true): AppleOfficialPriceSourceStatus;
  private parseSourceStatus(
    value: unknown,
    strict?: false
  ): AppleOfficialPriceSourceStatus | undefined;
  private parseSourceStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'enabled' || value === 'disabled') return value;
    if (strict) throw new BadRequestException('source status is invalid');
    return undefined;
  }

  private parseReviewStatus(value: unknown, strict: true): ApplePriceChangeReviewStatus;
  private parseReviewStatus(
    value: unknown,
    strict?: false
  ): ApplePriceChangeReviewStatus | undefined;
  private parseReviewStatus(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'pending' || value === 'approved' || value === 'ignored') return value;
    if (strict) throw new BadRequestException('review status is invalid');
    return undefined;
  }

  private parseChangeType(value: unknown, strict: true): ApplePriceChangeType;
  private parseChangeType(value: unknown, strict?: false): ApplePriceChangeType | undefined;
  private parseChangeType(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') return undefined;
    if (
      value === 'price_changed' ||
      value === 'new_plan' ||
      value === 'removed_plan' ||
      value === 'period_changed' ||
      value === 'currency_changed'
    ) {
      return value;
    }
    if (strict) throw new BadRequestException('changeType is invalid');
    return undefined;
  }

  private parsePeriodType(value: unknown, strict: true): AppleServicePeriodType;
  private parsePeriodType(value: unknown, strict?: false): AppleServicePeriodType | undefined;
  private parsePeriodType(value: unknown, strict = true) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'month' || value === 'day' || value === 'manual') return value;
    if (strict) throw new BadRequestException('periodType is invalid');
    return undefined;
  }

  private normalizeTrigger(value: unknown) {
    if (value === 'manual' || value === 'worker' || value === 'system') return value;
    return 'manual';
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

  private normalizeNullableUrl(value: string | null | undefined) {
    const normalized = this.normalizeNullableString(value);
    if (!normalized) return null;
    try {
      new URL(normalized);
      return normalized;
    } catch {
      throw new BadRequestException('sourceUrl must be a valid URL');
    }
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }
    return normalized;
  }

  private normalizeCode(value: string | undefined, fallback: string, upperCase = true) {
    const rawValue = (value || fallback).trim();
    const normalized = upperCase ? rawValue.toUpperCase() : rawValue.toLowerCase();
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(normalized)) {
      throw new BadRequestException('code format is invalid');
    }
    return normalized;
  }

  private normalizeCategory(value: string | null | undefined) {
    const normalized = (value || '通用').trim();
    return normalized === 'default' ? '通用' : normalized;
  }

  private inferProviderFromName(value: string) {
    const normalized = value.toLowerCase();
    if (normalized.includes('chatgpt') || normalized.includes('openai')) return 'chatgpt';
    if (normalized.includes('gemini') || normalized.includes('google')) return 'gemini';
    if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
    return 'custom';
  }

  private normalizeDecimal(value: string | number | undefined, field: string, fallback: string) {
    const normalized = value === undefined || value === '' ? fallback : String(value).trim();
    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }
    return new PrismaNamespace.Decimal(normalized).toFixed();
  }

  private normalizePositiveInteger(
    value: number | string | undefined,
    field: string,
    fallback: number
  ) {
    const normalized = value === undefined || value === '' ? fallback : Number(value);
    if (!Number.isInteger(normalized) || normalized < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return normalized;
  }

  private normalizeIntervalHours(value: number | string | undefined) {
    const normalized = value === undefined || value === '' ? 24 : Number(value);
    if (!Number.isInteger(normalized) || normalized < 1 || normalized > 24 * 30) {
      throw new BadRequestException('checkIntervalHours must be between 1 and 720');
    }
    return normalized;
  }

  private normalizeComparableName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private createQueueJobId(taskType: string) {
    return `apple-${taskType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private publishChanged(
    type: string,
    entity: string,
    action: string,
    resourceId: string,
    scope?: Record<string, string | number | boolean | null | undefined>
  ) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity,
      action,
      resourceId,
      scope
    });
  }

  private toJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toSourceResponse(source: OfficialPriceSourceWithUsers) {
    return {
      id: source.id,
      name: source.name,
      provider: source.provider,
      priceSourceType: source.priceSourceType,
      region: source.region,
      currency: source.currency,
      sourceUrl: source.sourceUrl,
      collectMethod: source.collectMethod,
      checkIntervalHours: source.checkIntervalHours,
      status: source.status,
      lastCheckedAt: source.lastCheckedAt,
      remark: source.remark,
      createdBy: source.createdBy,
      updatedBy: source.updatedBy,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    };
  }

  private toSnapshotResponse(snapshot: OfficialPriceSnapshotWithRelations) {
    return {
      id: snapshot.id,
      sourceId: snapshot.sourceId,
      source: snapshot.source,
      appleServiceId: snapshot.appleServiceId,
      appleService: snapshot.appleService,
      provider: snapshot.provider,
      planCode: snapshot.planCode,
      serviceName: snapshot.serviceName,
      category: snapshot.category,
      region: snapshot.region,
      currency: snapshot.currency,
      officialPrice: snapshot.officialPrice.toString(),
      appleBalancePrice: snapshot.appleBalancePrice?.toString() ?? null,
      periodType: snapshot.periodType,
      periodValue: snapshot.periodValue,
      rawPayload: snapshot.rawPayload,
      collectedAt: snapshot.collectedAt
    };
  }

  private toReviewResponse(review: PriceChangeReviewWithRelations) {
    return {
      id: review.id,
      sourceId: review.sourceId,
      source: review.source,
      snapshotId: review.snapshotId,
      snapshot: review.snapshot
        ? {
            ...review.snapshot,
            officialPrice: review.snapshot.officialPrice.toString(),
            appleBalancePrice: review.snapshot.appleBalancePrice?.toString() ?? null
          }
        : null,
      appleServiceId: review.appleServiceId,
      appleService: review.appleService
        ? {
            ...review.appleService,
            officialBasePrice: review.appleService.officialBasePrice.toString(),
            officialCostValue: review.appleService.officialCostValue.toString(),
            appleBalancePriceRuleValue:
              review.appleService.appleBalancePriceRuleValue?.toString() ?? null
          }
        : null,
      changeType: review.changeType,
      oldValue: review.oldValue,
      newValue: review.newValue,
      status: review.status,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt,
      remark: review.remark,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    };
  }
}
