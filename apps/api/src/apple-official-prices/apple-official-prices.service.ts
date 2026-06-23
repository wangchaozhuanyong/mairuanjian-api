import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AppleOfficialPriceCollectMethod,
  AppleOfficialPriceCheckBatch,
  AppleOfficialPriceCheckBatchItem,
  AppleOfficialPriceSnapshot,
  AppleOfficialPriceSource,
  AppleOfficialPriceSourceStatus,
  ApplePriceChangeReview,
  ApplePriceChangeReviewStatus,
  ApplePriceChangeType,
  AppleService,
  AppleServicePeriodType,
  AutomationTaskStatus,
  DataDictionary,
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
import type { CheckOfficialPriceProviderDto } from './dto/check-official-price-provider.dto';
import {
  buildOfficialPriceProviderPreset,
  OFFICIAL_PRICE_PROVIDER_KEYS,
  OFFICIAL_PRICE_PROVIDER_PROFILES,
  normalizeOfficialPriceProvider,
  type OfficialPriceProviderKey,
  type OfficialPriceProviderPlan,
  type OfficialPriceProviderRegion,
  type OfficialPriceProviderSourcePreset
} from './official-price-provider-catalog';

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

type OfficialPriceBatchWithItems = AppleOfficialPriceCheckBatch & {
  items: AppleOfficialPriceCheckBatchItem[];
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

interface RunDueSourceCheckOptions {
  bootstrapProviders?: boolean;
}

interface OfficialPriceBatchPlanItem {
  sourceId: string;
  sourceName: string;
  provider: OfficialPriceProviderKey;
  region: string;
  currency: string;
}

const AUTO_COLLECT_LIMIT = 200;
const OFFICIAL_PRICE_FETCH_TIMEOUT_MS = 15_000;
const OFFICIAL_PRICE_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES: AutomationTaskStatus[] = ['queued', 'running'];
const FINAL_OFFICIAL_PRICE_BATCH_ITEM_STATUSES: AutomationTaskStatus[] = [
  'success',
  'failed',
  'waiting_manual_verify',
  'skipped',
  'cancelled'
];
const APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP = 'apple.service.categories';
const OFFICIAL_CATEGORY_REMARK = '官方价格采集自动生成';
const OFFICIAL_DISABLED_CATEGORY_REMARK = '官方价格采集发现但当前停用';

type DataDictionaryClient = {
  dataDictionary: {
    findFirst(args: Prisma.DataDictionaryFindFirstArgs): Promise<DataDictionary | null>;
    create(args: Prisma.DataDictionaryCreateArgs): Promise<DataDictionary>;
    update(args: Prisma.DataDictionaryUpdateArgs): Promise<DataDictionary>;
  };
};

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
  private readonly runningOfficialPriceBatches = new Set<string>();

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
    await this.assertOfficialCategoryActive(newValue.category);
    let serviceId = review.appleServiceId;
    const confirmedAt = new Date();

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

    if (!serviceId) {
      throw new ConflictException('Official price review has no matched Apple service');
    }

    const updated = await this.prisma.applePriceChangeReview.update({
      where: { id: review.id },
      data: {
        status: 'approved',
        reviewedByUserId: operator?.id,
        reviewedAt: confirmedAt,
        appleServiceId: serviceId,
        remark: this.normalizeNullableString(review.remark) ?? '已确认同步到 Apple ID 业务设置'
      },
      include: this.getReviewInclude()
    });

    await this.appleServicesService.upsertRegionPriceFromOfficial({
      serviceId,
      sourceSnapshotId: review.snapshotId,
      provider: review.snapshot?.provider ?? review.source?.provider ?? 'official_web',
      serviceName: newValue.serviceName,
      category: newValue.category,
      region: newValue.region,
      currency: newValue.currency,
      officialPrice: newValue.officialPrice,
      appleBalancePrice: newValue.appleBalancePrice,
      periodType: newValue.periodType,
      periodValue: newValue.periodValue,
      collectedAt: review.snapshot?.collectedAt ?? null,
      confirmedAt,
      remark: '官方价格审核确认后同步'
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

  async runDueSourceChecks(
    trigger: 'worker' | 'system' = 'worker',
    options: RunDueSourceCheckOptions = {}
  ) {
    const bootstrappedSourceCount = options.bootstrapProviders
      ? await this.ensureDefaultProviderSources()
      : 0;
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
      bootstrappedSourceCount,
      results
    };
  }

  listProviderCatalog() {
    const regionMap = new Map<
      string,
      { currency: string; label: string; region: string; sourceUrl: string; value: string }
    >();

    const providers = OFFICIAL_PRICE_PROVIDER_KEYS.map((provider) => {
      const profile = OFFICIAL_PRICE_PROVIDER_PROFILES[provider];
      const regions = profile.defaultRegions.map((region) => {
        const preset = buildOfficialPriceProviderPreset(provider, region);
        const item = {
          currency: preset.currency,
          label: this.getProviderRegionLabel(preset.region, preset.currency),
          region: preset.region,
          sourceUrl: preset.sourceUrl,
          value: `${preset.region}:${preset.currency}`
        };
        regionMap.set(item.value, item);
        return item;
      });

      return {
        label: profile.label,
        regions,
        shortLabel: this.getProviderShortLabel(provider),
        sourceUrl: profile.sourceUrl,
        value: provider
      };
    });

    return {
      providers,
      regions: [...regionMap.values()].sort((left, right) => left.value.localeCompare(right.value))
    };
  }

  async checkProvider(
    providerValue: string,
    dto: CheckOfficialPriceProviderDto = {},
    operator?: AuthenticatedUser
  ) {
    const provider = this.normalizeSupportedProvider(providerValue);
    const regions = await this.resolveProviderRegions(provider, dto.regions);
    const results = [];

    for (const region of regions) {
      const source = await this.ensureProviderSource(provider, region, operator, {
        updateExisting: true
      });
      try {
        results.push(
          await this.checkSource(
            source.id,
            {
              trigger: dto.trigger ?? 'manual',
              scanRemovedPlans: Boolean(dto.scanRemovedPlans)
            },
            operator
          )
        );
      } catch (error) {
        results.push({
          status: 'failed' as const,
          taskId: '',
          source,
          snapshotCount: 0,
          reviewCount: 0,
          message: error instanceof Error ? error.message : '官方价格自动采集失败'
        });
      }
    }

    const snapshotCount = results.reduce((sum, item) => sum + item.snapshotCount, 0);
    const reviewCount = results.reduce((sum, item) => sum + item.reviewCount, 0);
    const pendingReviewCount = await this.prisma.applePriceChangeReview.count({
      where: { status: 'pending' }
    });
    const failedCount = results.filter((item) => item.status === 'failed').length;

    return {
      provider,
      sourceCount: results.length,
      snapshotCount,
      reviewCount,
      pendingReviewCount,
      failedCount,
      results,
      message:
        failedCount > 0
          ? `${this.getProviderLabel(provider)} 自动采集完成，${failedCount} 个来源失败，${reviewCount} 条变化待确认`
          : `${this.getProviderLabel(provider)} 自动采集完成，${reviewCount} 条变化待确认`
    };
  }

  async checkAllProviders(dto: CheckOfficialPriceProviderDto = {}, operator?: AuthenticatedUser) {
    const results = [];
    for (const provider of OFFICIAL_PRICE_PROVIDER_KEYS) {
      results.push(await this.checkProvider(provider, dto, operator));
    }

    const snapshotCount = results.reduce((sum, item) => sum + item.snapshotCount, 0);
    const reviewCount = results.reduce((sum, item) => sum + item.reviewCount, 0);
    const failedCount = results.reduce((sum, item) => sum + item.failedCount, 0);
    const pendingReviewCount = await this.prisma.applePriceChangeReview.count({
      where: { status: 'pending' }
    });

    return {
      provider: 'all',
      sourceCount: results.reduce((sum, item) => sum + item.sourceCount, 0),
      snapshotCount,
      reviewCount,
      pendingReviewCount,
      failedCount,
      results,
      message:
        failedCount > 0
          ? `全部官方价格自动采集完成，${failedCount} 个来源失败，${reviewCount} 条变化待确认`
          : `全部官方价格自动采集完成，${reviewCount} 条变化待确认`
    };
  }

  async startProviderCheckBatch(
    providerValue: string,
    dto: CheckOfficialPriceProviderDto = {},
    operator?: AuthenticatedUser
  ) {
    const provider = this.normalizeSupportedProvider(providerValue);
    const regions = await this.resolveProviderRegions(provider, dto.regions);
    const plan = await this.buildOfficialPriceBatchPlan([{ provider, regions }], operator);

    return this.createOfficialPriceCheckBatch(provider, dto, plan, operator);
  }

  async startAllProvidersCheckBatch(
    dto: CheckOfficialPriceProviderDto = {},
    operator?: AuthenticatedUser
  ) {
    const providerPlans = [];

    for (const provider of OFFICIAL_PRICE_PROVIDER_KEYS) {
      providerPlans.push({
        provider,
        regions: await this.resolveProviderRegions(provider, dto.regions)
      });
    }

    const plan = await this.buildOfficialPriceBatchPlan(providerPlans, operator);
    return this.createOfficialPriceCheckBatch('all', dto, plan, operator);
  }

  async getLatestCheckBatch() {
    const batch =
      (await this.prisma.appleOfficialPriceCheckBatch.findFirst({
        where: { status: { in: ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES } },
        include: { items: { orderBy: [{ createdAt: 'asc' }] } },
        orderBy: { createdAt: 'desc' }
      })) ??
      (await this.prisma.appleOfficialPriceCheckBatch.findFirst({
        include: { items: { orderBy: [{ createdAt: 'asc' }] } },
        orderBy: { createdAt: 'desc' }
      }));

    if (!batch) return null;
    this.scheduleOfficialPriceBatch(batch.id);
    return this.toCheckBatchResponse(batch);
  }

  async getCheckBatch(id: string) {
    const batch = await this.findCheckBatchOrThrow(id);
    this.scheduleOfficialPriceBatch(batch.id);
    return this.toCheckBatchResponse(batch);
  }

  async getCheckBatchResults(id: string) {
    const batch = await this.findCheckBatchOrThrow(id);
    const taskIds = batch.items
      .map((item) => item.taskId)
      .filter((taskId): taskId is string => Boolean(taskId));
    const snapshots = taskIds.length
      ? await this.prisma.appleOfficialPriceSnapshot.findMany({
          where: { automationTaskId: { in: taskIds } },
          include: this.getSnapshotInclude(),
          orderBy: [{ collectedAt: 'desc' }]
        })
      : [];
    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const reviewFilters: Prisma.ApplePriceChangeReviewWhereInput[] = [];
    if (taskIds.length) {
      reviewFilters.push({ automationTaskId: { in: taskIds } });
    }
    if (snapshotIds.length) {
      reviewFilters.push({ snapshotId: { in: snapshotIds } });
    }
    const reviews = reviewFilters.length
      ? await this.prisma.applePriceChangeReview.findMany({
          where: {
            OR: reviewFilters
          },
          include: this.getReviewInclude(),
          orderBy: [{ createdAt: 'desc' }]
        })
      : [];
    const reviewsBySnapshotId = new Map(
      reviews.filter((review) => review.snapshotId).map((review) => [review.snapshotId!, review])
    );
    const snapshotRows = snapshots.map((snapshot) => {
      const review = reviewsBySnapshotId.get(snapshot.id) ?? null;
      return this.toCheckBatchResultRow({
        batchItem: batch.items.find((item) => item.taskId === snapshot.automationTaskId) ?? null,
        snapshot,
        review
      });
    });
    const snapshotRowKeys = new Set(
      snapshotRows.map((row) => `${row.reviewId ?? ''}:${row.snapshotId ?? ''}`)
    );
    const reviewRows = reviews
      .filter((review) => !review.snapshotId)
      .map((review) =>
        this.toCheckBatchResultRow({
          batchItem: batch.items.find((item) => item.taskId === review.automationTaskId) ?? null,
          snapshot: null,
          review
        })
      )
      .filter((row) => {
        const key = `${row.reviewId ?? ''}:${row.snapshotId ?? ''}`;
        if (snapshotRowKeys.has(key)) return false;
        snapshotRowKeys.add(key);
        return true;
      });
    const problemRows = batch.items
      .filter(
        (item) =>
          !item.taskId || item.status === 'failed' || item.status === 'waiting_manual_verify'
      )
      .map((item) =>
        this.toCheckBatchResultRow({
          batchItem: item,
          snapshot: null,
          review: null
        })
      );
    const items = [...snapshotRows, ...reviewRows, ...problemRows];

    return {
      batch: this.toCheckBatchResponse(batch),
      summary: {
        totalCount: items.length,
        unchangedCount: items.filter((item) => item.status === 'unchanged').length,
        changedCount: items.filter((item) =>
          ['price_changed', 'period_changed', 'currency_changed'].includes(item.status)
        ).length,
        newPlanCount: items.filter((item) => item.status === 'new_plan').length,
        removedPlanCount: items.filter((item) => item.status === 'removed_plan').length,
        failedCount: items.filter((item) => item.status === 'failed').length,
        manualRequiredCount: items.filter((item) => item.status === 'manual_required').length
      },
      items
    };
  }

  private async buildOfficialPriceBatchPlan(
    providerPlans: Array<{
      provider: OfficialPriceProviderKey;
      regions: OfficialPriceProviderRegion[];
    }>,
    operator?: AuthenticatedUser
  ): Promise<OfficialPriceBatchPlanItem[]> {
    const plan: OfficialPriceBatchPlanItem[] = [];
    const seen = new Set<string>();

    for (const item of providerPlans) {
      for (const region of item.regions) {
        const source = await this.ensureProviderSource(item.provider, region, operator, {
          updateExisting: true
        });
        const key = `${item.provider}:${source.region}:${source.currency}`;
        if (seen.has(key)) continue;
        seen.add(key);
        plan.push({
          sourceId: source.id,
          sourceName: source.name,
          provider: item.provider,
          region: source.region,
          currency: source.currency
        });
      }
    }

    if (!plan.length) {
      throw new BadRequestException('没有可采集的官方价格来源');
    }

    return plan;
  }

  private async createOfficialPriceCheckBatch(
    provider: OfficialPriceProviderKey | 'all',
    dto: CheckOfficialPriceProviderDto,
    plan: OfficialPriceBatchPlanItem[],
    operator?: AuthenticatedUser
  ) {
    const trigger = this.normalizeTrigger(dto.trigger);
    const scanRemovedPlans = Boolean(dto.scanRemovedPlans);
    const existing = await this.findOverlappingActiveCheckBatch(plan);

    if (existing) {
      this.scheduleOfficialPriceBatch(existing.id);
      return {
        ...this.toCheckBatchResponse(existing),
        reused: true,
        message: existing.message || '已有相同供应商/地区的采集批次正在执行'
      };
    }

    const batch = await this.prisma.appleOfficialPriceCheckBatch.create({
      data: {
        scopeKey: this.buildOfficialPriceBatchScopeKey(provider, trigger, scanRemovedPlans, plan),
        provider,
        trigger,
        scanRemovedPlans,
        status: 'queued',
        totalCount: plan.length,
        message: `已创建 ${plan.length} 个官方价格采集任务`,
        createdByUserId: operator?.id,
        items: {
          create: plan.map((item) => ({
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            provider: item.provider,
            region: item.region,
            currency: item.currency,
            status: 'queued'
          }))
        }
      },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } }
    });

    this.auditLogsService
      .create({
        userId: operator?.id,
        module: 'apple_official_price',
        action: 'apple_official_price.batch.create',
        objectType: 'apple_official_price_check_batch',
        objectId: batch.id,
        afterData: this.toJson(this.toCheckBatchResponse(batch)),
        remark: `Created Apple official price check batch ${batch.id}`
      })
      .catch(() => undefined);

    this.publishChanged(
      'apple.official_price.batch_created',
      'official_price_check_batch',
      'created',
      batch.id,
      { totalCount: batch.totalCount }
    );
    this.scheduleOfficialPriceBatch(batch.id);

    return { ...this.toCheckBatchResponse(batch), reused: false };
  }

  private async findOverlappingActiveCheckBatch(plan: OfficialPriceBatchPlanItem[]) {
    const activeBatches = await this.prisma.appleOfficialPriceCheckBatch.findMany({
      where: { status: { in: ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES } },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } },
      orderBy: { createdAt: 'desc' }
    });
    const planKeys = new Set(
      plan.map((item) => `${item.provider}:${item.region}:${item.currency}`)
    );

    return (
      activeBatches.find((batch) =>
        batch.items.some(
          (item) =>
            ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES.includes(item.status) &&
            planKeys.has(`${item.provider}:${item.region}:${item.currency}`)
        )
      ) ?? null
    );
  }

  private scheduleOfficialPriceBatch(batchId: string) {
    if (this.runningOfficialPriceBatches.has(batchId)) return;
    this.runningOfficialPriceBatches.add(batchId);

    setTimeout(() => {
      void this.runOfficialPriceBatch(batchId).finally(() => {
        this.runningOfficialPriceBatches.delete(batchId);
      });
    }, 0);
  }

  private async runOfficialPriceBatch(batchId: string) {
    const batch = await this.prisma.appleOfficialPriceCheckBatch.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } }
    });

    if (!batch || !ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES.includes(batch.status)) return;

    await this.prisma.appleOfficialPriceCheckBatch.update({
      where: { id: batch.id },
      data: {
        status: 'running',
        startedAt: batch.startedAt ?? new Date(),
        message: `官方价格采集中：${batch.completedCount}/${batch.totalCount}`
      }
    });

    for (const item of batch.items) {
      const current = await this.prisma.appleOfficialPriceCheckBatchItem.findUnique({
        where: { id: item.id }
      });
      if (!current || !ACTIVE_OFFICIAL_PRICE_BATCH_STATUSES.includes(current.status)) continue;

      await this.prisma.appleOfficialPriceCheckBatchItem.update({
        where: { id: item.id },
        data: {
          status: 'running',
          startedAt: new Date(),
          message: '正在访问官方来源'
        }
      });
      await this.refreshOfficialPriceBatchProgress(batch.id);

      try {
        const result = await this.checkSource(
          item.sourceId,
          {
            trigger: this.normalizeTrigger(batch.trigger),
            scanRemovedPlans: batch.scanRemovedPlans
          },
          this.getBatchOperator(batch)
        );
        const finishedAt = new Date();
        const status: AutomationTaskStatus =
          result.status === 'manual_required' ? 'waiting_manual_verify' : 'success';

        await this.prisma.appleOfficialPriceCheckBatchItem.update({
          where: { id: item.id },
          data: {
            status,
            taskId: result.taskId || null,
            snapshotCount: result.snapshotCount,
            reviewCount: result.reviewCount,
            message: result.message,
            errorMessage: null,
            finishedAt
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '官方价格采集失败';
        await this.prisma.appleOfficialPriceCheckBatchItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            message,
            errorMessage: message,
            finishedAt: new Date()
          }
        });
      }

      await this.refreshOfficialPriceBatchProgress(batch.id);
    }

    await this.refreshOfficialPriceBatchProgress(batch.id, true);
  }

  private async refreshOfficialPriceBatchProgress(batchId: string, finalize = false) {
    const items = await this.prisma.appleOfficialPriceCheckBatchItem.findMany({
      where: { batchId },
      orderBy: [{ createdAt: 'asc' }]
    });
    const totalCount = items.length;
    const completedCount = items.filter((item) =>
      FINAL_OFFICIAL_PRICE_BATCH_ITEM_STATUSES.includes(item.status)
    ).length;
    const successCount = items.filter((item) => item.status === 'success').length;
    const failedCount = items.filter((item) => item.status === 'failed').length;
    const manualRequiredCount = items.filter(
      (item) => item.status === 'waiting_manual_verify'
    ).length;
    const snapshotCount = items.reduce((sum, item) => sum + item.snapshotCount, 0);
    const reviewCount = items.reduce((sum, item) => sum + item.reviewCount, 0);
    const pendingReviewCount = await this.prisma.applePriceChangeReview.count({
      where: { status: 'pending' }
    });
    const isFinished = totalCount > 0 && completedCount >= totalCount;
    const status = this.getBatchStatus({
      isFinished: finalize || isFinished,
      failedCount,
      manualRequiredCount
    });
    const message = this.buildBatchProgressMessage({
      completedCount,
      failedCount,
      manualRequiredCount,
      reviewCount,
      status,
      totalCount
    });
    const finishedAt = isFinished || finalize ? new Date() : null;

    const batch = await this.prisma.appleOfficialPriceCheckBatch.update({
      where: { id: batchId },
      data: {
        status,
        totalCount,
        completedCount,
        successCount,
        failedCount,
        manualRequiredCount,
        snapshotCount,
        reviewCount,
        pendingReviewCount,
        message,
        finishedAt: finishedAt ?? undefined
      },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } }
    });

    this.publishChanged(
      'apple.official_price.batch_progress',
      'official_price_check_batch',
      status,
      batch.id,
      {
        completedCount,
        failedCount,
        manualRequiredCount,
        totalCount
      }
    );

    return batch;
  }

  private getBatchStatus(input: {
    failedCount: number;
    isFinished: boolean;
    manualRequiredCount: number;
  }): AutomationTaskStatus {
    if (!input.isFinished) return 'running';
    if (input.failedCount > 0) return 'failed';
    if (input.manualRequiredCount > 0) return 'waiting_manual_verify';
    return 'success';
  }

  private buildBatchProgressMessage(input: {
    completedCount: number;
    failedCount: number;
    manualRequiredCount: number;
    reviewCount: number;
    status: AutomationTaskStatus;
    totalCount: number;
  }) {
    if (input.status === 'running') {
      return `官方价格采集中：${input.completedCount}/${input.totalCount}`;
    }
    return `官方价格采集完成：成功 ${input.completedCount - input.failedCount - input.manualRequiredCount}，失败 ${input.failedCount}，人工确认 ${input.manualRequiredCount}，新增待确认 ${input.reviewCount}`;
  }

  private async findCheckBatchOrThrow(id: string) {
    const batchId = this.normalizeRequiredUuid(id, 'id');
    const batch = await this.prisma.appleOfficialPriceCheckBatch.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } }
    });

    if (!batch) {
      throw new NotFoundException('Apple official price check batch not found');
    }

    return batch;
  }

  private buildOfficialPriceBatchScopeKey(
    provider: OfficialPriceProviderKey | 'all',
    trigger: string,
    scanRemovedPlans: boolean,
    plan: OfficialPriceBatchPlanItem[]
  ) {
    const raw = JSON.stringify({
      provider,
      trigger,
      scanRemovedPlans,
      plan: plan
        .map((item) => `${item.provider}:${item.region}:${item.currency}`)
        .sort((left, right) => left.localeCompare(right))
    });
    return `${provider}:${createHash('sha1').update(raw).digest('hex')}`;
  }

  private getBatchOperator(batch: Pick<AppleOfficialPriceCheckBatch, 'createdByUserId'>) {
    if (!batch.createdByUserId) return undefined;
    return {
      id: batch.createdByUserId,
      username: 'batch-runner',
      displayName: '批量采集',
      roles: [],
      permissions: []
    } satisfies AuthenticatedUser;
  }

  private toCheckBatchResponse(batch: OfficialPriceBatchWithItems) {
    return {
      id: batch.id,
      provider: batch.provider,
      trigger: batch.trigger,
      scanRemovedPlans: batch.scanRemovedPlans,
      status: batch.status,
      totalCount: batch.totalCount,
      completedCount: batch.completedCount,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      manualRequiredCount: batch.manualRequiredCount,
      snapshotCount: batch.snapshotCount,
      reviewCount: batch.reviewCount,
      pendingReviewCount: batch.pendingReviewCount,
      message: batch.message,
      errorMessage: batch.errorMessage,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      items: batch.items.map((item) => ({
        id: item.id,
        batchId: item.batchId,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        provider: item.provider,
        region: item.region,
        currency: item.currency,
        status: item.status,
        taskId: item.taskId,
        snapshotCount: item.snapshotCount,
        reviewCount: item.reviewCount,
        message: item.message,
        errorMessage: item.errorMessage,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  private toCheckBatchResultRow(input: {
    batchItem: AppleOfficialPriceCheckBatchItem | null;
    snapshot: OfficialPriceSnapshotWithRelations | null;
    review: PriceChangeReviewWithRelations | null;
  }) {
    const snapshot = input.snapshot;
    const review = input.review;
    const newValue = review ? this.parseReviewNewValue(review.newValue) : null;
    const oldValue =
      review?.oldValue && typeof review.oldValue === 'object'
        ? (review.oldValue as Record<string, unknown>)
        : null;
    const status = this.getCheckBatchResultStatus(input.batchItem, review, snapshot);
    const provider =
      snapshot?.provider ??
      review?.snapshot?.provider ??
      input.batchItem?.provider ??
      review?.source?.provider ??
      '-';
    const serviceName =
      snapshot?.serviceName ??
      newValue?.serviceName ??
      review?.appleService?.name ??
      input.batchItem?.sourceName ??
      '-';
    const category =
      snapshot?.category ??
      newValue?.category ??
      (typeof oldValue?.category === 'string' ? oldValue.category : null) ??
      review?.appleService?.category ??
      '通用';
    const region =
      snapshot?.region ??
      newValue?.region ??
      review?.snapshot?.region ??
      input.batchItem?.region ??
      review?.source?.region ??
      '-';
    const currency =
      snapshot?.currency ??
      newValue?.currency ??
      review?.snapshot?.currency ??
      input.batchItem?.currency ??
      review?.source?.currency ??
      '-';

    return {
      id:
        review?.id ?? snapshot?.id ?? input.batchItem?.id ?? `${provider}:${region}:${serviceName}`,
      batchItemId: input.batchItem?.id ?? null,
      taskId:
        input.batchItem?.taskId ?? snapshot?.automationTaskId ?? review?.automationTaskId ?? null,
      snapshotId: snapshot?.id ?? review?.snapshotId ?? null,
      reviewId: review?.id ?? null,
      sourceId: input.batchItem?.sourceId ?? review?.sourceId ?? snapshot?.sourceId ?? null,
      sourceName:
        input.batchItem?.sourceName ?? review?.source?.name ?? snapshot?.source?.name ?? '-',
      provider,
      serviceName,
      category,
      region,
      currency,
      status,
      reviewStatus: review?.status ?? null,
      oldOfficialPrice:
        typeof oldValue?.officialPrice === 'string' || typeof oldValue?.officialPrice === 'number'
          ? String(oldValue.officialPrice)
          : (review?.appleService?.officialBasePrice.toString() ?? null),
      newOfficialPrice: snapshot?.officialPrice.toString() ?? newValue?.officialPrice ?? null,
      oldAppleBalancePrice:
        typeof oldValue?.appleBalancePrice === 'string' ||
        typeof oldValue?.appleBalancePrice === 'number'
          ? String(oldValue.appleBalancePrice)
          : (review?.appleService?.officialCostValue.toString() ?? null),
      newAppleBalancePrice:
        snapshot?.appleBalancePrice?.toString() ?? newValue?.appleBalancePrice ?? null,
      periodType:
        snapshot?.periodType ??
        newValue?.periodType ??
        review?.appleService?.defaultPeriodType ??
        null,
      periodValue:
        snapshot?.periodValue ??
        newValue?.periodValue ??
        review?.appleService?.defaultPeriodValue ??
        null,
      message:
        input.batchItem?.errorMessage ??
        input.batchItem?.message ??
        (status === 'unchanged' ? '本次巡检未发现变化' : null),
      collectedAt: snapshot?.collectedAt ?? review?.snapshot?.collectedAt ?? null
    };
  }

  private getCheckBatchResultStatus(
    batchItem: AppleOfficialPriceCheckBatchItem | null,
    review: PriceChangeReviewWithRelations | null,
    snapshot: OfficialPriceSnapshotWithRelations | null
  ) {
    if (batchItem?.status === 'failed') return 'failed';
    if (batchItem?.status === 'waiting_manual_verify') return 'manual_required';
    if (review) return review.changeType;
    if (snapshot) return 'unchanged';
    return batchItem?.status === 'success' ? 'unchanged' : 'manual_required';
  }

  private async collectSourceItems(
    source: AppleOfficialPriceSource
  ): Promise<NormalizedCollectedItem[]> {
    if (source.collectMethod === 'manual') return [];

    const sourceUrl =
      this.normalizeNullableString(source.sourceUrl) ?? this.getDefaultProviderSourceUrl(source);
    if (!sourceUrl) return [];

    let response: Response;
    try {
      response = await this.fetchOfficialPriceSource(sourceUrl);
    } catch (error) {
      const fallbackItems = this.collectOfficialProviderItems('', source, sourceUrl);
      if (fallbackItems) {
        return this.normalizeCollectedItems(fallbackItems.slice(0, AUTO_COLLECT_LIMIT), source);
      }
      throw error;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    const collectedItems =
      source.collectMethod === 'api' || contentType.toLowerCase().includes('json')
        ? this.collectApiItems(body, source)
        : this.collectOfficialProviderItems(body, source, sourceUrl) ||
          this.collectWebpageItems(body, source);

    return this.normalizeCollectedItems(collectedItems.slice(0, AUTO_COLLECT_LIMIT), source);
  }

  private async ensureProviderSource(
    provider: OfficialPriceProviderKey,
    region: OfficialPriceProviderRegion,
    operator?: AuthenticatedUser,
    options: { updateExisting?: boolean } = {}
  ) {
    const preset = buildOfficialPriceProviderPreset(provider, region);
    const existing = await this.prisma.appleOfficialPriceSource.findFirst({
      where: {
        deletedAt: null,
        provider,
        region: preset.region,
        currency: preset.currency
      },
      include: this.getSourceInclude()
    });

    if (existing) {
      if (!options.updateExisting) {
        return this.toSourceResponse(existing);
      }

      return this.updateSource(
        existing.id,
        {
          provider,
          region: preset.region,
          currency: preset.currency,
          sourceUrl: this.getProviderSourceUrlForUpdate(existing.sourceUrl, preset, provider),
          collectMethod: 'webpage',
          checkIntervalHours: existing.checkIntervalHours || preset.checkIntervalHours,
          status: 'enabled',
          remark: existing.remark || preset.remark
        },
        operator
      );
    }

    return this.createSource(
      {
        name: preset.name,
        provider,
        priceSourceType: 'official_web',
        region: preset.region,
        currency: preset.currency,
        sourceUrl: preset.sourceUrl,
        collectMethod: 'webpage',
        checkIntervalHours: preset.checkIntervalHours,
        status: 'enabled',
        remark: preset.remark
      },
      operator
    );
  }

  private getProviderSourceUrlForUpdate(
    existingUrl: string | null,
    preset: OfficialPriceProviderSourcePreset,
    provider: OfficialPriceProviderKey
  ) {
    const normalizedExistingUrl = this.normalizeNullableString(existingUrl);
    if (!normalizedExistingUrl) return preset.sourceUrl;
    if (normalizedExistingUrl === preset.sourceUrl) return normalizedExistingUrl;

    if (
      this.isOfficialProviderUrl(provider, normalizedExistingUrl) &&
      this.isOfficialProviderUrl(provider, preset.sourceUrl)
    ) {
      return preset.sourceUrl;
    }

    return normalizedExistingUrl;
  }

  private async ensureDefaultProviderSources() {
    let createdCount = 0;

    for (const provider of OFFICIAL_PRICE_PROVIDER_KEYS) {
      const profile = OFFICIAL_PRICE_PROVIDER_PROFILES[provider];

      for (const region of profile.defaultRegions) {
        const preset = buildOfficialPriceProviderPreset(provider, region);
        const existing = await this.prisma.appleOfficialPriceSource.findFirst({
          where: {
            deletedAt: null,
            provider,
            region: preset.region,
            currency: preset.currency
          }
        });

        if (existing) continue;

        await this.ensureProviderSource(provider, region, undefined, { updateExisting: false });
        createdCount += 1;
      }
    }

    return createdCount;
  }

  private async resolveProviderRegions(
    provider: OfficialPriceProviderKey,
    regions?: CheckOfficialPriceProviderDto['regions']
  ): Promise<OfficialPriceProviderRegion[]> {
    const profile = OFFICIAL_PRICE_PROVIDER_PROFILES[provider];
    if (!Array.isArray(regions) || regions.length === 0) {
      const configuredSources = await this.prisma.appleOfficialPriceSource.findMany({
        where: {
          deletedAt: null,
          provider,
          status: 'enabled'
        },
        orderBy: [{ region: 'asc' }, { currency: 'asc' }]
      });

      if (configuredSources.length) {
        return this.dedupeProviderRegions(
          configuredSources.map((source) => ({
            region: source.region,
            currency: source.currency,
            sourceUrl: source.sourceUrl
          }))
        );
      }

      return profile.defaultRegions;
    }

    return this.dedupeProviderRegions(
      regions.map((item) => ({
        region: this.normalizeCode(item.region, profile.defaultRegions[0]?.region ?? 'US'),
        currency: this.normalizeCode(item.currency, profile.defaultRegions[0]?.currency ?? 'USD'),
        sourceUrl:
          item.sourceUrl === undefined ? null : (this.normalizeNullableUrl(item.sourceUrl) ?? null)
      }))
    );
  }

  private dedupeProviderRegions(regions: OfficialPriceProviderRegion[]) {
    const seen = new Set<string>();
    const deduped: OfficialPriceProviderRegion[] = [];
    for (const region of regions) {
      const normalizedRegion = region.region.trim().toUpperCase();
      const normalizedCurrency = region.currency.trim().toUpperCase();
      const key = `${normalizedRegion}:${normalizedCurrency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        region: normalizedRegion,
        currency: normalizedCurrency,
        sourceUrl: region.sourceUrl
      });
    }
    return deduped;
  }

  private collectOfficialProviderItems(
    html: string,
    source: AppleOfficialPriceSource,
    sourceUrl: string
  ): OfficialPriceCollectedItemDto[] | null {
    const provider = normalizeOfficialPriceProvider(source.provider);
    if (!provider || !this.isOfficialProviderUrl(provider, sourceUrl)) return null;

    const profile = OFFICIAL_PRICE_PROVIDER_PROFILES[provider];
    const plainText = this.normalizeWhitespace(this.stripHtml(html));
    const items = profile.plans
      .map((plan) => this.buildProviderPlanItem(plan, source, plainText, sourceUrl))
      .filter((item): item is OfficialPriceCollectedItemDto => Boolean(item));

    return items.length ? this.dedupeCollectedItems(items) : [];
  }

  private buildProviderPlanItem(
    plan: OfficialPriceProviderPlan,
    source: AppleOfficialPriceSource,
    plainText: string,
    sourceUrl: string
  ): OfficialPriceCollectedItemDto | null {
    const requestedCurrency = source.currency.toUpperCase();
    const parsedPrice = this.extractProviderPlanPrice(plainText, plan, requestedCurrency);
    const requestedCatalogPrice = plan.currencyPrices[requestedCurrency];
    const officialPrice = plan.preferCatalogPrice
      ? (requestedCatalogPrice ?? parsedPrice)
      : (parsedPrice ?? requestedCatalogPrice);
    if (!officialPrice) return null;

    return {
      planCode: plan.planCode,
      serviceName: plan.serviceName,
      category: plan.category,
      region: source.region,
      currency: requestedCurrency,
      officialPrice,
      periodType: plan.periodType,
      periodValue: plan.periodValue,
      rawPayload: {
        parser: parsedPrice ? 'provider_page_text' : 'provider_catalog_fallback',
        provider: source.provider,
        planCode: plan.planCode,
        requestedCurrency,
        catalogCurrency: parsedPrice ? null : requestedCurrency,
        sourceUrl
      }
    };
  }

  private extractProviderPlanPrice(
    plainText: string,
    plan: OfficialPriceProviderPlan,
    currency: string
  ) {
    const lowerText = plainText.toLowerCase();
    const windows = [];

    for (const alias of plan.aliases) {
      const index = lowerText.indexOf(alias.toLowerCase());
      if (index < 0) continue;
      windows.push(plainText.slice(index, index + 700));
      windows.push(plainText.slice(Math.max(index - 180, 0), index + alias.length));
    }

    for (let index = 0; index < windows.length; index += 1) {
      const windowText = windows[index];
      const price =
        index % 2 === 0
          ? this.extractCurrencyPrice(windowText, currency)
          : this.extractLastCurrencyPrice(windowText, currency);
      if (price) return price;
    }

    return null;
  }

  private isOfficialProviderUrl(provider: OfficialPriceProviderKey, sourceUrl: string) {
    try {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
      return OFFICIAL_PRICE_PROVIDER_PROFILES[provider].hosts.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
      );
    } catch {
      return false;
    }
  }

  private getDefaultProviderSourceUrl(source: AppleOfficialPriceSource) {
    const provider = normalizeOfficialPriceProvider(source.provider);
    return provider ? OFFICIAL_PRICE_PROVIDER_PROFILES[provider].sourceUrl : null;
  }

  private async fetchOfficialPriceSource(sourceUrl: string) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'upgrade-insecure-requests': '1',
          'user-agent': OFFICIAL_PRICE_BROWSER_USER_AGENT
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

  private extractLastCurrencyPrice(text: string, currency: string): string | null {
    const tokens = this.getCurrencyTokens(currency).map((token) => this.escapeRegExp(token));
    if (!tokens.length) return this.extractDecimalString(text);

    const amountPattern = '([0-9][0-9,]*(?:\\.\\d{1,8})?)';
    const tokenPattern = tokens.join('|');
    const pattern = new RegExp(
      `(?:${tokenPattern})\\s*${amountPattern}|${amountPattern}\\s*(?:${tokenPattern})`,
      'gi'
    );
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      lastMatch = match;
    }

    return this.extractDecimalString(lastMatch?.[1] ?? lastMatch?.[2]);
  }

  private getCurrencyTokens(currency: string) {
    const normalized = currency.toUpperCase();
    const tokens = [normalized];
    if (normalized === 'USD') tokens.push('US$', '$');
    if (normalized === 'SGD') tokens.push('S$', 'SG$');
    if (normalized === 'HKD') tokens.push('HK$');
    if (normalized === 'MYR') tokens.push('RM');
    if (normalized === 'TWD') tokens.push('NT$', 'NTD');
    if (normalized === 'JPY') tokens.push('¥', '￥', 'JP¥');
    if (normalized === 'KRW') tokens.push('₩', 'KR₩');
    if (normalized === 'GBP') tokens.push('£');
    if (normalized === 'EUR') tokens.push('€');
    if (normalized === 'AUD') tokens.push('A$', 'AU$');
    if (normalized === 'CAD') tokens.push('C$', 'CA$');
    if (normalized === 'THB') tokens.push('฿');
    if (normalized === 'PHP') tokens.push('₱');
    if (normalized === 'IDR') tokens.push('Rp');
    if (normalized === 'VND') tokens.push('₫');
    if (normalized === 'INR') tokens.push('₹');
    if (normalized === 'TRY') tokens.push('₺', 'TL');
    if (normalized === 'BRL') tokens.push('R$');
    if (normalized === 'MXN') tokens.push('MX$');
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
        await this.ensureOfficialCollectedCategory(tx, item.category);
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
            automationTaskId: input.taskId,
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
        if (!change && matchedService) {
          await tx.appleServiceRegionPrice.upsert({
            where: {
              serviceId_region_currency: {
                serviceId: matchedService.id,
                region: item.region,
                currency: item.currency
              }
            },
            update: {
              sourceSnapshotId: snapshot.id,
              provider: item.provider,
              serviceName: item.serviceName,
              category: item.category,
              officialPrice: item.officialPrice,
              appleBalancePrice,
              periodType: item.periodType,
              periodValue: item.periodValue,
              status: 'active',
              collectedAt: snapshot.collectedAt,
              confirmedAt: snapshot.collectedAt,
              deletedAt: null,
              remark: '官方价格采集无变化自动同步'
            },
            create: {
              serviceId: matchedService.id,
              sourceSnapshotId: snapshot.id,
              provider: item.provider,
              serviceName: item.serviceName,
              category: item.category,
              region: item.region,
              currency: item.currency,
              officialPrice: item.officialPrice,
              appleBalancePrice,
              periodType: item.periodType,
              periodValue: item.periodValue,
              status: 'active',
              collectedAt: snapshot.collectedAt,
              confirmedAt: snapshot.collectedAt,
              remark: '官方价格采集无变化自动同步'
            }
          });
        }

        if (change) {
          const review = await tx.applePriceChangeReview.create({
            data: {
              sourceId: input.source.id,
              snapshotId: snapshot.id,
              appleServiceId: matchedService?.id ?? null,
              automationTaskId: input.taskId,
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
              automationTaskId: input.taskId,
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
      region: this.normalizeCode(typeof data.region === 'string' ? data.region : 'US', 'US'),
      currency: this.normalizeCode(
        typeof data.currency === 'string' ? data.currency : 'USD',
        'USD'
      ),
      officialPrice: this.normalizeDecimal(
        data.officialPrice as string | number,
        'newValue.officialPrice',
        '0'
      ),
      appleBalancePrice: this.normalizeDecimal(
        (data.appleBalancePrice ?? data.officialPrice) as string | number,
        'newValue.appleBalancePrice',
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

  private async ensureOfficialCollectedCategory(client: DataDictionaryClient, rawCategory: string) {
    const category = this.normalizeCategory(rawCategory);
    const existing = await client.dataDictionary.findFirst({
      where: {
        group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
        OR: [{ label: category }, { value: category }]
      }
    });

    if (!existing) {
      await client.dataDictionary.create({
        data: {
          group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
          code: this.buildOfficialCategoryDictionaryCode(category),
          label: category,
          value: category,
          status: 'active',
          remark: OFFICIAL_CATEGORY_REMARK
        }
      });
      return;
    }

    if (existing.status !== 'disabled') {
      return;
    }

    const nextRemark = existing.remark?.includes(OFFICIAL_DISABLED_CATEGORY_REMARK)
      ? existing.remark
      : [existing.remark, OFFICIAL_DISABLED_CATEGORY_REMARK].filter(Boolean).join('；');

    await client.dataDictionary.update({
      where: { id: existing.id },
      data: { remark: nextRemark }
    });
  }

  private async assertOfficialCategoryActive(category: string) {
    await this.ensureOfficialCollectedCategory(this.prisma, category);
    const normalizedCategory = this.normalizeCategory(category);
    const dictionary = await this.prisma.dataDictionary.findFirst({
      where: {
        group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
        OR: [{ label: normalizedCategory }, { value: normalizedCategory }]
      }
    });

    if (dictionary?.status !== 'active') {
      throw new ConflictException(
        `Apple ID 业务分类“${normalizedCategory}”已停用，请先到分类设置中启用后再审批`
      );
    }
  }

  private buildOfficialCategoryDictionaryCode(category: string) {
    const hash = createHash('sha1').update(category).digest('hex').slice(0, 12);
    return `official-${hash}`;
  }

  private inferProviderFromName(value: string) {
    const normalized = value.toLowerCase();
    if (normalized.includes('chatgpt') || normalized.includes('openai')) return 'chatgpt';
    if (normalized.includes('gemini') || normalized.includes('google')) return 'gemini';
    if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
    return 'custom';
  }

  private normalizeSupportedProvider(value: string) {
    const provider = normalizeOfficialPriceProvider(value);
    if (!provider) {
      throw new BadRequestException('provider must be chatgpt, gemini, or claude');
    }
    return provider;
  }

  private getProviderLabel(provider: OfficialPriceProviderKey) {
    return OFFICIAL_PRICE_PROVIDER_PROFILES[provider].label;
  }

  private getProviderShortLabel(provider: OfficialPriceProviderKey) {
    if (provider === 'chatgpt') return 'ChatGPT';
    if (provider === 'gemini') return 'Gemini';
    return 'Claude';
  }

  private getProviderRegionLabel(region: string, currency: string) {
    const labelByRegion: Record<string, string> = {
      AE: '阿联酋',
      AR: '阿根廷',
      AT: '奥地利',
      AU: '澳大利亚',
      BD: '孟加拉国',
      BE: '比利时',
      BR: '巴西',
      CA: '加拿大',
      CH: '瑞士',
      CL: '智利',
      CO: '哥伦比亚',
      CZ: '捷克',
      DE: '德国',
      DK: '丹麦',
      EG: '埃及',
      ES: '西班牙',
      EU: '欧元区',
      FI: '芬兰',
      FR: '法国',
      GB: '英国',
      GH: '加纳',
      GR: '希腊',
      HK: '中国香港',
      HU: '匈牙利',
      ID: '印度尼西亚',
      IE: '爱尔兰',
      IL: '以色列',
      IN: '印度',
      IT: '意大利',
      JP: '日本',
      KE: '肯尼亚',
      KR: '韩国',
      MA: '摩洛哥',
      MX: '墨西哥',
      MY: '马来西亚',
      NG: '尼日利亚',
      NL: '荷兰',
      NO: '挪威',
      NZ: '新西兰',
      PE: '秘鲁',
      PH: '菲律宾',
      PK: '巴基斯坦',
      PL: '波兰',
      PT: '葡萄牙',
      RO: '罗马尼亚',
      SA: '沙特阿拉伯',
      SE: '瑞典',
      SG: '新加坡',
      TH: '泰国',
      TR: '土耳其',
      TW: '中国台湾',
      UA: '乌克兰',
      US: '美国',
      VN: '越南',
      ZA: '南非'
    };
    return `${labelByRegion[region] ?? region} ${currency}`;
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
