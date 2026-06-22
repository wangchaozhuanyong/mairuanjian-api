import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppleAccountSourceChannel,
  AppleAccountSourceChannelStatus,
  Prisma
} from '@prisma/client';
import { AppleAccountsService } from '../apple-accounts/apple-accounts.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAppleAccountSourceChannelDto } from './dto/create-apple-account-source-channel.dto';
import type { UpdateAppleAccountSourceChannelDto } from './dto/update-apple-account-source-channel.dto';

interface ListAppleAccountSourceChannelsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

const APPLE_ACCOUNT_SOURCE_CHANNEL_SORT_FIELDS: Record<
  string,
  keyof Prisma.AppleAccountSourceChannelOrderByWithRelationInput
> = {
  name: 'name',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const APPLE_ACCOUNT_SOURCE_CHANNEL_LIST_CACHE_TTL_MS = 120_000;

@Injectable()
export class AppleAccountSourceChannelsService {
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly appleAccountsService: AppleAccountsService
  ) {}

  async list(query: ListAppleAccountSourceChannelsQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('apple-account-source-channels', query),
      APPLE_ACCOUNT_SOURCE_CHANNEL_LIST_CACHE_TTL_MS,
      () => this.listUncached(query)
    );
  }

  private async listUncached(query: ListAppleAccountSourceChannelsQuery) {
    const pagination = getPagination(query);
    const status = this.parseStatus(query.status, false);
    const keyword = query.keyword?.trim();
    const where: Prisma.AppleAccountSourceChannelWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleAccountSourceChannel.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.appleAccountSourceChannel.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const channel = await this.prisma.appleAccountSourceChannel.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!channel) {
      throw new NotFoundException('Apple account source channel not found');
    }

    return this.toResponse(channel);
  }

  async create(dto: CreateAppleAccountSourceChannelDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');

    const channel = await this.prisma.appleAccountSourceChannel.create({
      data: {
        name: dto.name.trim(),
        status: this.parseStatus(dto.status, true) ?? 'active',
        remark: this.normalizeNullableString(dto.remark),
        ...(operator?.id
          ? {
              createdBy: { connect: { id: operator.id } },
              updatedBy: { connect: { id: operator.id } }
            }
          : {})
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account_source_channel',
      action: 'apple_account_source_channel.create',
      objectType: 'apple_account_source_channel',
      objectId: channel.id,
      afterData: this.toResponse(channel),
      remark: `Created Apple ID source channel ${channel.name}`
    });

    this.invalidateCaches();
    return this.get(channel.id);
  }

  async update(id: string, dto: UpdateAppleAccountSourceChannelDto, operator?: AuthenticatedUser) {
    const existingChannel = await this.prisma.appleAccountSourceChannel.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingChannel) {
      throw new NotFoundException('Apple account source channel not found');
    }

    const data: Prisma.AppleAccountSourceChannelUpdateInput = {
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

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    await this.prisma.appleAccountSourceChannel.update({
      where: {
        id
      },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account_source_channel',
      action: 'apple_account_source_channel.update',
      objectType: 'apple_account_source_channel',
      objectId: id,
      beforeData: this.toResponse(existingChannel),
      afterData: this.toAuditJson(dto),
      remark: `Updated Apple ID source channel ${existingChannel.name}`
    });

    this.invalidateCaches();
    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingChannel = await this.prisma.appleAccountSourceChannel.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!existingChannel) {
      throw new NotFoundException('Apple account source channel not found');
    }

    await this.prisma.appleAccountSourceChannel.update({
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
      module: 'apple_account_source_channel',
      action: 'apple_account_source_channel.delete',
      objectType: 'apple_account_source_channel',
      objectId: id,
      beforeData: this.toResponse(existingChannel),
      remark: `Deleted Apple ID source channel ${existingChannel.name}`
    });

    this.invalidateCaches();
    return {
      deleted: true
    };
  }

  private invalidateCaches() {
    this.listCache.clear();
    this.appleAccountsService.invalidateListCache();
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'active' || value === 'disabled') {
      return value satisfies AppleAccountSourceChannelStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple ID source channel status');
    }

    return undefined;
  }

  private assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private buildOrderBy(query: ListAppleAccountSourceChannelsQuery) {
    const sortField = query.sortBy
      ? APPLE_ACCOUNT_SOURCE_CHANNEL_SORT_FIELDS[query.sortBy]
      : undefined;
    if (!sortField) {
      return [{ createdAt: 'desc' as const }];
    }

    const direction = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.AppleAccountSourceChannelOrderByWithRelationInput[] = [
      {
        [sortField]: direction
      }
    ];

    if (sortField !== 'createdAt') {
      orderBy.push({ createdAt: 'desc' });
    }

    return orderBy;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(channel: AppleAccountSourceChannel) {
    return {
      id: channel.id,
      name: channel.name,
      status: channel.status,
      remark: channel.remark,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt
    };
  }
}
