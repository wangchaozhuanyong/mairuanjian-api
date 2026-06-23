import { BadRequestException, Injectable } from '@nestjs/common';
import type { AppleOrderStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface ProfitReportQuery {
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  status?: string;
  customerId?: string;
  sourcePlatformId?: string;
  serviceId?: string;
  appleAccountId?: string;
}

interface ProfitReportOrder {
  id: string;
  orderNo: string;
  status: AppleOrderStatus;
  paidAmount: PrismaNamespace.Decimal.Value;
  paidAmountRmb: PrismaNamespace.Decimal.Value;
  platformFee: PrismaNamespace.Decimal.Value;
  platformFeeRmb: PrismaNamespace.Decimal.Value;
  refundLoss: PrismaNamespace.Decimal.Value;
  refundLossRmb: PrismaNamespace.Decimal.Value;
  appleCostRmb: PrismaNamespace.Decimal.Value;
  profitAmount: PrismaNamespace.Decimal.Value;
  createdAt: Date;
  service?: {
    id: string;
    name: string;
    category: string;
  } | null;
  sourcePlatform?: {
    id: string;
    name: string;
  } | null;
  appleAccount?: {
    id: string;
    appleId: string;
    region: string;
    currency: string;
  } | null;
}

interface ProfitAccumulator {
  orderCount: number;
  paidAmount: PrismaNamespace.Decimal;
  platformFee: PrismaNamespace.Decimal;
  refundLoss: PrismaNamespace.Decimal;
  appleCostRmb: PrismaNamespace.Decimal;
  profitAmount: PrismaNamespace.Decimal;
}

interface ProfitGroupAccumulator extends ProfitAccumulator {
  key: string;
  label: string;
  meta?: Record<string, string | null>;
}

const profitOrderSelect = {
  id: true,
  orderNo: true,
  status: true,
  paidAmount: true,
  paidAmountRmb: true,
  platformFee: true,
  platformFeeRmb: true,
  refundLoss: true,
  refundLossRmb: true,
  appleCostRmb: true,
  profitAmount: true,
  createdAt: true,
  service: {
    select: {
      id: true,
      name: true,
      category: true
    }
  },
  sourcePlatform: {
    select: {
      id: true,
      name: true
    }
  },
  appleAccount: {
    select: {
      id: true,
      appleId: true,
      region: true,
      currency: true
    }
  }
} satisfies Prisma.AppleOrderSelect;

@Injectable()
export class AppleReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfitReport(query: ProfitReportQuery) {
    const where = this.buildOrderWhere(query);
    const orders = await this.prisma.appleOrder.findMany({
      where,
      select: profitOrderSelect,
      orderBy: { createdAt: 'desc' }
    });

    return this.buildProfitReport(orders);
  }

  buildProfitReport(orders: ProfitReportOrder[]) {
    const summary = this.createAccumulator();
    const dailyGroups = new Map<string, ProfitGroupAccumulator>();
    const serviceGroups = new Map<string, ProfitGroupAccumulator>();
    const sourcePlatformGroups = new Map<string, ProfitGroupAccumulator>();
    const accountGroups = new Map<string, ProfitGroupAccumulator>();

    for (const order of orders) {
      this.addOrder(summary, order);
      this.addOrderToGroup(
        dailyGroups,
        this.getDateKey(order.createdAt),
        this.getDateKey(order.createdAt),
        order
      );
      this.addOrderToGroup(
        serviceGroups,
        order.service?.id ?? 'unassigned',
        order.service?.name ?? '未绑定业务',
        order,
        {
          category: order.service?.category ?? null
        }
      );
      this.addOrderToGroup(
        sourcePlatformGroups,
        order.sourcePlatform?.id ?? 'manual',
        order.sourcePlatform?.name ?? '手工/未绑定平台',
        order
      );
      this.addOrderToGroup(
        accountGroups,
        order.appleAccount?.id ?? 'unassigned',
        order.appleAccount ? this.maskAppleId(order.appleAccount.appleId) : '未绑定 Apple ID',
        order,
        {
          region: order.appleAccount?.region ?? null,
          currency: order.appleAccount?.currency ?? null
        }
      );
    }

    return {
      summary: this.toSummaryResponse(summary),
      daily: Array.from(dailyGroups.values())
        .sort((left, right) => right.key.localeCompare(left.key))
        .map((group) => this.toGroupResponse(group)),
      byService: this.sortGroups(serviceGroups),
      bySourcePlatform: this.sortGroups(sourcePlatformGroups),
      byAppleAccount: this.sortGroups(accountGroups),
      recentOrders: orders.slice(0, 10).map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        paidAmount: this.toMoney(order.paidAmountRmb),
        platformFee: this.toMoney(order.platformFeeRmb),
        refundLoss: this.toMoney(order.refundLossRmb),
        appleCostRmb: this.toMoney4(order.appleCostRmb),
        profitAmount: this.toMoney4(order.profitAmount),
        serviceName: order.service?.name ?? null,
        sourcePlatformName: order.sourcePlatform?.name ?? null,
        appleAccountMasked: order.appleAccount
          ? this.maskAppleId(order.appleAccount.appleId)
          : null,
        createdAt: order.createdAt
      }))
    };
  }

  private buildOrderWhere(query: ProfitReportQuery): Prisma.AppleOrderWhereInput {
    const status = this.parseOrderStatus(query.status);
    const keyword = query.keyword?.trim();
    const createdAt = this.parseDateRange(query.dateFrom, query.dateTo);

    return {
      deletedAt: null,
      createdAt,
      status: status ?? { not: 'cancelled' },
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
  }

  private parseDateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    const filter: Prisma.DateTimeFilter = {};

    if (dateFrom) {
      const parsed = new Date(`${dateFrom}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('dateFrom is invalid');
      }
      filter.gte = parsed;
    }

    if (dateTo) {
      const parsed = new Date(`${dateTo}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('dateTo is invalid');
      }
      filter.lte = parsed;
    }

    return Object.keys(filter).length ? filter : undefined;
  }

  private parseOrderStatus(value?: string): AppleOrderStatus | undefined {
    if (!value) {
      return undefined;
    }

    if (
      value === 'pending' ||
      value === 'active' ||
      value === 'completed' ||
      value === 'cancelled' ||
      value === 'abnormal'
    ) {
      return value;
    }

    throw new BadRequestException('status is invalid');
  }

  private createAccumulator(): ProfitAccumulator {
    return {
      orderCount: 0,
      paidAmount: new PrismaNamespace.Decimal(0),
      platformFee: new PrismaNamespace.Decimal(0),
      refundLoss: new PrismaNamespace.Decimal(0),
      appleCostRmb: new PrismaNamespace.Decimal(0),
      profitAmount: new PrismaNamespace.Decimal(0)
    };
  }

  private addOrder(accumulator: ProfitAccumulator, order: ProfitReportOrder) {
    accumulator.orderCount += 1;
    accumulator.paidAmount = accumulator.paidAmount.plus(order.paidAmountRmb);
    accumulator.platformFee = accumulator.platformFee.plus(order.platformFeeRmb);
    accumulator.refundLoss = accumulator.refundLoss.plus(order.refundLossRmb);
    accumulator.appleCostRmb = accumulator.appleCostRmb.plus(order.appleCostRmb);
    accumulator.profitAmount = accumulator.profitAmount.plus(order.profitAmount);
  }

  private addOrderToGroup(
    groups: Map<string, ProfitGroupAccumulator>,
    key: string,
    label: string,
    order: ProfitReportOrder,
    meta?: Record<string, string | null>
  ) {
    let group = groups.get(key);

    if (!group) {
      group = {
        ...this.createAccumulator(),
        key,
        label,
        meta
      };
      groups.set(key, group);
    }

    this.addOrder(group, order);
  }

  private sortGroups(groups: Map<string, ProfitGroupAccumulator>) {
    return Array.from(groups.values())
      .sort((left, right) => right.profitAmount.comparedTo(left.profitAmount))
      .map((group) => this.toGroupResponse(group));
  }

  private toSummaryResponse(accumulator: ProfitAccumulator) {
    const grossMarginRate = accumulator.paidAmount.equals(0)
      ? new PrismaNamespace.Decimal(0)
      : accumulator.profitAmount.div(accumulator.paidAmount).mul(100).toDecimalPlaces(2);
    const averageOrderProfit =
      accumulator.orderCount === 0
        ? new PrismaNamespace.Decimal(0)
        : accumulator.profitAmount.div(accumulator.orderCount).toDecimalPlaces(4);

    return {
      orderCount: accumulator.orderCount,
      paidAmount: this.toMoney(accumulator.paidAmount),
      platformFee: this.toMoney(accumulator.platformFee),
      refundLoss: this.toMoney(accumulator.refundLoss),
      appleCostRmb: this.toMoney4(accumulator.appleCostRmb),
      profitAmount: this.toMoney4(accumulator.profitAmount),
      grossMarginRate: grossMarginRate.toFixed(2),
      averageOrderProfit: this.toMoney4(averageOrderProfit)
    };
  }

  private toGroupResponse(group: ProfitGroupAccumulator) {
    return {
      key: group.key,
      label: group.label,
      meta: group.meta,
      ...this.toSummaryResponse(group)
    };
  }

  private getDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toMoney(value: PrismaNamespace.Decimal.Value) {
    return new PrismaNamespace.Decimal(value).toDecimalPlaces(2).toFixed(2);
  }

  private toMoney4(value: PrismaNamespace.Decimal.Value) {
    return new PrismaNamespace.Decimal(value).toDecimalPlaces(4).toFixed(4);
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return this.maskPlainText(value);
    }

    return `${this.maskPlainText(name)}@${domain}`;
  }

  private maskPlainText(value: string) {
    if (value.length <= 2) {
      return '*'.repeat(value.length);
    }

    return `${value.slice(0, 2)}${'*'.repeat(Math.max(value.length - 2, 4))}`;
  }
}
