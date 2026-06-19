import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MessageTemplateChannel,
  MessageTemplateStatus,
  MessageTemplateType,
  Prisma
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
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

@Injectable()
export class MessageTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListMessageTemplatesQuery) {
    const pagination = getPagination(query);
    const type = this.parseType(query.type, false);
    const channel = this.parseChannel(query.channel, false);
    const status = this.parseStatus(query.status, false);
    const keyword = query.keyword?.trim();
    const where: Prisma.MessageTemplateWhereInput = {
      deletedAt: null,
      type: type ?? undefined,
      channel: channel ?? undefined,
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
        deletedAt: null
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

    const template = await this.prisma.messageTemplate.create({
      data: {
        name: dto.name.trim(),
        type: this.parseType(dto.type, true) ?? 'custom',
        channel: this.parseChannel(dto.channel, true) ?? 'internal',
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

    return this.get(template.id);
  }

  async update(id: string, dto: UpdateMessageTemplateDto, operator?: AuthenticatedUser) {
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        deletedAt: null
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

    if (dto.type !== undefined) {
      data.type = this.parseType(dto.type, true);
    }

    if (dto.channel !== undefined) {
      data.channel = this.parseChannel(dto.channel, true);
    }

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

    return this.get(id);
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        deletedAt: null
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

  private parseType(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'renewal' ||
      value === 'delivery' ||
      value === 'after_sale' ||
      value === 'notification' ||
      value === 'custom'
    ) {
      return value satisfies MessageTemplateType;
    }

    if (strict) {
      throw new BadRequestException('Invalid message template type');
    }

    return undefined;
  }

  private parseChannel(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'internal' || value === 'telegram' || value === 'customer_service') {
      return value satisfies MessageTemplateChannel;
    }

    if (strict) {
      throw new BadRequestException('Invalid message template channel');
    }

    return undefined;
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
