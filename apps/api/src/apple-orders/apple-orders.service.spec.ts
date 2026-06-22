import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleOrdersService } from './apple-orders.service';

describe('AppleOrdersService', () => {
  const service = new AppleOrdersService({} as PrismaService, {} as AuditLogsService);

  const baseService = {
    id: 'service-id',
    currency: 'USD',
    allowedRegions: ['US'],
    lockRule: 'by_service' as const
  };

  const baseAccount = {
    id: 'account-id',
    appleId: 'demo@example.com',
    region: 'US',
    currency: 'USD',
    currentBalance: new Prisma.Decimal('50'),
    balanceCostAmount: new Prisma.Decimal('280'),
    averageCost: new Prisma.Decimal('5.6'),
    status: 'normal' as const,
    isManuallyLocked: false,
    manualLockReason: null,
    deletedAt: null,
    locks: []
  };

  it('calculates Apple order cost and profit', () => {
    const snapshot = service.calculateOrderFinancials({
      paidAmountRmb: '188',
      platformFeeRmb: '3',
      refundLossRmb: '0',
      appleCostValue: '20',
      averageCost: '5.6'
    });

    expect(snapshot.appleCostRmb.toString()).toBe('112');
    expect(snapshot.profitAmount.toString()).toBe('73');
  });

  it('calculates profit from RMB-converted received amount', () => {
    const snapshot = service.calculateOrderFinancials({
      paidAmountRmb: new Prisma.Decimal('20').mul('7.2'),
      platformFeeRmb: new Prisma.Decimal('1').mul('7.2'),
      refundLossRmb: '0',
      appleCostValue: '10',
      averageCost: '5'
    });

    expect(snapshot.appleCostRmb.toString()).toBe('50');
    expect(snapshot.profitAmount.toString()).toBe('86.8');
  });

  it('calculates monthly expire time as the last included service day', () => {
    const expireTime = calculateExpireTime(
      {
        expireCalcType: 'by_month',
        defaultPeriodType: 'month',
        defaultPeriodValue: 1
      },
      new Date(2026, 4, 8, 6, 10, 6)
    );

    expect(expireTime?.getTime()).toBe(new Date(2026, 5, 7, 6, 10, 6).getTime());
  });

  it('calculates day-based expire time as the last included service day', () => {
    const expireTime = calculateExpireTime(
      {
        expireCalcType: 'by_day',
        defaultPeriodType: 'day',
        defaultPeriodValue: 7
      },
      new Date(2026, 4, 8, 6, 10, 6)
    );

    expect(expireTime?.getTime()).toBe(new Date(2026, 4, 14, 6, 10, 6).getTime());
  });

  it('does not overflow monthly expire time past the target month', () => {
    const expireTime = calculateExpireTime(
      {
        expireCalcType: 'by_month',
        defaultPeriodType: 'month',
        defaultPeriodValue: 1
      },
      new Date(2026, 0, 31, 6, 10, 6)
    );

    expect(expireTime?.getTime()).toBe(new Date(2026, 1, 27, 6, 10, 6).getTime());
  });

  it('marks account unavailable when balance is insufficient', () => {
    const evaluation = service.evaluateAccountAvailability(
      {
        ...baseAccount,
        currentBalance: new Prisma.Decimal('10')
      },
      baseService,
      {
        amountRequired: new Prisma.Decimal('20'),
        currency: 'USD'
      }
    );

    expect(evaluation.availability).toBe('unavailable');
    expect(evaluation.reason).toContain('余额不足');
  });

  it('marks account unavailable when region does not match', () => {
    const evaluation = service.evaluateAccountAvailability(
      {
        ...baseAccount,
        region: 'HK'
      },
      baseService,
      {
        amountRequired: new Prisma.Decimal('20'),
        currency: 'USD'
      }
    );

    expect(evaluation.availability).toBe('unavailable');
    expect(evaluation.reason).toBe('地区不匹配');
  });

  it('marks need_verify account as need_confirm', () => {
    const evaluation = service.evaluateAccountAvailability(
      {
        ...baseAccount,
        status: 'need_verify'
      },
      baseService,
      {
        amountRequired: new Prisma.Decimal('20'),
        currency: 'USD'
      }
    );

    expect(evaluation.availability).toBe('need_confirm');
  });

  it('marks account unavailable when service lock already exists', () => {
    const evaluation = service.evaluateAccountAvailability(
      {
        ...baseAccount,
        locks: [
          {
            lockScope: 'by_service',
            serviceId: 'service-id',
            status: 'active'
          }
        ]
      },
      baseService,
      {
        amountRequired: new Prisma.Decimal('20'),
        currency: 'USD'
      }
    );

    expect(evaluation.availability).toBe('unavailable');
    expect(evaluation.reason).toBe('该业务已占用此 Apple ID');
  });

  it('applies whitelisted list sorting', async () => {
    const findMany = jest.fn().mockReturnValue([]);
    const count = jest.fn().mockReturnValue(0);
    const prisma = {
      appleOrder: {
        findMany,
        count
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const serviceWithPrisma = new AppleOrdersService(prisma, {} as AuditLogsService);

    for (const sortBy of ['profitAmount', 'platformFeeRmb', 'refundLossRmb']) {
      findMany.mockClear();

      await serviceWithPrisma.list({
        page: '1',
        pageSize: '20',
        sortBy,
        sortOrder: 'asc'
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ [sortBy]: 'asc' }, { createdAt: 'desc' }]
        })
      );
    }

    expect(count).toHaveBeenCalled();
  });

  function calculateExpireTime(
    appleService: {
      expireCalcType: 'by_month' | 'by_day' | 'manual';
      defaultPeriodType: 'month' | 'day' | 'manual';
      defaultPeriodValue: number;
    },
    startTime: Date
  ) {
    return (
      service as unknown as {
        calculateExpireTime: (service: typeof appleService, startTime: Date) => Date | null;
      }
    ).calculateExpireTime(appleService, startTime);
  }
});
