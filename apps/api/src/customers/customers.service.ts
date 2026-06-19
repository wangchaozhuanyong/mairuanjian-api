import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { CustomerStatus, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { RevealCustomerPhoneDto } from './dto/reveal-customer-phone.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

interface ListCustomersQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  sourcePlatformId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface AuditRequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

const customerInclude = {
  sourcePlatform: {
    select: {
      id: true,
      name: true,
      code: true,
      type: true
    }
  },
  createdBy: {
    select: {
      id: true,
      username: true,
      displayName: true
    }
  },
  updatedBy: {
    select: {
      id: true,
      username: true,
      displayName: true
    }
  }
} satisfies Prisma.CustomerInclude;

const CUSTOMER_SORT_FIELDS: Record<string, keyof Prisma.CustomerOrderByWithRelationInput> = {
  name: 'name',
  contactName: 'contactName',
  phoneTail: 'phoneTail',
  wechat: 'wechat',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListCustomersQuery) {
    const pagination = getPagination(query);
    const status = this.parseStatus(query.status, false);
    const keyword = query.keyword?.trim();
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      sourcePlatformId: query.sourcePlatformId || undefined,
      OR: keyword
        ? [
            { name: { contains: keyword, mode: 'insensitive' } },
            { contactName: { contains: keyword, mode: 'insensitive' } },
            { wechat: { contains: keyword, mode: 'insensitive' } },
            { phoneTail: { contains: keyword.slice(-8), mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: customerInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.customer.count({ where })
    ]);

    return {
      items: items.map((customer) => this.toResponse(customer)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: customerInclude
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.toResponse(customer);
  }

  async create(dto: CreateCustomerDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.name, 'name');
    const sourcePlatformId = await this.resolveSourcePlatformId(dto.sourcePlatformId);
    const status = this.parseStatus(dto.status, true) ?? 'active';

    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name.trim(),
        contactName: this.normalizeNullableString(dto.contactName),
        phone: this.normalizeNullableString(dto.phone),
        phoneTail: this.getTail(dto.phone),
        wechat: this.normalizeNullableString(dto.wechat),
        sourcePlatformId,
        tags: this.normalizeTags(dto.tags),
        remark: this.normalizeNullableString(dto.remark),
        status,
        createdByUserId: operator?.id,
        updatedByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'customer',
      action: 'customer.create',
      objectType: 'customer',
      objectId: customer.id,
      afterData: this.redactSensitiveData({
        ...dto,
        sourcePlatformId,
        status
      }),
      remark: `Created customer ${customer.name}`
    });

    return this.get(customer.id);
  }

  async update(id: string, dto: UpdateCustomerDto, operator?: AuthenticatedUser) {
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: customerInclude
    });

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found');
    }

    const data: Prisma.CustomerUpdateInput = {
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

    if (dto.contactName !== undefined) {
      data.contactName = this.normalizeNullableString(dto.contactName);
    }

    if (dto.phone !== undefined) {
      data.phone = this.normalizeNullableString(dto.phone);
      data.phoneTail = this.getTail(dto.phone);
    }

    if (dto.wechat !== undefined) {
      data.wechat = this.normalizeNullableString(dto.wechat);
    }

    if (dto.sourcePlatformId !== undefined) {
      if (dto.sourcePlatformId === null || dto.sourcePlatformId === '') {
        data.sourcePlatform = { disconnect: true };
      } else {
        const sourcePlatformId = await this.resolveSourcePlatformId(dto.sourcePlatformId);
        if (!sourcePlatformId) {
          throw new BadRequestException('Source platform does not exist');
        }
        data.sourcePlatform = { connect: { id: sourcePlatformId } };
      }
    }

    if (dto.tags !== undefined) {
      data.tags = this.normalizeTags(dto.tags);
    }

    if (dto.remark !== undefined) {
      data.remark = this.normalizeNullableString(dto.remark);
    }

    if (dto.status !== undefined) {
      data.status = this.parseStatus(dto.status, true);
    }

    await this.prisma.customer.update({
      where: {
        id
      },
      data
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'customer',
      action: 'customer.update',
      objectType: 'customer',
      objectId: id,
      beforeData: this.toResponse(existingCustomer),
      afterData: this.toAuditJson(this.redactSensitiveData(dto)),
      remark: `Updated customer ${existingCustomer.name}`
    });

    return this.get(id);
  }

  async revealPhone(
    id: string,
    dto: RevealCustomerPhoneDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    this.assertPhonePermission(operator);
    const reason = this.normalizeRevealReason(dto.reason);
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.phone) {
      throw new NotFoundException('Customer phone not found');
    }

    await this.prisma.sensitiveAccessLog.create({
      data: {
        userId: operator?.id,
        module: 'customer',
        fieldName: 'phone',
        objectType: 'customer',
        objectId: customer.id,
        accessReason: reason,
        approved: true,
        ip: requestMeta?.ip ?? undefined,
        userAgent: requestMeta?.userAgent ?? undefined
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'customer',
      action: 'customer.phone.reveal',
      objectType: 'customer',
      objectId: customer.id,
      afterData: this.toAuditJson({
        field: 'phone',
        reason,
        customerName: customer.name,
        phoneTail: customer.phoneTail
      }),
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
      remark: `Revealed phone for customer ${customer.name}`
    });

    return {
      customerId: customer.id,
      phone: customer.phone,
      revealedAt: new Date().toISOString()
    };
  }

  async remove(id: string, operator?: AuthenticatedUser) {
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: customerInclude
    });

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.update({
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
      module: 'customer',
      action: 'customer.delete',
      objectType: 'customer',
      objectId: id,
      beforeData: this.toResponse(existingCustomer),
      remark: `Deleted customer ${existingCustomer.name}`
    });

    return {
      deleted: true
    };
  }

  private async resolveSourcePlatformId(sourcePlatformId?: string | null) {
    if (!sourcePlatformId) {
      return null;
    }

    const sourcePlatform = await this.prisma.sourcePlatform.findFirst({
      where: {
        id: sourcePlatformId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!sourcePlatform) {
      throw new BadRequestException('Source platform does not exist');
    }

    return sourcePlatform.id;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'active' || value === 'disabled') {
      return value satisfies CustomerStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid customer status');
    }

    return undefined;
  }

  private buildOrderBy(query: ListCustomersQuery): Prisma.CustomerOrderByWithRelationInput[] {
    const sortField = query.sortBy ? CUSTOMER_SORT_FIELDS[query.sortBy] : undefined;
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

  private normalizeRevealReason(value: string | null | undefined) {
    const reason = this.normalizeNullableString(value);
    if (!reason) {
      throw new BadRequestException('Reveal reason is required');
    }

    if (reason.length > 200) {
      throw new BadRequestException('Reveal reason is too long');
    }

    return reason;
  }

  private assertPhonePermission(operator?: AuthenticatedUser) {
    if (!operator) {
      throw new ForbiddenException('Permission denied');
    }

    if (operator.roles.includes('admin') || operator.permissions.includes('customer.view_phone')) {
      return;
    }

    throw new ForbiddenException('Permission denied');
  }

  private normalizeTags(tags?: string[]) {
    return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  }

  private getTail(value?: string | null) {
    const normalized = this.normalizeNullableString(value)?.replace(/\s+/g, '');
    return normalized ? normalized.slice(-4) : null;
  }

  private maskPhone(value?: string | null) {
    if (!value) {
      return null;
    }

    const compact = value.replace(/\s+/g, '');
    if (compact.length <= 4) {
      return '****';
    }

    return `${compact.slice(0, 3)}****${compact.slice(-4)}`;
  }

  private redactSensitiveData<T extends { phone?: unknown }>(data: T) {
    return {
      ...data,
      phone: data.phone ? '[masked]' : data.phone
    };
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(customer: Prisma.CustomerGetPayload<{ include: typeof customerInclude }>) {
    return {
      id: customer.id,
      name: customer.name,
      contactName: customer.contactName,
      maskedPhone: this.maskPhone(customer.phone),
      phoneTail: customer.phoneTail,
      wechat: customer.wechat,
      sourcePlatformId: customer.sourcePlatformId,
      sourcePlatform: customer.sourcePlatform,
      tags: customer.tags,
      remark: customer.remark,
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      createdBy: customer.createdBy,
      updatedBy: customer.updatedBy
    };
  }
}
