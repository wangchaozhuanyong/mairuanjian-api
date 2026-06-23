import { Prisma } from '@prisma/client';
import { AppleActionPlansService } from './apple-action-plans.service';

describe('AppleActionPlansService', () => {
  const renewalTasksService = { clearListCache: jest.fn() };
  const service = new AppleActionPlansService(
    {} as never,
    {} as never,
    renewalTasksService as never
  );
  const now = new Date('2026-07-07T00:00:00.000Z');

  it('applies whitelisted action plan list sorting', async () => {
    const prisma = {
      appleAccountActionPlan: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    };
    const serviceWithPrisma = new AppleActionPlansService(
      prisma as never,
      {} as never,
      renewalTasksService as never
    );

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

  it('lists expiring customers from service activations', async () => {
    const expireTime = new Date('2026-07-10T00:00:00.000Z');
    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const activation = {
      id: '00000000-0000-0000-0000-000000000101',
      orderId: '00000000-0000-0000-0000-000000000102',
      customerId: '00000000-0000-0000-0000-000000000103',
      appleAccountId: '00000000-0000-0000-0000-000000000104',
      serviceId: '00000000-0000-0000-0000-000000000105',
      servicePriceId: '00000000-0000-0000-0000-000000000106',
      serviceRegion: 'US',
      currentPlan: null,
      targetPlan: null,
      startTime: createdAt,
      expireTime,
      consumedValue: new Prisma.Decimal(200),
      currency: 'USD',
      paidAmount: new Prisma.Decimal(1099),
      paidCurrency: 'CNY',
      paidAmountRmb: new Prisma.Decimal(1099),
      appleAccountOwnershipType: 'consigned',
      status: 'active',
      autoRenewStatus: 'enabled',
      renewalDecision: 'unconfirmed',
      renewalNote: null,
      createdAt,
      updatedAt: createdAt,
      order: {
        id: '00000000-0000-0000-0000-000000000102',
        orderNo: 'AO-001',
        externalOrderNo: 'P-001',
        serviceAccount: 'customer-site-account',
        paidAmount: new Prisma.Decimal(1099),
        paidCurrency: 'CNY',
        paidAmountRmb: new Prisma.Decimal(1099),
        status: 'active',
        createdAt
      },
      customer: {
        id: '00000000-0000-0000-0000-000000000103',
        name: '测试客户',
        phone: '13800138000',
        phoneTail: '8000',
        wechat: 'test-wx'
      },
      appleAccount: {
        id: '00000000-0000-0000-0000-000000000104',
        appleId: 'demo@example.com',
        region: 'US',
        currency: 'USD',
        currentBalance: new Prisma.Decimal(12),
        averageCost: new Prisma.Decimal(7.2),
        ownershipType: 'consigned',
        status: 'normal'
      },
      service: {
        id: '00000000-0000-0000-0000-000000000105',
        name: 'Claude Pro',
        category: 'Claude',
        currency: 'USD',
        officialCostValue: new Prisma.Decimal(200),
        defaultPeriodType: 'month',
        defaultPeriodValue: 12
      },
      servicePrice: {
        id: '00000000-0000-0000-0000-000000000106',
        serviceId: '00000000-0000-0000-0000-000000000105',
        serviceName: 'Claude Pro 1年',
        category: 'Claude',
        region: 'US',
        currency: 'USD',
        officialPrice: new Prisma.Decimal(200),
        appleBalancePrice: new Prisma.Decimal(200),
        periodType: 'month',
        periodValue: 12,
        status: 'active'
      },
      sourcePlatform: {
        id: '00000000-0000-0000-0000-000000000107',
        name: '闲鱼'
      },
      renewalTasks: [
        {
          id: '00000000-0000-0000-0000-000000000108',
          taskType: 'topup_apple_balance',
          title: '待充值续费：测试客户 · Claude Pro 1年 / US / 200 USD',
          status: 'waiting_payment',
          priority: 'high',
          customerDecision: 'confirmed_renewal',
          currentBalance: new Prisma.Decimal(12),
          expectedChargeAmount: new Prisma.Decimal(200),
          suggestedTopupAmount: new Prisma.Decimal(188),
          dueAt: expireTime,
          targetPlan: 'Claude Pro 1年 / US / 200 USD',
          createdAt
        }
      ]
    };
    const prisma = {
      serviceActivation: {
        findMany: jest.fn().mockResolvedValue([activation]),
        count: jest.fn().mockResolvedValue(1)
      }
    };
    const serviceWithPrisma = new AppleActionPlansService(
      prisma as never,
      {} as never,
      renewalTasksService as never
    );

    const result = await serviceWithPrisma.listExpiringCustomers({
      page: '1',
      pageSize: '20',
      expiresInDays: '3',
      keyword: 'test-wx',
      ownershipType: 'consigned',
      sortBy: 'expireTime',
      sortOrder: 'asc'
    });

    expect(prisma.serviceActivation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        orderBy: [{ expireTime: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.serviceActivation.count).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      customer: {
        name: '测试客户',
        phoneMasked: '138****8000',
        wechat: 'test-wx'
      },
      serviceAccount: 'customer-site-account',
      currentPackageSummary: 'Claude Pro 1年 / US / 200 USD',
      appleAccountOwnershipType: 'consigned',
      lastPaidAmount: '1099',
      lastPaidCurrency: 'CNY',
      renewalSubmitted: true,
      renewalTask: {
        taskType: 'topup_apple_balance',
        suggestedTopupAmount: '188'
      }
    });
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
