import { BadRequestException, Injectable } from '@nestjs/common';
import type { CodeDeliveryStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface CodeProfitReportQuery {
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  platformId?: string;
  serviceId?: string;
  deliveryStatus?: string;
}

type CodeProfitOrder = Prisma.CodePlatformOrderGetPayload<{
  select: typeof codeProfitOrderSelect;
}>;

interface ProfitAccumulator {
  orderCount: number;
  codeCount: number;
  afterSaleCount: number;
  paidAmount: PrismaNamespace.Decimal;
  platformFee: PrismaNamespace.Decimal;
  costAmount: PrismaNamespace.Decimal;
  refundAmount: PrismaNamespace.Decimal;
  profitAmount: PrismaNamespace.Decimal;
  netProfitAmount: PrismaNamespace.Decimal;
}

interface ProfitGroupAccumulator extends ProfitAccumulator {
  key: string;
  label: string;
  meta?: Record<string, string | null>;
}

const codeProfitOrderSelect = {
  id: true,
  externalOrderNo: true,
  itemTitle: true,
  skuName: true,
  quantity: true,
  paidAmount: true,
  platformFee: true,
  costAmount: true,
  profitAmount: true,
  deliveryStatus: true,
  refundStatus: true,
  createdAt: true,
  deliveredAt: true,
  platform: {
    select: {
      id: true,
      name: true,
      code: true,
      type: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      faceValue: true,
      status: true
    }
  },
  deliveredCodes: {
    select: {
      id: true
    }
  },
  afterSales: {
    select: {
      id: true,
      status: true
    }
  },
  refundRecords: {
    where: {
      status: {
        not: 'rejected'
      }
    },
    select: {
      refundAmount: true,
      status: true
    }
  }
} satisfies Prisma.CodePlatformOrderSelect;

@Injectable()
export class CodeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfitReport(query: CodeProfitReportQuery) {
    const orders = await this.prisma.codePlatformOrder.findMany({
      where: this.buildOrderWhere(query),
      select: codeProfitOrderSelect,
      orderBy: { createdAt: 'desc' }
    });

    return this.buildProfitReport(orders);
  }

  buildProfitReport(orders: CodeProfitOrder[]) {
    const summary = this.createAccumulator();
    const dailyGroups = new Map<string, ProfitGroupAccumulator>();
    const serviceGroups = new Map<string, ProfitGroupAccumulator>();
    const platformGroups = new Map<string, ProfitGroupAccumulator>();

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
        order.service?.name ?? '未匹配业务',
        order,
        {
          faceValue: order.service?.faceValue.toString() ?? null,
          status: order.service?.status ?? null
        }
      );
      this.addOrderToGroup(platformGroups, order.platform.id, order.platform.name, order, {
        type: order.platform.type,
        code: order.platform.code
      });
    }

    return {
      summary: this.toSummaryResponse(summary),
      daily: Array.from(dailyGroups.values())
        .sort((left, right) => right.key.localeCompare(left.key))
        .map((group) => this.toGroupResponse(group)),
      byService: this.sortGroups(serviceGroups),
      byPlatform: this.sortGroups(platformGroups),
      recentOrders: orders.slice(0, 10).map((order) => {
        const refundAmount = this.getRefundAmount(order);
        return {
          id: order.id,
          externalOrderNo: order.externalOrderNo,
          deliveryStatus: order.deliveryStatus,
          refundStatus: order.refundStatus,
          itemTitle: order.itemTitle,
          skuName: order.skuName,
          serviceName: order.service?.name ?? null,
          platformName: order.platform.name,
          paidAmount: this.toMoney(order.paidAmount),
          platformFee: this.toMoney(order.platformFee),
          costAmount: this.toMoney(order.costAmount),
          refundAmount: this.toMoney(refundAmount),
          profitAmount: this.toMoney(order.profitAmount),
          netProfitAmount: this.toMoney(
            new PrismaNamespace.Decimal(order.profitAmount).minus(refundAmount)
          ),
          codeCount: order.deliveredCodes.length,
          afterSaleCount: order.afterSales.length,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt
        };
      })
    };
  }

  private buildOrderWhere(query: CodeProfitReportQuery): Prisma.CodePlatformOrderWhereInput {
    const keyword = query.keyword?.trim();
    const deliveryStatus = this.parseDeliveryStatus(query.deliveryStatus);

    return {
      createdAt: this.parseDateRange(query.dateFrom, query.dateTo),
      platformId: query.platformId || undefined,
      serviceId: query.serviceId || undefined,
      deliveryStatus: deliveryStatus ?? undefined,
      OR: keyword
        ? [
            { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
            { itemTitle: { contains: keyword, mode: 'insensitive' } },
            { skuName: { contains: keyword, mode: 'insensitive' } },
            { platform: { name: { contains: keyword, mode: 'insensitive' } } },
            { service: { name: { contains: keyword, mode: 'insensitive' } } }
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

  private parseDeliveryStatus(value?: string): CodeDeliveryStatus | undefined {
    if (!value) {
      return undefined;
    }

    if (value === 'pending' || value === 'delivered' || value === 'failed' || value === 'manual') {
      return value;
    }

    throw new BadRequestException('deliveryStatus is invalid');
  }

  private createAccumulator(): ProfitAccumulator {
    return {
      orderCount: 0,
      codeCount: 0,
      afterSaleCount: 0,
      paidAmount: new PrismaNamespace.Decimal(0),
      platformFee: new PrismaNamespace.Decimal(0),
      costAmount: new PrismaNamespace.Decimal(0),
      refundAmount: new PrismaNamespace.Decimal(0),
      profitAmount: new PrismaNamespace.Decimal(0),
      netProfitAmount: new PrismaNamespace.Decimal(0)
    };
  }

  private addOrder(accumulator: ProfitAccumulator, order: CodeProfitOrder) {
    const refundAmount = this.getRefundAmount(order);

    accumulator.orderCount += 1;
    accumulator.codeCount += order.deliveredCodes.length;
    accumulator.afterSaleCount += order.afterSales.length;
    accumulator.paidAmount = accumulator.paidAmount.plus(order.paidAmount);
    accumulator.platformFee = accumulator.platformFee.plus(order.platformFee);
    accumulator.costAmount = accumulator.costAmount.plus(order.costAmount);
    accumulator.refundAmount = accumulator.refundAmount.plus(refundAmount);
    accumulator.profitAmount = accumulator.profitAmount.plus(order.profitAmount);
    accumulator.netProfitAmount = accumulator.netProfitAmount.plus(
      new PrismaNamespace.Decimal(order.profitAmount).minus(refundAmount)
    );
  }

  private addOrderToGroup(
    groups: Map<string, ProfitGroupAccumulator>,
    key: string,
    label: string,
    order: CodeProfitOrder,
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
      .sort((left, right) => right.netProfitAmount.comparedTo(left.netProfitAmount))
      .map((group) => this.toGroupResponse(group));
  }

  private getRefundAmount(order: CodeProfitOrder) {
    return order.refundRecords.reduce(
      (sum, refund) => sum.plus(refund.refundAmount),
      new PrismaNamespace.Decimal(0)
    );
  }

  private toSummaryResponse(accumulator: ProfitAccumulator) {
    const grossMarginRate = accumulator.paidAmount.equals(0)
      ? new PrismaNamespace.Decimal(0)
      : accumulator.netProfitAmount.div(accumulator.paidAmount).mul(100).toDecimalPlaces(2);
    const averageOrderProfit =
      accumulator.orderCount === 0
        ? new PrismaNamespace.Decimal(0)
        : accumulator.netProfitAmount.div(accumulator.orderCount).toDecimalPlaces(2);

    return {
      orderCount: accumulator.orderCount,
      codeCount: accumulator.codeCount,
      afterSaleCount: accumulator.afterSaleCount,
      paidAmount: this.toMoney(accumulator.paidAmount),
      platformFee: this.toMoney(accumulator.platformFee),
      costAmount: this.toMoney(accumulator.costAmount),
      refundAmount: this.toMoney(accumulator.refundAmount),
      profitAmount: this.toMoney(accumulator.profitAmount),
      netProfitAmount: this.toMoney(accumulator.netProfitAmount),
      grossMarginRate: grossMarginRate.toFixed(2),
      averageOrderProfit: this.toMoney(averageOrderProfit)
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
}
