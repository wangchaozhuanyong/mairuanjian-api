import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppleRenewalTasksService } from './apple-renewal-tasks.service';

describe('AppleRenewalTasksService', () => {
  const service = new AppleRenewalTasksService({} as never, {} as never, {} as never);
  const now = new Date('2026-07-07T00:00:00.000Z');

  function baseInput(overrides: Partial<Parameters<typeof service.buildTaskPlan>[0]> = {}) {
    return {
      renewalDecision: 'unconfirmed' as const,
      autoRenewStatus: 'unknown' as const,
      expireTime: new Date('2026-07-10T00:00:00.000Z'),
      currentPlan: '标准版',
      targetPlan: '标准版',
      serviceName: 'ChatGPT Plus',
      customerName: '测试客户',
      expectedChargeAmount: new Prisma.Decimal(20),
      currentBalance: new Prisma.Decimal(30),
      currency: 'USD',
      now,
      ...overrides
    };
  }

  it('applies whitelisted renewal task list sorting', async () => {
    const prisma = {
      renewalTask: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const serviceWithPrisma = new AppleRenewalTasksService(
      prisma,
      {} as AuditLogsService,
      {} as NotificationsService
    );

    await serviceWithPrisma.list({
      page: '1',
      pageSize: '20',
      sortBy: 'dueAt',
      sortOrder: 'asc'
    });

    expect(prisma.renewalTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.renewalTask.count).toHaveBeenCalled();
  });

  it('generates a contact task before expiration when customer decision is unconfirmed', () => {
    const plan = service.buildTaskPlan(baseInput());

    expect(plan.map((item) => item.taskType)).toContain('contact_customer');
    expect(plan[0]?.status).toBe('pending');
    expect(plan[0]?.priority).toBe('high');
  });

  it('generates a cancel subscription task when customer confirms no renewal', () => {
    const plan = service.buildTaskPlan(
      baseInput({
        renewalDecision: 'no_renew'
      })
    );

    expect(plan).toHaveLength(1);
    expect(plan[0]?.taskType).toBe('cancel_subscription');
    expect(plan[0]?.customerDecision).toBe('confirmed_no_renewal');
    expect(plan[0]?.cancelDeadline?.toISOString()).toBe('2026-07-09T00:00:00.000Z');
  });

  it('generates a topup task when renewal balance is insufficient', () => {
    const plan = service.buildTaskPlan(
      baseInput({
        renewalDecision: 'renew',
        currentBalance: new Prisma.Decimal(12)
      })
    );

    expect(plan.map((item) => item.taskType)).toEqual(
      expect.arrayContaining(['confirm_payment', 'check_balance', 'topup_apple_balance'])
    );
    expect(
      plan.find((item) => item.taskType === 'topup_apple_balance')?.suggestedTopupAmount.toString()
    ).toBe('8');
    expect(plan.some((item) => item.taskType === 'wait_auto_renewal')).toBe(false);
  });

  it('generates a waiting auto renewal task when renewal balance is enough', () => {
    const plan = service.buildTaskPlan(
      baseInput({
        renewalDecision: 'renew',
        currentBalance: new Prisma.Decimal(30)
      })
    );

    expect(plan.map((item) => item.taskType)).toEqual(
      expect.arrayContaining(['confirm_payment', 'check_balance', 'wait_auto_renewal'])
    );
    expect(plan.some((item) => item.taskType === 'topup_apple_balance')).toBe(false);
    expect(plan.find((item) => item.taskType === 'wait_auto_renewal')?.status).toBe(
      'waiting_auto_renewal'
    );
  });

  it('returns urgent priority for already expired activations', () => {
    const plan = service.buildTaskPlan(
      baseInput({
        expireTime: new Date('2026-07-06T00:00:00.000Z')
      })
    );

    expect(plan[0]?.priority).toBe('urgent');
    expect(service.calculateDaysUntil(new Date('2026-07-06T00:00:00.000Z'), now)).toBe(-1);
  });
});
