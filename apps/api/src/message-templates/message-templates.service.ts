import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MessageTemplateChannel,
  MessageTemplateStatus,
  MessageTemplateType,
  Prisma
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import type { UpdateMessageTemplateDto } from './dto/update-message-template.dto';

interface ListMessageTemplatesQuery extends PaginationQuery {
  keyword?: string;
  type?: string;
  channel?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

const MESSAGE_TEMPLATE_SORT_FIELDS: Record<
  string,
  keyof Prisma.MessageTemplateOrderByWithRelationInput
> = {
  name: 'name',
  type: 'type',
  channel: 'channel',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};
const MESSAGE_TEMPLATE_LIST_CACHE_TTL_MS = 120_000;
const DELIVERY_TEMPLATE_TYPE = 'delivery' satisfies MessageTemplateType;
const DELIVERY_TEMPLATE_CHANNEL = 'customer_service' satisfies MessageTemplateChannel;
const DELIVERY_TEMPLATE_SCOPE = {
  type: DELIVERY_TEMPLATE_TYPE,
  channel: DELIVERY_TEMPLATE_CHANNEL
} satisfies Pick<Prisma.MessageTemplateWhereInput, 'type' | 'channel'>;

@Injectable()
export class MessageTemplatesService {
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListMessageTemplatesQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('message-templates', query),
      MESSAGE_TEMPLATE_LIST_CACHE_TTL_MS,
      () => this.listUncached(query)
    );
  }

  private async listUncached(query: ListMessageTemplatesQuery) {
    const pagination = getPagination(query);
    this.assertDeliveryTemplateType(query.type);
    this.assertDeliveryTemplateChannel(query.channel);
    const status = this.parseStatus(query.status, false);
    const keyword = query.keyword?.trim();
    const where: Prisma.MessageTemplateWhereInput = {
      deletedAt: null,
      ...DELIVERY_TEMPLATE_SCOPE,
      status: status ?? undefined,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.messageTemplate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.messageTemplate.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...DELIVERY_TEMPLATE_SCOPE
      }
    });

    if (!template) {
      throw new NotFoundException('Message template not found');
    }

    return template;
  }

  async create(dto: CreateMessageTemplateDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');
    this.assertRequiredString(dto.content, 'content');
    this.assertDeliveryTemplateType(dto.type);
    this.assertDeliveryTemplateChannel(dto.channel);

    const template = await this.prisma.messageTemplate.create({
      data: {
        name: dto.name.trim(),
        ...DELIVERY_TEMPLATE_SCOPE,
        content: dto.content.trim(),
        variables: this.normalizeVariables(dto.content, dto.variables),
        status: this.parseStatus(dto.status, true) ?? 'active',
        remark: this.normalizeNullableString(dto.remark),
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'message_template',
      action: 'message_template.create',
      objectType: 'message_template',
      objectId: template.id,
      afterData: template,
      remark: `Created message template ${template.name}`
    });

    this.listCache.clear();

    return this.get(template.id);
  }

  async update(id: string, dto: UpdateMessageTemplateDto, operator?: AuthenticatedUser) {
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...DELIVERY_TEMPLATE_SCOPE
      }
    });

    if (!existingTemplate) {
      throw new NotFoundException('Message template not found');
    }

    const content = dto.content === undefined ? existingTemplate.content : dto.content;
    const data: Prisma.MessageTemplateUpdateInput = {
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

    this.assertDeliveryTemplateType(dto.type);
    this.assertDeliveryTemplateChannel(dto.channel);

    if (dto.content !== undefined) {
      this.assertRequiredString(dto.content, 'content');
      data.content = dto.content.trim();
    }

    if (dto.variables !== undefined || dto.content !== undefined) {
      data.variables = this.normalizeVariables(
        content,
        dto.variables ?? existingTemplate.variables
      );
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    await this.prisma.messageTemplate.update({
      where: {
        id
      },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'message_template',
      action: 'message_template.update',
      objectType: 'message_template',
      objectId: id,
      beforeData: existingTemplate,
      afterData: this.toAuditJson(dto),
      remark: `Updated message template ${existingTemplate.name}`
    });

    this.listCache.clear();

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...DELIVERY_TEMPLATE_SCOPE
      }
    });

    if (!existingTemplate) {
      throw new NotFoundException('Message template not found');
    }

    await this.prisma.messageTemplate.update({
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
      module: 'message_template',
      action: 'message_template.delete',
      objectType: 'message_template',
      objectId: id,
      beforeData: existingTemplate,
      remark: `Deleted message template ${existingTemplate.name}`
    });

    this.listCache.clear();

    return {
      deleted: true
    };
  }

  private buildOrderBy(
    query: ListMessageTemplatesQuery
  ): Prisma.MessageTemplateOrderByWithRelationInput[] {
    const sortOrder = this.parseSortOrder(query.sortOrder);
    const sortField = query.sortBy ? MESSAGE_TEMPLATE_SORT_FIELDS[query.sortBy] : undefined;

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

  normalizeVariables(content: string, variables?: string[]) {
    const extractedVariables = [...content.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map(
      (match) => match[1]
    );

    return [...new Set([...(variables ?? []), ...extractedVariables])]
      .map((variable) => variable.trim())
      .filter(Boolean)
      .sort();
  }

  private assertDeliveryTemplateType(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (value !== DELIVERY_TEMPLATE_TYPE) {
      throw new BadRequestException('Delivery templates only support type=delivery');
    }
  }

  private assertDeliveryTemplateChannel(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (value !== DELIVERY_TEMPLATE_CHANNEL) {
      throw new BadRequestException('Delivery templates only support channel=customer_service');
    }
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'active' || value === 'disabled') {
      return value satisfies MessageTemplateStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid message template status');
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

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }
}
