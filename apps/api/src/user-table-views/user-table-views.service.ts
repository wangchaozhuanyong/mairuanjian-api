import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma, UserTableView } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ListUserTableViewsQuery extends PaginationQuery {
  tableKey?: string;
  keyword?: string;
}

export interface SaveUserTableViewInput {
  tableKey?: string;
  viewName?: string;
  filters?: unknown;
  sortConfig?: unknown;
  columns?: unknown;
  density?: string;
  pageSize?: number | string;
  isDefault?: boolean;
}

type TableDensity = 'compact' | 'default' | 'loose';

const DENSITIES = new Set<TableDensity>(['compact', 'default', 'loose']);
const USER_TABLE_VIEW_LIST_CACHE_TTL_MS = 120_000;

interface ParsedTableViewInput {
  tableKey?: string;
  viewName?: string;
  filters?: Prisma.InputJsonObject;
  sortConfig?: Prisma.InputJsonObject;
  columns?: Prisma.InputJsonArray;
  density?: string;
  pageSize?: number;
  isDefault?: boolean;
}

@Injectable()
export class UserTableViewsService {
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async listViews(user: AuthenticatedUser, query: ListUserTableViewsQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('user-table-views', { userId: user.id, ...query }),
      USER_TABLE_VIEW_LIST_CACHE_TTL_MS,
      () => this.listViewsUncached(user, query)
    );
  }

  private async listViewsUncached(user: AuthenticatedUser, query: ListUserTableViewsQuery) {
    const pagination = getPagination(query);
    const tableKey = this.normalizeOptionalString(query.tableKey);
    const keyword = this.normalizeOptionalString(query.keyword);
    const where: Prisma.UserTableViewWhereInput = {
      userId: user.id,
      tableKey: tableKey ?? undefined,
      viewName: keyword
        ? {
            contains: keyword,
            mode: 'insensitive'
          }
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.userTableView.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.userTableView.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createView(user: AuthenticatedUser, dto: SaveUserTableViewInput) {
    const data = this.parseInput(dto, true);
    const view = await this.runWithUniqueHandling(async () =>
      this.prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.userTableView.updateMany({
            where: {
              userId: user.id,
              tableKey: data.tableKey
            },
            data: {
              isDefault: false
            }
          });
        }

        return tx.userTableView.create({
          data: {
            userId: user.id,
            tableKey: data.tableKey!,
            viewName: data.viewName!,
            filters: data.filters ?? {},
            sortConfig: data.sortConfig ?? {},
            columns: data.columns ?? [],
            density: data.density ?? 'default',
            pageSize: data.pageSize ?? 20,
            isDefault: data.isDefault ?? false
          }
        });
      })
    );

    await this.auditLogsService.create({
      userId: user.id,
      module: 'table_view',
      action: 'user_table_view.create',
      objectType: 'user_table_view',
      objectId: view.id,
      afterData: this.toAuditJson(this.toResponse(view)),
      remark: `Created table view ${view.tableKey}/${view.viewName}`
    });

    this.listCache.clear();

    return this.toResponse(view);
  }

  async updateView(user: AuthenticatedUser, id: string, dto: Partial<SaveUserTableViewInput>) {
    const current = await this.findOwnedView(user.id, id);
    const data = this.parseInput(dto, false, current);
    const view = await this.runWithUniqueHandling(async () =>
      this.prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.userTableView.updateMany({
            where: {
              userId: user.id,
              tableKey: data.tableKey ?? current.tableKey,
              id: {
                not: id
              }
            },
            data: {
              isDefault: false
            }
          });
        }

        return tx.userTableView.update({
          where: {
            id
          },
          data
        });
      })
    );

    await this.auditLogsService.create({
      userId: user.id,
      module: 'table_view',
      action: 'user_table_view.update',
      objectType: 'user_table_view',
      objectId: view.id,
      beforeData: this.toAuditJson(this.toResponse(current)),
      afterData: this.toAuditJson(this.toResponse(view)),
      remark: `Updated table view ${view.tableKey}/${view.viewName}`
    });

    this.listCache.clear();

    return this.toResponse(view);
  }

  async removeView(user: AuthenticatedUser, id: string) {
    const current = await this.findOwnedView(user.id, id);
    await this.prisma.userTableView.delete({
      where: {
        id
      }
    });
    await this.auditLogsService.create({
      userId: user.id,
      module: 'table_view',
      action: 'user_table_view.delete',
      objectType: 'user_table_view',
      objectId: current.id,
      beforeData: this.toAuditJson(this.toResponse(current)),
      remark: `Deleted table view ${current.tableKey}/${current.viewName}`
    });

    this.listCache.clear();

    return {
      deleted: true
    };
  }

  async setDefault(user: AuthenticatedUser, id: string) {
    const current = await this.findOwnedView(user.id, id);
    const view = await this.prisma.$transaction(async (tx) => {
      await tx.userTableView.updateMany({
        where: {
          userId: user.id,
          tableKey: current.tableKey,
          id: {
            not: id
          }
        },
        data: {
          isDefault: false
        }
      });

      return tx.userTableView.update({
        where: {
          id
        },
        data: {
          isDefault: true
        }
      });
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'table_view',
      action: 'user_table_view.set_default',
      objectType: 'user_table_view',
      objectId: view.id,
      afterData: this.toAuditJson(this.toResponse(view)),
      remark: `Set default table view ${view.tableKey}/${view.viewName}`
    });

    this.listCache.clear();

    return this.toResponse(view);
  }

  private async findOwnedView(userId: string, id: string) {
    const view = await this.prisma.userTableView.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!view) {
      throw new NotFoundException('Table view not found');
    }

    return view;
  }

  private parseInput(
    dto: Partial<SaveUserTableViewInput>,
    requireFields: boolean,
    current?: UserTableView
  ): ParsedTableViewInput {
    const tableKey = this.normalizeOptionalString(dto.tableKey);
    const viewName = this.normalizeOptionalString(dto.viewName);
    const density = this.normalizeOptionalString(dto.density);

    if (requireFields && !tableKey) {
      throw new BadRequestException('tableKey is required');
    }
    if (requireFields && !viewName) {
      throw new BadRequestException('viewName is required');
    }

    if (density && !DENSITIES.has(density as TableDensity)) {
      throw new BadRequestException('density is invalid');
    }

    const data: ParsedTableViewInput = {};

    if (tableKey) data.tableKey = tableKey;
    if (viewName) data.viewName = viewName;
    if ('filters' in dto) data.filters = this.parseJsonObject(dto.filters, 'filters');
    if ('sortConfig' in dto) data.sortConfig = this.parseJsonObject(dto.sortConfig, 'sortConfig');
    if ('columns' in dto) data.columns = this.parseJsonArray(dto.columns, 'columns');
    if (density) data.density = density;
    if ('pageSize' in dto) data.pageSize = this.parsePageSize(dto.pageSize);
    if (dto.isDefault !== undefined) data.isDefault = Boolean(dto.isDefault);

    if (requireFields) {
      data.filters ??= {};
      data.sortConfig ??= {};
      data.columns ??= [];
      data.density ??= 'default';
      data.pageSize ??= 20;
      data.isDefault ??= false;
    }

    if (
      current &&
      data.tableKey &&
      data.tableKey !== current.tableKey &&
      data.isDefault === undefined
    ) {
      data.isDefault = false;
    }

    return data;
  }

  private parsePageSize(value: number | string | undefined) {
    if (value === undefined || value === '') {
      return 20;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException('pageSize must be an integer between 1 and 100');
    }

    return parsed;
  }

  private parseJsonObject(value: unknown, field: string): Prisma.InputJsonObject {
    if (value === undefined || value === null) {
      return {};
    }

    if (!this.isPlainObject(value)) {
      throw new BadRequestException(`${field} must be an object`);
    }

    return value as Prisma.InputJsonObject;
  }

  private parseJsonArray(value: unknown, field: string): Prisma.InputJsonArray {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException(`${field} must be an array`);
    }

    return value as Prisma.InputJsonArray;
  }

  private normalizeOptionalString(value: string | undefined) {
    const normalized = value?.trim();
    return normalized || undefined;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  private async runWithUniqueHandling<T>(handler: () => Promise<T>) {
    try {
      return await handler();
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Table view already exists');
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      this.isPlainObject(error) && 'code' in error && (error as { code?: unknown }).code === 'P2002'
    );
  }

  private toResponse(view: UserTableView) {
    return {
      id: view.id,
      userId: view.userId,
      tableKey: view.tableKey,
      viewName: view.viewName,
      filters: view.filters,
      sortConfig: view.sortConfig,
      columns: view.columns,
      density: view.density,
      pageSize: view.pageSize,
      isDefault: view.isDefault,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt
    };
  }

  private toAuditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
