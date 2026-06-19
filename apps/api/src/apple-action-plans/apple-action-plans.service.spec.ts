import { Prisma } from '@prisma/client';
import { AppleActionPlansService } from './apple-action-plans.service';

describe('AppleActionPlansService', () => {
  const service = new AppleActionPlansService({} as never, {} as never);
  const now = new Date('2026-07-07T00:00:00.000Z');

  it('applies whitelisted action plan list sorting', async () => {
    const prisma = {
      appleAccountActionPlan: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    };
    const serviceWithPrisma = new AppleActionPlansService(prisma as never, {} as never);

    await serviceWithPrisma.list({
      page: '1',
      pageSize: '20',
      sortBy: 'itemCount',
      sortOrder: 'desc'
    });

    expect(prisma.appleAccountActionPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ items: { _count: 'desc' } }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.appleAccountActionPlan.count).toHaveBeenCalled();
  });

  function activation(
    overrides: Partial<Parameters<typeof service.buildPlanSnapshot>[0]['activations'][number]> = {}
  ) {
    return {
      activationId: '00000000-0000-0000-0000-000000000001',
      customerId: '00000000-0000-0000-0000-000000000002',
      customerName: '测试客户',
      serviceId: '00000000-0000-0000-0000-000000000003',
      serviceName: 'ChatGPT Plus',
      currentPlan: '月付',
      targetPlan: '月付',
      expireTime: new Date('2026-07-10T00:00:00.000Z'),
      renewalDecision: 'renew' as const,
      autoRenewStatus: 'enabled' as const,
      consumedValue: new Prisma.Decimal(20),
      serviceOfficialCostValue: new Prisma.Decimal(20),
      taskId: null,
      ...overrides
    };
  }

  it('aggregates renewal amount and suggested topup by Apple ID balance', () => {
    const snapshot = service.buildPlanSnapshot({
      currentBalance: new Prisma.Decimal(15),
      avgUnitCost: new Prisma.Decimal(7.5),
      activeServiceCount: 2,
      activations: [
        activation({ consumedValue: new Prisma.Decimal(20) }),
        activation({
          activationId: '00000000-0000-0000-0000-000000000004',
          renewalDecision: 'change_plan',
          consumedValue: new Prisma.Decimal(10)
        })
      ],
      now
    });

    expect(snapshot.renewServicesCount).toBe(2);
    expect(snapshot.requiredRenewalAmount.toString()).toBe('30');
    expect(snapshot.suggestedTopupAmount.toString()).toBe('15');
    expect(snapshot.items.map((item) => item.actionType)).toEqual(['renew', 'change_plan']);
  });

  it('marks no-renew activations with enabled auto renewal as wrong-charge risk', () => {
    const snapshot = service.buildPlanSnapshot({
      currentBalance: new Prisma.Decimal(50),
      avgUnitCost: new Prisma.Decimal(7.5),
      activeServiceCount: 1,
      activations: [
        activation({
          renewalDecision: 'no_renew',
          autoRenewStatus: 'enabled'
        })
      ],
      now
    });

    expect(snapshot.hasWrongChargeRisk).toBe(true);
    expect(snapshot.cancelServicesCount).toBe(1);
    expect(snapshot.items[0]?.actionType).toBe('cancel');
    expect(snapshot.items[0]?.expectedChargeAmount.toString()).toBe('0');
    expect(snapshot.mainNote).toContain('误扣费风险');
  });

  it('marks unconfirmed near-expiration auto renewal as wrong-charge risk', () => {
    const snapshot = service.buildPlanSnapshot({
      currentBalance: new Prisma.Decimal(50),
      avgUnitCost: new Prisma.Decimal(7.5),
      activeServiceCount: 1,
      activations: [
        activation({
          renewalDecision: 'unconfirmed',
          autoRenewStatus: 'enabled',
          expireTime: new Date('2026-07-08T00:00:00.000Z')
        })
      ],
      now
    });

    expect(snapshot.hasWrongChargeRisk).toBe(true);
    expect(snapshot.pendingCustomerCount).toBe(1);
    expect(snapshot.items[0]?.actionType).toBe('wait_customer');
  });

  it('does not flag no-renew activation as risk when auto renewal is disabled', () => {
    const snapshot = service.buildPlanSnapshot({
      currentBalance: new Prisma.Decimal(50),
      avgUnitCost: new Prisma.Decimal(7.5),
      activeServiceCount: 1,
      activations: [
        activation({
          renewalDecision: 'no_renew',
          autoRenewStatus: 'disabled'
        })
      ],
      now
    });

    expect(snapshot.hasWrongChargeRisk).toBe(false);
    expect(snapshot.items[0]?.actionType).toBe('cancel');
  });
});
