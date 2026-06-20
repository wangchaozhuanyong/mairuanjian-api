import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppleAccount,
  AppleAccountLock,
  AppleOrderStatus,
  AppleService,
  Prisma,
  SourcePlatform
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAppleOrderDto } from './dto/create-apple-order.dto';

interface ListAppleOrdersQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  customerId?: string;
  sourcePlatformId?: string;
  serviceId?: string;
  appleAccountId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface AvailableAccountsQuery {
  serviceId?: string;
  amountRequired?: string;
  currency?: string;
  keyword?: string;
  showUnavailable?: string;
}

interface MatchEvaluation {
  availability: 'available' | 'unavailable' | 'need_confirm';
  reason: string | null;
}

interface OrderFinancialInput {
  paidAmount: PrismaNamespace.Decimal.Value;
  platformFee: PrismaNamespace.Decimal.Value;
  refundLoss: PrismaNamespace.Decimal.Value;
  appleCostValue: PrismaNamespace.Decimal.Value;
  averageCost: PrismaNamespace.Decimal.Value;
}

interface OrderFinancialSnapshot {
  appleCostRmb: PrismaNamespace.Decimal;
  profitAmount: PrismaNamespace.Decimal;
}

type MatchableAccount = Pick<
  AppleAccount,
  | 'id'
  | 'appleId'
  | 'region'
  | 'currency'
  | 'currentBalance'
  | 'balanceCostAmount'
  | 'averageCost'
  | 'status'
  | 'isManuallyLocked'
  | 'manualLockReason'
  | 'deletedAt'
> & {
  locks: Array<Pick<AppleAccountLock, 'lockScope' | 'serviceId' | 'status'>>;
};

const orderInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      wechat: true
    }
  },
  sourcePlatform: {
    select: {
      id: true,
      name: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      category: true,
      currency: true,
      officialCostValue: true
    }
  },
  appleAccount: true,
  activation: true
} satisfies Prisma.AppleOrderInclude;

