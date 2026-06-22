import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleReportsService } from './apple-reports.service';

describe('AppleReportsService', () => {
  const service = new AppleReportsService({} as PrismaService);

  it('summarizes Apple ID profit report by day, service, platform and account', () => {
    const report = service.buildProfitReport([
      {
        id: 'order-1',
        orderNo: 'A001',
        status: 'active',
        paidAmount: new Prisma.Decimal('100'),
        paidAmountRmb: new Prisma.Decimal('100'),
        platformFee: new Prisma.Decimal('5'),
        platformFeeRmb: new Prisma.Decimal('5'),
        refundLoss: new Prisma.Decimal('0'),
        refundLossRmb: new Prisma.Decimal('0'),
        appleCostRmb: new Prisma.Decimal('60'),
        profitAmount: new Prisma.Decimal('35'),
        createdAt: new Date('2026-06-18T01:00:00.000Z'),
        service: { id: 'service-gpt', name: 'GPT Plus', category: 'ai' },
        sourcePlatform: { id: 'taobao', name: '淘宝店' },
        appleAccount: {
          id: 'apple-1',
          appleId: 'profit-test@icloud.com',
          region: 'US',
          currency: 'USD'
        }
      },
      {
        id: 'order-2',
        orderNo: 'A002',
        status: 'completed',
        paidAmount: new Prisma.Decimal('50'),
        paidAmountRmb: new Prisma.Decimal('50'),
        platformFee: new Prisma.Decimal('2'),
        platformFeeRmb: new Prisma.Decimal('2'),
        refundLoss: new Prisma.Decimal('3'),
        refundLossRmb: new Prisma.Decimal('3'),
        appleCostRmb: new Prisma.Decimal('20'),
        profitAmount: new Prisma.Decimal('25'),
        createdAt: new Date('2026-06-18T03:00:00.000Z'),
        service: { id: 'service-gpt', name: 'GPT Plus', category: 'ai' },
        sourcePlatform: { id: 'manual', name: '手工' },
        appleAccount: {
          id: 'apple-1',
          appleId: 'profit-test@icloud.com',
          region: 'US',
          currency: 'USD'
        }
      }
    ]);

    expect(report.summary).toEqual(
      expect.objectContaining({
        orderCount: 2,
        paidAmount: '150.00',
        platformFee: '7.00',
        refundLoss: '3.00',
        appleCostRmb: '80.0000',
        profitAmount: '60.0000',
        grossMarginRate: '40.00',
        averageOrderProfit: '30.0000'
      })
    );
    expect(report.daily).toHaveLength(1);
    expect(report.byService[0]).toEqual(expect.objectContaining({ label: 'GPT Plus' }));
    expect(report.bySourcePlatform).toHaveLength(2);
    expect(report.byAppleAccount[0]).toEqual(
      expect.objectContaining({
        key: 'apple-1',
        label: 'pr*********@icloud.com',
        orderCount: 2
      })
    );
  });
});
