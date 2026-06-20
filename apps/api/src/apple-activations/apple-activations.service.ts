import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AutoRenewStatus,
  Prisma,
  RenewalDecision,
  ServiceActivationStatus
} from '@prisma/client';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';

interface ListActivationsQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  customerId?: string;
  appleAccountId?: string;
  serviceId?: string;
  sourcePlatformId?: string;
  autoRenewStatus?: string;
  renewalDecision?: string;
  expireFrom?: string;
  expireTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

const ACTIVATION_SORT_FIELDS: Record<
  string,
  keyof Prisma.ServiceActivationOrderByWithRelationInput
> = {
  externalOrderNo: 'externalOrderNo',
  currentPlan: 'currentPlan',
  targetPlan: 'targetPlan',
  startTime: 'startTime',
  expireTime: 'expireTime',
  consumedValue: 'consumedValue',
  avgUnitCost: 'avgUnitCost',
  costRmb: 'costRmb',
  paidAmount: 'paidAmount',
  platformFee: 'platformFee',
  refundLoss: 'refundLoss',
  profitAmount: 'profitAmount',
  status: 'status',
  autoRenewStatus: 'autoRenewStatus',
  renewalDecision: 'renewalDecision',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

const activationInclude = {
  order: {
    select: {
      id: true,
      orderNo: true,
      status: true
    }
  },
  customer: {
    select: {
      id: true,
      name: true,
      wechat: true
    }
  },
  appleAccount: true,
  service: {
    select: {
      id: true,
      name: true,
      category: true,
      currency: true
    }
  },
  sourcePlatform: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.ServiceActivationInclude;

@Injectable()
export class AppleActivationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListActivationsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const autoRenewStatus = this.parseAutoRenewStatus(query.autoRenewStatus, false);
    const renewalDecision = this.parseRenewalDecision(query.renewalDecision, false);
    const where: Prisma.ServiceActivationWhereInput = {
      status: status ?? undefined,
      customerId: query.customerId || undefined,
      appleAccountId: query.appleAccountId || undefined,
      serviceId: query.serviceId || undefined,
      sourcePlatformId: query.sourcePlatformId || undefined,
      autoRenewStatus: autoRenewStatus ?? undefined,
      renewalDecision: renewalDecision ?? undefined,
      expireTime: this.buildDateRange(query.expireFrom, query.expireTo),
      OR: keyword
        ? [
            { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
            { currentPlan: { contains: keyword, mode: 'insensitive' } },
            { targetPlan: { contains: keyword, mode: 'insensitive' } },
            { renewalNote: { contains: keyword, mode: 'insensitive' } },
            { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { service: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { order: { is: { orderNo: { contains: keyword, mode: 'insensitive' } } } },
            {
              appleAccount: {
                is: {
                  appleIdNormalized: { contains: keyword.toLowerCase(), mode: 'insensitive' }
                }
              }
            }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceActivation.findMany({
        where,
        include: activationInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.serviceActivation.count({ where })
    ]);

    return {
      items: items.map((activation) => this.toResponse(activation)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const activation = await this.prisma.serviceActivation.findUnique({
      where: { id },
      include: activationInclude
    });

    if (!activation) {
      throw new NotFoundException('Apple activation not found');
    }

    return this.toResponse(activation);
  }

  calculateDaysUntilExpire(expireTime: Date | null, now = new Date()) {
    if (!expireTime) {
      return null;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((expireTime.getTime() - now.getTime()) / millisecondsPerDay);
  }

  private buildDateRange(expireFrom?: string, expireTo?: string) {
    const gte = this.parseDate(expireFrom, 'expireFrom');
    const lte = this.parseDate(expireTo, 'expireTo');

    if (!gte && !lte) {
      return undefined;
    }

    return {
      gte: gte ?? undefined,
      lte: lte ?? undefined
    };
  }

  private buildOrderBy(
    query: ListActivationsQuery
  ): Prisma.ServiceActivationOrderByWithRelationInput[] {
    const sortField = query.sortBy ? ACTIVATION_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ expireTime: 'asc' }, { createdAt: 'desc' }];
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

  private parseDate(value: string | undefined, field: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'active' ||
      value === 'expired' ||
      value === 'cancelled' ||
      value === 'abnormal'
    ) {
      return value satisfies ServiceActivationStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid activation status');
    }

    return undefined;
  }

  private parseAutoRenewStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'enabled' || value === 'disabled' || value === 'unknown') {
      return value satisfies AutoRenewStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid auto renew status');
    }

    return undefined;
  }

  private parseRenewalDecision(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'unconfirmed' ||
      value === 'renew' ||
      value === 'no_renew' ||
      value === 'change_plan'
    ) {
      return value satisfies RenewalDecision;
    }

    if (strict) {
      throw new BadRequestException('Invalid renewal decision');
    }

    return undefined;
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return value.length <= 4 ? '****' : `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    const prefix = name.length <= 2 ? `${name[0] ?? '*'}***` : `${name.slice(0, 2)}***`;
    return `${prefix}@${domain}`;
  }

  private toResponse(
    activation: Prisma.ServiceActivationGetPayload<{ include: typeof activationInclude }>
  ) {
    return {
      id: activation.id,
      orderId: activation.orderId,
      order: activation.order,
      customerId: activation.customerId,
      customer: activation.customer,
      appleAccountId: activation.appleAccountId,
      appleAccount: activation.appleAccount
        ? {
            id: activation.appleAccount.id,
            appleIdMasked: this.maskAppleId(activation.appleAccount.appleId),
            region: activation.appleAccount.region,
            currency: activation.appleAccount.currency,
            currentBalance: activation.appleAccount.currentBalance.toString(),
            averageCost: activation.appleAccount.averageCost.toString()
          }
        : null,
      serviceId: activation.serviceId,
      service: activation.service,
      currentPlan: activation.currentPlan,
      targetPlan: activation.targetPlan,
      startTime: activation.startTime,
      expireTime: activation.expireTime,
      daysUntilExpire: this.calculateDaysUntilExpire(activation.expireTime),
      consumedValue: activation.consumedValue.toString(),
      currency: activation.currency,
      avgUnitCost: activation.avgUnitCost.toString(),
      costRmb: activation.costRmb.toString(),
      paidAmount: activation.paidAmount.toString(),
      platformFee: activation.platformFee.toString(),
      refundLoss: activation.refundLoss.toString(),
      profitAmount: activation.profitAmount.toString(),
      sourcePlatformId: activation.sourcePlatformId,
      sourcePlatform: activation.sourcePlatform,
      externalOrderNo: activation.externalOrderNo,
      status: activation.status,
      autoRenewStatus: activation.autoRenewStatus,
      renewalDecision: activation.renewalDecision,
      renewalNote: activation.renewalNote,
      createdAt: activation.createdAt,
      updatedAt: activation.updatedAt
    };
  }
}