const APPLE_ORDER_SORT_FIELDS: Record<string, keyof Prisma.AppleOrderOrderByWithRelationInput> = {
  orderNo: 'orderNo',
  paidAmount: 'paidAmount',
  appleCostValue: 'appleCostValue',
  appleCostRmb: 'appleCostRmb',
  profitAmount: 'profitAmount',
  expireTime: 'expireTime',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

@Injectable()
export class AppleOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListAppleOrdersQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseOrderStatus(query.status, false);
    const where: Prisma.AppleOrderWhereInput = {
      status: status ?? undefined,
      customerId: query.customerId || undefined,
      sourcePlatformId: query.sourcePlatformId || undefined,
      serviceId: query.serviceId || undefined,
      appleAccountId: query.appleAccountId || undefined,
      OR: keyword
        ? [
            { orderNo: { contains: keyword, mode: 'insensitive' } },
            { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
            { serviceAccount: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } },
            { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { service: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
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
      this.prisma.appleOrder.findMany({
        where,
        include: orderInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.appleOrder.count({ where })
    ]);

    return {
      items: items.map((order) => this.toOrderResponse(order)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const order = await this.prisma.appleOrder.findUnique({
      where: { id },
      include: orderInclude
    });

    if (!order) {
      throw new NotFoundException('Apple order not found');
    }

    return this.toOrderResponse(order);
  }

  async listAvailableAccounts(query: AvailableAccountsQuery) {
    const service = await this.resolveService(query.serviceId);
    const amountRequired = this.resolveAmountRequired(query.amountRequired, service);
    const currency = (query.currency || service.currency).trim().toUpperCase();
    const showUnavailable = this.parseBoolean(query.showUnavailable, true);
    const keyword = query.keyword?.trim().toLowerCase();

    const accounts = await this.prisma.appleAccount.findMany({
      where: {
        deletedAt: null,
        OR: keyword
          ? [
              { appleIdNormalized: { contains: keyword, mode: 'insensitive' } },
              { region: { contains: keyword, mode: 'insensitive' } },
              { currency: { contains: keyword, mode: 'insensitive' } },
              { remark: { contains: keyword, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: {
        locks: {
          where: {
            status: 'active'
          }
        }
      },
      orderBy: [{ currentBalance: 'desc' }, { createdAt: 'asc' }],
      take: 100
    });

    const items = accounts
      .map((account) => {
        const evaluation = this.evaluateAccountAvailability(account, service, {
          amountRequired,
          currency
        });

        return this.toAvailableAccountResponse(account, evaluation);
      })
      .filter((item) => showUnavailable || item.availability === 'available');

    return { items };
  }

  async create(dto: CreateAppleOrderDto, operator?: AuthenticatedUser) {
    const customerId = this.normalizeRequiredId(dto.customerId, 'customerId');
    const serviceId = this.normalizeRequiredId(dto.serviceId, 'serviceId');
    const sourcePlatformId = this.normalizeNullableString(dto.sourcePlatformId);
    const externalOrderNo = this.normalizeNullableString(dto.externalOrderNo);

    if (sourcePlatformId && externalOrderNo) {
      await this.assertExternalOrderNoAvailable(sourcePlatformId, externalOrderNo);
    }

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, deletedAt: null, status: 'active' }
      });

      if (!customer) {
        throw new BadRequestException('Customer does not exist or is disabled');
      }

      const service = await tx.appleService.findFirst({
        where: { id: serviceId, deletedAt: null, status: 'enabled' }
      });

      if (!service) {
        throw new BadRequestException('Apple service does not exist or is not enabled');
      }

      const sourcePlatform = sourcePlatformId
        ? await tx.sourcePlatform.findFirst({
            where: { id: sourcePlatformId, deletedAt: null, status: 'active' }
          })
        : null;

      if (sourcePlatformId && !sourcePlatform) {
        throw new BadRequestException('Source platform does not exist or is disabled');
      }

      const serviceAccount = this.normalizeNullableString(dto.serviceAccount);
      if (service.requireServiceAccount && !serviceAccount) {
        throw new BadRequestException('serviceAccount is required');
      }

      const paidAmount = this.normalizeDecimal(dto.paidAmount, 'paidAmount', service.defaultPrice);
      const refundLoss = this.normalizeDecimal(dto.refundLoss, 'refundLoss', '0');
      const appleCostValue = this.normalizeDecimal(
        dto.appleCostValue,
        'appleCostValue',
        service.officialCostValue
      );
      const platformFee =
        dto.platformFee === undefined
          ? this.calculatePlatformFee(paidAmount, sourcePlatform)
          : this.normalizeDecimal(dto.platformFee, 'platformFee', '0');
      const startTime = this.parseDate(dto.startTime, 'startTime') ?? new Date();
      const expireTime =
        this.parseDate(dto.expireTime, 'expireTime') ??
        this.calculateExpireTime(service, startTime);

      let appleAccount: MatchableAccount | null = null;

      if (service.requireAppleId) {
        appleAccount = await this.resolveAppleAccountForOrder(
          tx,
          dto.appleAccountId,
          service,
          appleCostValue
        );
      }

      const averageCost = appleAccount?.averageCost ?? new PrismaNamespace.Decimal(0);
      const financials = this.calculateOrderFinancials({
        paidAmount,
        platformFee,
        refundLoss,
        appleCostValue,
        averageCost
      });
      const orderNo = this.generateOrderNo();

      const order = await tx.appleOrder.create({
        data: {
          orderNo,
          customerId,
          sourcePlatformId: sourcePlatform?.id,
          externalOrderNo,
          serviceId,
          appleAccountId: appleAccount?.id,
          serviceAccount,
          currentPlan: this.normalizeNullableString(dto.currentPlan),
          targetPlan: this.normalizeNullableString(dto.targetPlan),
          startTime,
          expireTime,
          paidAmount,
          platformFee,
          refundLoss,
          appleCostValue,
          appleCostRmb: financials.appleCostRmb,
          profitAmount: financials.profitAmount,
          status: 'active',
          remark: this.normalizeNullableString(dto.remark),
          createdByUserId: operator?.id,
          updatedByUserId: operator?.id
        }
      });

      if (appleAccount && appleCostValue.greaterThan(0)) {
        const balanceSnapshot = this.calculateConsumptionSnapshot(appleAccount, appleCostValue);
        await tx.appleBalanceConsumption.create({
          data: {
            appleAccountId: appleAccount.id,
            amount: appleCostValue,
            costAmount: balanceSnapshot.costAmount,
            avgUnitCost: balanceSnapshot.avgUnitCost,
            balanceBefore: balanceSnapshot.balanceBefore,
            balanceAfter: balanceSnapshot.balanceAfter,
            costBefore: balanceSnapshot.costBefore,
            costAfter: balanceSnapshot.costAfter,
            reason: 'apple_order',
            relatedObjectType: 'apple_order',
            relatedObjectId: order.id,
            remark: `Apple order ${order.orderNo}`,
            createdByUserId: operator?.id
          }
        });

        await this.updateAccountBalanceSnapshot(tx, appleAccount, {
          currentBalance: balanceSnapshot.balanceAfter,
          balanceCostAmount: balanceSnapshot.costAfter,
          averageCost: balanceSnapshot.avgCostAfter,
          operatorId: operator?.id
        });
      }

      await tx.serviceActivation.create({
        data: {
          orderId: order.id,
          customerId,
          appleAccountId: appleAccount?.id,
          serviceId,
          currentPlan: this.normalizeNullableString(dto.currentPlan),
          targetPlan: this.normalizeNullableString(dto.targetPlan),
          startTime,
          expireTime,
          consumedValue: appleCostValue,
          currency: service.currency,
          avgUnitCost: appleAccount?.averageCost ?? new PrismaNamespace.Decimal(0),
          costRmb: financials.appleCostRmb,
          paidAmount,
          platformFee,
          refundLoss,
          profitAmount: financials.profitAmount,
          sourcePlatformId: sourcePlatform?.id,
          externalOrderNo,
          status: 'active'
        }
      });

      if (appleAccount && service.requireAppleId) {
        await tx.appleAccountLock.create({
          data: {
            appleAccountId: appleAccount.id,
            serviceId: service.id,
            orderId: order.id,
            lockScope: service.lockRule,
            status: 'active',
            reason: `Order ${order.orderNo}`,
            createdByUserId: operator?.id
          }
        });
      }

      return order;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_order',
      action: 'apple_order.create',
      objectType: 'apple_order',
      objectId: createdOrder.id,
      afterData: this.toAuditJson({
        orderNo: createdOrder.orderNo,
        customerId: createdOrder.customerId,
        serviceId: createdOrder.serviceId,
        appleAccountId: createdOrder.appleAccountId,
        paidAmount: createdOrder.paidAmount.toString(),
        appleCostValue: createdOrder.appleCostValue.toString(),
        appleCostRmb: createdOrder.appleCostRmb.toString(),
        profitAmount: createdOrder.profitAmount.toString()
      }),
      remark: `Created Apple order ${createdOrder.orderNo}`
    });

    return this.get(createdOrder.id);
  }

  calculateOrderFinancials(input: OrderFinancialInput): OrderFinancialSnapshot {
    const paidAmount = new PrismaNamespace.Decimal(input.paidAmount);
    const platformFee = new PrismaNamespace.Decimal(input.platformFee);
    const refundLoss = new PrismaNamespace.Decimal(input.refundLoss);
    const appleCostValue = new PrismaNamespace.Decimal(input.appleCostValue);
    const averageCost = new PrismaNamespace.Decimal(input.averageCost);

    if (
      paidAmount.lessThan(0) ||
      platformFee.lessThan(0) ||
      refundLoss.lessThan(0) ||
      appleCostValue.lessThan(0) ||
      averageCost.lessThan(0)
    ) {
      throw new BadRequestException('Order amount fields must be non-negative');
    }

    const appleCostRmb = appleCostValue.mul(averageCost).toDecimalPlaces(4);
    const profitAmount = paidAmount
      .minus(platformFee)
      .minus(refundLoss)
      .minus(appleCostRmb)
      .toDecimalPlaces(4);

    return {
      appleCostRmb,
      profitAmount
    };
  }

  evaluateAccountAvailability(
    account: MatchableAccount,
    service: Pick<AppleService, 'id' | 'currency' | 'allowedRegions' | 'lockRule'>,
    options: { amountRequired: PrismaNamespace.Decimal; currency: string }
  ): MatchEvaluation {
    if (account.deletedAt) {
      return { availability: 'unavailable', reason: '账号已删除' };
    }

    if (account.status === 'need_verify') {
      return { availability: 'need_confirm', reason: '账号需要人工验证' };
    }

    if (account.status !== 'normal') {
      return { availability: 'unavailable', reason: `账号状态不可用：${account.status}` };
    }

    if (account.isManuallyLocked) {
      return {
        availability: 'unavailable',
        reason: account.manualLockReason
          ? `账号已手动锁定：${account.manualLockReason}`
          : '账号已手动锁定'
      };
    }

    if (account.currency !== options.currency) {
      return {
        availability: 'unavailable',
        reason: `币种不匹配，需要${options.currency}，当前${account.currency}`
      };
    }

    if (service.allowedRegions.length && !service.allowedRegions.includes(account.region)) {
      return { availability: 'unavailable', reason: '地区不匹配' };
    }

    if (new PrismaNamespace.Decimal(account.currentBalance).lessThan(options.amountRequired)) {
      return {
        availability: 'unavailable',
        reason: `余额不足，需要${options.amountRequired.toString()} ${options.currency}，当前${account.currentBalance.toString()} ${account.currency}`
      };
    }

    const hasGlobalLock = account.locks.some((lock) => lock.lockScope === 'global');
    if (hasGlobalLock) {
      return { availability: 'unavailable', reason: '账号存在全局锁定记录' };
    }

    if (
      service.lockRule === 'by_service' &&
      account.locks.some((lock) => lock.serviceId === service.id)
    ) {
      return { availability: 'unavailable', reason: '该业务已占用此 Apple ID' };
    }

    if (service.lockRule === 'global' && account.locks.length > 0) {
      return { availability: 'unavailable', reason: '全局锁定规则要求账号未被占用' };
    }

    return { availability: 'available', reason: null };
  }

  private async resolveAppleAccountForOrder(
    tx: Prisma.TransactionClient,
    appleAccountId: string | null | undefined,
    service: AppleService,
    appleCostValue: PrismaNamespace.Decimal
  ) {
    const account = appleAccountId
      ? await tx.appleAccount.findFirst({
          where: { id: appleAccountId, deletedAt: null },
          include: { locks: { where: { status: 'active' } } }
        })
      : await this.findFirstAvailableAccount(tx, service, appleCostValue);

    if (!account) {
      throw new BadRequestException('No available Apple ID found');
    }

    const evaluation = this.evaluateAccountAvailability(account, service, {
      amountRequired: appleCostValue,
      currency: service.currency
    });

    if (evaluation.availability !== 'available') {
      throw new BadRequestException(evaluation.reason ?? 'Apple ID is not available');
    }

    return account;
  }

  private async findFirstAvailableAccount(
    tx: Prisma.TransactionClient,
    service: AppleService,
    amountRequired: PrismaNamespace.Decimal
  ) {
    const accounts = await tx.appleAccount.findMany({
      where: {
        deletedAt: null,
        currency: service.currency
      },
      include: {
        locks: {
          where: { status: 'active' }
        }
      },
      orderBy: [{ currentBalance: 'desc' }, { createdAt: 'asc' }],
      take: 50
    });

    return (
      accounts.find((account) => {
        const evaluation = this.evaluateAccountAvailability(account, service, {
          amountRequired,
          currency: service.currency
        });
        return evaluation.availability === 'available';
      }) ?? null
    );
  }

  private async resolveService(serviceId?: string) {
    const normalizedServiceId = this.normalizeRequiredId(serviceId, 'serviceId');
    const service = await this.prisma.appleService.findFirst({
      where: {
        id: normalizedServiceId,
        deletedAt: null,
        status: 'enabled'
      }
    });

    if (!service) {
      throw new BadRequestException('Apple service does not exist or is not enabled');
    }

    return service;
  }

  private resolveAmountRequired(amountRequired: string | undefined, service: AppleService) {
    const amount = this.normalizeDecimal(
      amountRequired,
      'amountRequired',
      service.officialCostValue
    );
    const minBalance = new PrismaNamespace.Decimal(service.minBalanceRequired);
    return amount.greaterThan(minBalance) ? amount : minBalance;
  }

  private calculateConsumptionSnapshot(
    account: Pick<AppleAccount, 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    amountInput: PrismaNamespace.Decimal.Value
  ) {
    const amount = new PrismaNamespace.Decimal(amountInput);
    const balanceBefore = new PrismaNamespace.Decimal(account.currentBalance);
    const costBefore = new PrismaNamespace.Decimal(account.balanceCostAmount);
    const avgUnitCost = new PrismaNamespace.Decimal(account.averageCost);

    if (amount.lessThan(0)) {
      throw new BadRequestException('amount must be non-negative');
    }

    if (amount.greaterThan(balanceBefore)) {
      throw new BadRequestException('Insufficient Apple ID balance');
    }

    const costAmount = amount.mul(avgUnitCost).toDecimalPlaces(4);
    const balanceAfter = balanceBefore.minus(amount).toDecimalPlaces(4);
    const costAfter = balanceAfter.equals(0)
      ? new PrismaNamespace.Decimal(0)
      : costBefore.minus(costAmount).toDecimalPlaces(4);

    if (costAfter.lessThan(0)) {
      throw new BadRequestException('Apple ID balance cost would become negative');
    }

    return {
      balanceBefore,
      balanceAfter,
      costBefore,
      costAfter,
      avgUnitCost,
      costAmount,
      avgCostAfter: balanceAfter.equals(0)
        ? new PrismaNamespace.Decimal(0)
        : costAfter.div(balanceAfter).toDecimalPlaces(8)
    };
  }

  private async updateAccountBalanceSnapshot(
    tx: Prisma.TransactionClient,
    account: Pick<AppleAccount, 'id' | 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    snapshot: {
      currentBalance: PrismaNamespace.Decimal;
      balanceCostAmount: PrismaNamespace.Decimal;
      averageCost: PrismaNamespace.Decimal;
      operatorId?: string;
    }
  ) {
    const result = await tx.appleAccount.updateMany({
      where: {
        id: account.id,
        deletedAt: null,
        currentBalance: account.currentBalance,
        balanceCostAmount: account.balanceCostAmount,
        averageCost: account.averageCost
      },
      data: {
        currentBalance: snapshot.currentBalance,
        balanceCostAmount: snapshot.balanceCostAmount,
        averageCost: snapshot.averageCost,
        updatedByUserId: snapshot.operatorId
      }
    });

    if (result.count !== 1) {
      throw new ConflictException('Apple ID balance changed while creating order, please retry');
    }
  }

  private calculatePlatformFee(
    paidAmount: PrismaNamespace.Decimal,
    sourcePlatform: SourcePlatform | null
  ) {
    if (!sourcePlatform) {
      return new PrismaNamespace.Decimal(0);
    }

    return paidAmount
      .mul(new PrismaNamespace.Decimal(sourcePlatform.feeRate))
      .plus(new PrismaNamespace.Decimal(sourcePlatform.feeFixed))
      .toDecimalPlaces(2);
  }

  private calculateExpireTime(service: AppleService, startTime: Date) {
    if (service.expireCalcType === 'manual' || service.defaultPeriodType === 'manual') {
      return null;
    }

    const expireTime = new Date(startTime);
    if (service.expireCalcType === 'by_day' || service.defaultPeriodType === 'day') {
      expireTime.setDate(expireTime.getDate() + service.defaultPeriodValue);
      return expireTime;
    }

    expireTime.setMonth(expireTime.getMonth() + service.defaultPeriodValue);
    return expireTime;
  }

  private async assertExternalOrderNoAvailable(sourcePlatformId: string, externalOrderNo: string) {
    const existingOrder = await this.prisma.appleOrder.findUnique({
      where: {
        sourcePlatformId_externalOrderNo: {
          sourcePlatformId,
          externalOrderNo
        }
      },
      select: { id: true }
    });

    if (existingOrder) {
      throw new ConflictException('External order number already exists');
    }
  }

  private parseOrderStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'pending' ||
      value === 'active' ||
      value === 'completed' ||
      value === 'cancelled' ||
      value === 'abnormal'
    ) {
      return value satisfies AppleOrderStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid Apple order status');
    }

    return undefined;
  }

  private buildOrderBy(query: ListAppleOrdersQuery): Prisma.AppleOrderOrderByWithRelationInput[] {
    const sortField = query.sortBy ? APPLE_ORDER_SORT_FIELDS[query.sortBy] : undefined;
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

  private parseBoolean(value: unknown, fallback: boolean) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    throw new BadRequestException('Invalid boolean parameter');
  }

  private normalizeRequiredId(value: string | null | undefined, field: string) {
    const normalized = this.normalizeNullableString(value);

    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
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

  private normalizeDecimal(
    value: string | number | PrismaNamespace.Decimal | undefined,
    field: string,
    fallback: PrismaNamespace.Decimal.Value
  ) {
    const normalized =
      value === undefined || value === '' ? String(fallback) : String(value).trim();

    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return new PrismaNamespace.Decimal(normalized);
  }

  private parseDate(value: string | null | undefined, field: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private generateOrderNo() {
    const date = new Date();
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate()
    ).padStart(2, '0')}`;
    return `AO${day}${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return value.length <= 4 ? '****' : `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    const prefix = name.length <= 2 ? `${name[0] ?? '*'}***` : `${name.slice(0, 2)}***`;
    return `${prefix}@${domain}`;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toAvailableAccountResponse(account: MatchableAccount, evaluation: MatchEvaluation) {
    return {
      appleAccountId: account.id,
      accountMasked: this.maskAppleId(account.appleId),
      region: account.region,
      currency: account.currency,
      balance: account.currentBalance.toString(),
      balanceCostAmount: account.balanceCostAmount.toString(),
      avgUnitCost: account.averageCost.toString(),
      status: account.status,
      isManuallyLocked: account.isManuallyLocked,
      availability: evaluation.availability,
      reason: evaluation.reason
    };
  }

  private toOrderResponse(order: Prisma.AppleOrderGetPayload<{ include: typeof orderInclude }>) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      customer: order.customer,
      sourcePlatformId: order.sourcePlatformId,
      sourcePlatform: order.sourcePlatform,
      externalOrderNo: order.externalOrderNo,
      serviceId: order.serviceId,
      service: {
        ...order.service,
        officialCostValue: order.service.officialCostValue.toString()
      },
      appleAccountId: order.appleAccountId,
      appleAccount: order.appleAccount
        ? {
            id: order.appleAccount.id,
            appleIdMasked: this.maskAppleId(order.appleAccount.appleId),
            region: order.appleAccount.region,
            currency: order.appleAccount.currency,
            currentBalance: order.appleAccount.currentBalance.toString(),
            averageCost: order.appleAccount.averageCost.toString()
          }
        : null,
      serviceAccount: order.serviceAccount,
      currentPlan: order.currentPlan,
      targetPlan: order.targetPlan,
      startTime: order.startTime,
      expireTime: order.expireTime,
      paidAmount: order.paidAmount.toString(),
      platformFee: order.platformFee.toString(),
      refundLoss: order.refundLoss.toString(),
      appleCostValue: order.appleCostValue.toString(),
      appleCostRmb: order.appleCostRmb.toString(),
      profitAmount: order.profitAmount.toString(),
      status: order.status,
      remark: order.remark,
      activationId: order.activation?.id ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }
}
