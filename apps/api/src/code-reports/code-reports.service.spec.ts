import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CodeReportsService } from './code-reports.service';

describe('CodeReportsService', () => {
  function createOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      externalOrderNo: 'CODE-ORDER-1',
      itemTitle: '100元兑换码',
      skuName: '100元',
      quantity: 1,
      paidAmount: new Prisma.Decimal('120'),
      platformFee: new Prisma.Decimal('2'),
      costAmount: new Prisma.Decimal('90'),
      profitAmount: new Prisma.Decimal('28'),
      deliveryStatus: 'delivered' as const,
      refundStatus: 'none' as const,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      deliveredAt: new Date('2026-06-18T00:10:00.000Z'),
      platform: {
        id: '22222222-2222-4222-8222-222222222222',
        name: '淘宝店',
        code: 'taobao-main',
        type: 'taobao' as const
      },
      service: {
        id: '33333333-3333-4333-8333-333333333333',
        name: '充值卡100',
        faceValue: new Prisma.Decimal('100'),
        status: 'enabled' as const
      },
      deliveredCodes: [{ id: '44444444-4444-4444-8444-444444444444' }],
      afterSales: [{ id: '55555555-5555-4555-8555-555555555555', status: 'completed' as const }],
      refundRecords: [
        {
          refundAmount: new Prisma.Decimal('10'),
          status: 'refunded' as const
        }
      ],
      ...overrides
    };
  }

  it('calculates code profit report with refund deducted from net profit', () => {
    const service = new CodeReportsService({} as PrismaService);

    const report = service.buildProfitReport([createOrder()]);

    expect(report.summary.orderCount).toBe(1);
    expect(report.summary.codeCount).toBe(1);
    expect(report.summary.afterSaleCount).toBe(1);
    expect(report.summary.paidAmount).toBe('120.00');
    expect(report.summary.platformFee).toBe('2.00');
    expect(report.summary.costAmount).toBe('90.00');
    expect(report.summary.refundAmount).toBe('10.00');
    expect(report.summary.profitAmount).toBe('28.00');
    expect(report.summary.netProfitAmount).toBe('18.00');
    expect(report.byPlatform[0]?.label).toBe('淘宝店');
    expect(report.recentOrders[0]?.netProfitAmount).toBe('18.00');
  });
});
