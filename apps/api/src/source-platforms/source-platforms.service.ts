import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  Prisma,
  SourcePlatform,
  SourcePlatformStatus,
  SourcePlatformType
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateSourcePlatformDto } from './dto/create-source-platform.dto';
import type { UpdateSourcePlatformDto } from './dto/update-source-platform.dto';

interface ListSourcePlatformsQuery extends PaginationQuery {
  keyword?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

const SOURCE_PLATFORM_SORT_FIELDS: Record<
  string,
  keyof Prisma.SourcePlatformOrderByWithRelationInput
> = {
  name: 'name',
  code: 'code',
  type: 'type',
  feeRate: 'feeRate',
  feeFixed: 'feeFixed',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const SOURCE_PLATFORM_LIST_CACHE_TTL_MS = 120_000;

@Injectable()
export class SourcePlatformsService {
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListSourcePlatformsQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('source-platforms', query),
      SOURCE_PLATFORM_LIST_CACHE_TTL_MS,
      () => this.listUncached(query)
    );
  }

  private async listUncached(query: ListSourcePlatformsQuery) {
    const pagination = getPagination(query);
    const type = this.parseType(query.type, false);
    const status = this.parseStatus(query.status, false);
    const keyword = query.keyword?.trim();
    const where: Prisma.SourcePlatformWhereInput = {
      deletedAt: null,
      type: type ?? undefined,
      status: status ?? undefined,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { code: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sourcePlatform.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.sourcePlatform.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const sourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!sourcePlatform) {
      throw new NotFoundException('Source platform not found');
    }

    return this.toResponse(sourcePlatform);
  }

  async create(dto: CreateSourcePlatformDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');
    this.assertRequiredString(dto.code, 'code');

    const code = this.normalizeCode(dto.code);
    await this.assertCodeAvailable(code);

    const sourcePlatform = await this.prisma.sourcePlatform.create({
      data: {
        name: dto.name.trim(),
        code,
        type: this.parseType(dto.type, true) ?? 'other',
        feeRate: this.normalizeDecimal(dto.feeRate, 'feeRate'),
        feeFixed: this.normalizeDecimal(dto.feeFixed, 'feeFixed'),
        syncEnabled: Boolean(dto.syncEnabled),
        deliveryEnabled: Boolean(dto.deliveryEnabled),
        status: this.parseStatus(dto.status, true) ?? 'active',
        remark: this.normalizeNullableString(dto.remark),
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'source_platform',
      action: 'source_platform.create',
      objectType: 'source_platform',
      objectId: sourcePlatform.id,
      afterData: this.toResponse(sourcePlatform),
      remark: `Created source platform ${sourcePlatform.code}`
    });

    this.listCache.clear();

    return this.get(sourcePlatform.id);
  }

  async update(id: string, dto: UpdateSourcePlatformDto, operator?: AuthenticatedUser) {
    const existingSourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingSourcePlatform) {
      throw new NotFoundException('Source platform not found');
    }

    const data: Prisma.SourcePlatformUpdateInput = {
      updatedBy: operator?.id
        ? {
            connect: {
              id: operator.id
            }
          }
        : undefined
    };

    if (dto.name !== undefined) {
      this.assertRequiredString(dto.name, 'name');
      data.name = dto.name.trim();
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      await this.assertCodeAvailable(code, id);
      data.code = code;
    }

    if (dto.type !== undefined) {
      data.type = this.parseType(dto.type, true);
    }

    if (dto.feeRate !== undefined) {
      data.feeRate = this.normalizeDecimal(dto.feeRate, 'feeRate');
    }

    if (dto.feeFixed !== undefined) {
      data.feeFixed = this.normalizeDecimal(dto.feeFixed, 'feeFixed');
    }

    if (dto.syncEnabled !== undefined) {
      data.syncEnabled = Boolean(dto.syncEnabled);
    }

    if (dto.deliveryEnabled !== undefined) {
      data.deliveryEnabled = Boolean(dto.deliveryEnabled);
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    await this.prisma.sourcePlatform.update({
      where: {
        id
      },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'source_platform',
      action: 'source_platform.update',
      objectType: 'source_platform',
      objectId: id,
      beforeData: this.toResponse(existingSourcePlatform),
      afterData: this.toAuditJson(dto),
      remark: `Updated source platform ${existingSourcePlatform.code}`
    });

    this.listCache.clear();

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingSourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingSourcePlatform) {
      throw new NotFoundException('Source platform not found');
    }

    await this.prisma.sourcePlatform.update({
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
      module: 'source_platform',
      action: 'source_platform.delete',
      objectType: 'source_platform',
      objectId: id,
      beforeData: this.toResponse(existingSourcePlatform),
      remark: `Deleted source platform ${existingSourcePlatform.code}`
    });

    this.listCache.clear();

    return {
      deleted: true
    };
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existingSourcePlatform = await this.prisma.sourcePlatform.findUnique({
      where: {
        code
      },
      select: {
        id: true
      }
    });

    if (existingSourcePlatform && existingSourcePlatform.id !== currentId) {
      throw new ConflictException('Source platform code already exists');
    }
  }

  private parseType(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'taobao' ||
      value === 'xianyu' ||
      value === 'wechat' ||
      value === 'manual' ||
      value === 'other'
    ) {
      return value satisfies SourcePlatformType;
    }

    if (strict) {
      throw new BadRequestException('Invalid source platform type');
    }

    return undefined;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'active' || value === 'disabled') {
      return value satisfies SourcePlatformStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid source platform status');
    }

    return undefined;
  }

  private assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private normalizeCode(value: string) {
    const code = value.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(code)) {
      throw new BadRequestException('code can only contain lowercase letters, numbers, _ and -');
    }

    return code;
  }

  private normalizeDecimal(value: string | number | undefined, field: string) {
    if (value === undefined || value === '') {
      return '0';
    }

    const normalized = String(value).trim();
    if (!/^\d+(\.\d{1,4})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a valid decimal`);
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

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private buildOrderBy(query: ListSourcePlatformsQuery) {
    const sortField = query.sortBy ? SOURCE_PLATFORM_SORT_FIELDS[query.sortBy] : undefined;
    if (!sortField) {
      return [{ createdAt: 'desc' as const }];
    }

    const direction = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.SourcePlatformOrderByWithRelationInput[] = [
      {
        [sortField]: direction
      }
    ];

    if (sortField !== 'createdAt') {
      orderBy.push({ createdAt: 'desc' });
    }

    return orderBy;
  }

  private toResponse(sourcePlatform: SourcePlatform) {
    return {
      id: sourcePlatform.id,
      name: sourcePlatform.name,
      code: sourcePlatform.code,
      type: sourcePlatform.type,
      feeRate: sourcePlatform.feeRate.toString(),
      feeFixed: sourcePlatform.feeFixed.toString(),
      syncEnabled: sourcePlatform.syncEnabled,
      deliveryEnabled: sourcePlatform.deliveryEnabled,
      status: sourcePlatform.status,
      remark: sourcePlatform.remark,
      createdAt: sourcePlatform.createdAt,
      updatedAt: sourcePlatform.updatedAt
    };
  }
}
