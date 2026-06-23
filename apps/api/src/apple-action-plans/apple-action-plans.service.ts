import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppleAccountOwnershipType,
  AppleAccountStatus,
  AppleActionPlanItemActionType,
  AppleActionPlanItemStatus,
  AppleActionPlanStatus,
  AutoRenewStatus,
  Prisma,
  RenewalDecision,
  RenewalTaskCustomerDecision,
  RenewalTaskPriority,
  RenewalTaskStatus,
  RenewalTaskType
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppleRenewalTasksService } from '../apple-renewal-tasks/apple-renewal-tasks.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getListCacheKey } from '../common/cache/list-cache-key';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';

interface ListActionPlansQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  appleAccountId?: string;
  hasWrongChargeRisk?: string;
  planDateFrom?: string;
  planDateTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListExpiringCustomersQuery extends PaginationQuery {
  keyword?: string;
  expiresInDays?: string;
  expireFrom?: string;
  expireTo?: string;
  status?: string;
  customerId?: string;
  appleAccountId?: string;
  serviceId?: string;
  category?: string;
  region?: string;
  ownershipType?: string;
  appleAccountStatus?: string;
  renewalSubmitted?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface SubmitExpiringCustomerDto {
  decision?: 'renew' | 'stop';
  targetRegion?: string | null;
  targetCategory?: string | null;
  targetServiceId?: string | null;
  targetServicePriceId?: string | null;
  note?: string | null;
}

export interface GenerateActionPlansDto {
  daysAhead?: number | string;
  now?: string;
}

export interface CompleteActionPlanDto {
  mainNote?: string | null;
}

interface ActionPlanSourceActivation {
  activationId: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  currentPlan: string | null;
  targetPlan: string | null;
  expireTime: Date | null;
  renewalDecision: RenewalDecision;
  autoRenewStatus: AutoRenewStatus;
  consumedValue: PrismaNamespace.Decimal.Value;
  serviceOfficialCostValue: PrismaNamespace.Decimal.Value;
  taskId: string | null;
}

export interface ActionPlanSnapshotInput {
  currentBalance: PrismaNamespace.Decimal.Value;
  avgUnitCost: PrismaNamespace.Decimal.Value;
  activeServiceCount: number;
  activations: ActionPlanSourceActivation[];
  now?: Date;
}

interface ActionPlanItemSnapshot {
  activationId: string;
  customerId: string;
  serviceId: string;
  currentPlan: string | null;
  targetPlan: string | null;
  expireTime: Date | null;
  customerDecision: RenewalDecision;
  actionType: AppleActionPlanItemActionType;
  expectedChargeAmount: PrismaNamespace.Decimal;
  cancelDeadline: Date | null;
  taskId: string | null;
  status: AppleActionPlanItemStatus;
  note: string;
}

interface ActionPlanSnapshot {
  currentBalance: PrismaNamespace.Decimal;
  avgUnitCost: PrismaNamespace.Decimal;
  activeServiceCount: number;
  renewServicesCount: number;
  cancelServicesCount: number;
  pendingCustomerCount: number;
  requiredRenewalAmount: PrismaNamespace.Decimal;
  suggestedTopupAmount: PrismaNamespace.Decimal;
  hasWrongChargeRisk: boolean;
  mainNote: string;
  items: ActionPlanItemSnapshot[];
}

interface ExpiringRenewalTaskInput {
  taskType: RenewalTaskType;
  title: string;
  status: RenewalTaskStatus;
  priority: RenewalTaskPriority;
  serviceId: string;
  currentPlan: string | null;
  targetPlan: string | null;
  renewalDecision: RenewalDecision;
  customerDecision: RenewalTaskCustomerDecision;
  requiredAction: string;
  currentBalance: PrismaNamespace.Decimal;
  expectedChargeAmount: PrismaNamespace.Decimal;
  suggestedTopupAmount: PrismaNamespace.Decimal;
  expectedChargeTime: Date | null;
  cancelDeadline: Date | null;
  remindAt: Date | null;
  dueAt: Date | null;
  note: string | null;
  renewalNote: string;
}

const ACTION_PLAN_SORT_FIELDS: Record<
  string,
  keyof Prisma.AppleAccountActionPlanOrderByWithRelationInput
> = {
  planDate: 'planDate',
  currentBalance: 'currentBalance',
  avgUnitCost: 'avgUnitCost',
  activeServiceCount: 'activeServiceCount',
  renewServicesCount: 'renewServicesCount',
  cancelServicesCount: 'cancelServicesCount',
  pendingCustomerCount: 'pendingCustomerCount',
  requiredRenewalAmount: 'requiredRenewalAmount',
  suggestedTopupAmount: 'suggestedTopupAmount',
  hasWrongChargeRisk: 'hasWrongChargeRisk',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  completedAt: 'completedAt'
};
const ACTION_PLAN_LIST_CACHE_TTL_MS = 120_000;
const EXPIRING_CUSTOMER_LIST_CACHE_TTL_MS = 60_000;

const EXPIRING_UNFINISHED_RENEWAL_STATUSES: RenewalTaskStatus[] = [
  'pending',
  'processing',
  'waiting_customer',
  'waiting_payment',
  'waiting_auto_renewal',
  'waiting_manual_verify',
  'failed',
  'abnormal',
  'postponed'
];

const EXPIRING_RENEWAL_WORKFLOW_TASK_TYPES: RenewalTaskType[] = [
  'contact_customer',
  'remind_customer_reply',
  'confirm_payment',
  'topup_apple_balance',
  'check_balance',
  'cancel_subscription',
  'change_plan',
  'wait_auto_renewal',
  'check_renewal_result',
  'handle_abnormal'
];

const EXPIRING_CUSTOMER_SORT_FIELDS: Record<
  string,
  keyof Prisma.ServiceActivationOrderByWithRelationInput
> = {
  expireTime: 'expireTime',
  paidAmount: 'paidAmount',
  paidAmountRmb: 'paidAmountRmb',
  consumedValue: 'consumedValue',
  status: 'status',
  renewalDecision: 'renewalDecision',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

const actionPlanListInclude = {
  appleAccount: {
    select: {
      id: true,
      appleId: true,
      region: true,
      currency: true,
      currentBalance: true,
      averageCost: true,
      status: true
    }
  },
  createdBy: {
    select: {
      id: true,
      username: true,
      displayName: true
    }
  },
  completedBy: {
    select: {
      id: true,
      username: true,
      displayName: true
    }
  },
  _count: {
    select: {
      items: true
    }
  }
} satisfies Prisma.AppleAccountActionPlanInclude;

const actionPlanItemInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      wechat: true
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
  activation: {
    select: {
      id: true,
      expireTime: true,
      status: true,
      autoRenewStatus: true,
      renewalDecision: true,
      renewalNote: true
    }
  },
  task: {
    select: {
      id: true,
      taskType: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true
    }
  }
} satisfies Prisma.AppleAccountActionPlanItemInclude;

const actionPlanDetailInclude = {
  ...actionPlanListInclude,
  items: {
    include: actionPlanItemInclude,
    orderBy: [{ expireTime: 'asc' }, { createdAt: 'asc' }]
  }
} satisfies Prisma.AppleAccountActionPlanInclude;

const activationForPlanInclude = {
  appleAccount: {
    select: {
      id: true,
      appleId: true,
      region: true,
      currency: true,
      currentBalance: true,
      averageCost: true,
      status: true
    }
  },
  customer: {
    select: {
      id: true,
      name: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      officialCostValue: true
    }
  },
  renewalTasks: {
    where: {
      status: {
        in: [
          'pending',
          'processing',
          'waiting_customer',
          'waiting_payment',
          'waiting_auto_renewal',
          'waiting_manual_verify',
          'failed',
          'abnormal',
          'postponed'
        ]
      }
    },
    select: {
      id: true,
      taskType: true,
      status: true,
      priority: true,
      dueAt: true
    },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
  }
} satisfies Prisma.ServiceActivationInclude;

const expiringCustomerInclude = {
  order: {
    select: {
      id: true,
      orderNo: true,
      externalOrderNo: true,
      serviceAccount: true,
      paidAmount: true,
      paidCurrency: true,
      paidAmountRmb: true,
      status: true,
      createdAt: true
    }
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      phoneTail: true,
      wechat: true
    }
  },
  appleAccount: {
    select: {
      id: true,
      appleId: true,
      region: true,
      currency: true,
      currentBalance: true,
      averageCost: true,
      ownershipType: true,
      status: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      category: true,
      currency: true,
      officialCostValue: true,
      defaultPeriodType: true,
      defaultPeriodValue: true
    }
  },
  servicePrice: {
    select: {
      id: true,
      serviceId: true,
      serviceName: true,
      category: true,
      region: true,
      currency: true,
      officialPrice: true,
      appleBalancePrice: true,
      periodType: true,
      periodValue: true,
      status: true
    }
  },
  sourcePlatform: {
    select: {
      id: true,
      name: true
    }
  },
  renewalTasks: {
    where: {
      status: {
        in: EXPIRING_UNFINISHED_RENEWAL_STATUSES
      }
    },
    select: {
      id: true,
      taskType: true,
      title: true,
      status: true,
      priority: true,
      customerDecision: true,
      currentBalance: true,
      expectedChargeAmount: true,
      suggestedTopupAmount: true,
      dueAt: true,
      targetPlan: true,
      createdAt: true
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 5
  }
} satisfies Prisma.ServiceActivationInclude;

type ActivationForPlan = Prisma.ServiceActivationGetPayload<{
  include: typeof activationForPlanInclude;
}>;

type ExpiringCustomerPayload = Prisma.ServiceActivationGetPayload<{
  include: typeof expiringCustomerInclude;
}>;

type ActionPlanListPayload = Prisma.AppleAccountActionPlanGetPayload<{
  include: typeof actionPlanListInclude;
}>;

type ActionPlanDetailPayload = Prisma.AppleAccountActionPlanGetPayload<{
  include: typeof actionPlanDetailInclude;
}>;

type ActionPlanItemPayload = Prisma.AppleAccountActionPlanItemGetPayload<{
  include: typeof actionPlanItemInclude;
}>;

@Injectable()
export class AppleActionPlansService {
  private readonly listCache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly appleRenewalTasksService: AppleRenewalTasksService
  ) {}

  async list(query: ListActionPlansQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('apple-action-plans', query),
      ACTION_PLAN_LIST_CACHE_TTL_MS,
      async () => {
        const pagination = getPagination(query);
        const keyword = query.keyword?.trim();
        const status = this.parseStatus(query.status, false);
        const planDateFrom = this.parseDate(query.planDateFrom, 'planDateFrom');
        const planDateTo = this.parseDate(query.planDateTo, 'planDateTo');
        const hasWrongChargeRisk = this.parseOptionalBoolean(query.hasWrongChargeRisk);

        const where: Prisma.AppleAccountActionPlanWhereInput = {
          status: status ?? undefined,
          appleAccountId: query.appleAccountId || undefined,
          hasWrongChargeRisk: hasWrongChargeRisk ?? undefined,
          planDate:
            planDateFrom || planDateTo
              ? {
                  gte: planDateFrom ?? undefined,
                  lte: planDateTo ?? undefined
                }
              : undefined,
          OR: keyword
            ? [
                { mainNote: { contains: keyword, mode: 'insensitive' } },
                {
                  appleAccount: {
                    is: {
                      appleIdNormalized: { contains: keyword.toLowerCase(), mode: 'insensitive' }
                    }
                  }
                },
                {
                  items: {
                    some: {
                      customer: { is: { name: { contains: keyword, mode: 'insensitive' } } }
                    }
                  }
                },
                {
                  items: {
                    some: {
                      service: { is: { name: { contains: keyword, mode: 'insensitive' } } }
                    }
                  }
                }
              ]
            : undefined
        };

        const [items, total] = await Promise.all([
          this.prisma.appleAccountActionPlan.findMany({
            where,
            include: actionPlanListInclude,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: this.buildOrderBy(query)
          }),
          this.prisma.appleAccountActionPlan.count({ where })
        ]);

        return {
          items: items.map((plan) => this.toPlanResponse(plan)),
          total,
          page: pagination.page,
          pageSize: pagination.pageSize
        };
      }
    );
  }

  async get(id: string) {
    const plan = await this.prisma.appleAccountActionPlan.findUnique({
      where: { id },
      include: actionPlanDetailInclude
    });

    if (!plan) {
      throw new NotFoundException('Apple action plan not found');
    }

    return this.toPlanResponse(plan);
  }

  async listItems(id: string) {
    const plan = await this.get(id);
    return {
      items: plan.items ?? []
    };
  }

  async listExpiringCustomers(query: ListExpiringCustomersQuery) {
    return this.listCache.getOrSet(
      getListCacheKey('apple-action-plans:expiring-customers', query),
      EXPIRING_CUSTOMER_LIST_CACHE_TTL_MS,
      async () => {
        const pagination = getPagination(query);
        const keyword = query.keyword?.trim();
        const status = this.parseActivationStatus(query.status);
        const ownershipType = this.parseOwnershipType(query.ownershipType);
        const appleAccountStatus = this.parseAppleAccountStatus(query.appleAccountStatus);
        const renewalSubmitted = this.parseOptionalBoolean(query.renewalSubmitted);
        const expireTime = this.buildExpiringDateRange(query);

        const where: Prisma.ServiceActivationWhereInput = {
          status: status ?? 'active',
          customerId: query.customerId || undefined,
          appleAccountId: query.appleAccountId || undefined,
          serviceId: query.serviceId || undefined,
          serviceRegion: query.region || undefined,
          expireTime,
          order: {
            deletedAt: null,
            status: {
              notIn: ['cancelled', 'abnormal']
            }
          },
          customer: {
            deletedAt: null
          },
          service: {
            category: query.category || undefined,
            deletedAt: null
          },
          appleAccount:
            ownershipType || appleAccountStatus
              ? {
                  is: {
                    ownershipType: ownershipType ?? undefined,
                    status: appleAccountStatus ?? undefined,
                    deletedAt: null
                  }
                }
              : {
                  is: {
                    deletedAt: null
                  }
                },
          renewalTasks:
            renewalSubmitted === undefined
              ? undefined
              : renewalSubmitted
                ? {
                    some: {
                      status: {
                        in: EXPIRING_UNFINISHED_RENEWAL_STATUSES
                      }
                    }
                  }
                : {
                    none: {
                      status: {
                        in: EXPIRING_UNFINISHED_RENEWAL_STATUSES
                      }
                    }
                  },
          OR: keyword
            ? [
                { currentPlan: { contains: keyword, mode: 'insensitive' } },
                { targetPlan: { contains: keyword, mode: 'insensitive' } },
                { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
                { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
                { customer: { is: { phoneTail: { contains: keyword, mode: 'insensitive' } } } },
                { customer: { is: { wechat: { contains: keyword, mode: 'insensitive' } } } },
                { service: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
                { service: { is: { category: { contains: keyword, mode: 'insensitive' } } } },
                { order: { is: { orderNo: { contains: keyword, mode: 'insensitive' } } } },
                {
                  order: {
                    is: { externalOrderNo: { contains: keyword, mode: 'insensitive' } }
                  }
                },
                {
                  order: {
                    is: { serviceAccount: { contains: keyword, mode: 'insensitive' } }
                  }
                },
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

        const [items, total] = await Promise.all([
          this.prisma.serviceActivation.findMany({
            where,
            include: expiringCustomerInclude,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: this.buildExpiringOrderBy(query)
          }),
          this.prisma.serviceActivation.count({ where })
        ]);

        return {
          items: items.map((activation) => this.toExpiringCustomerResponse(activation)),
          total,
          page: pagination.page,
          pageSize: pagination.pageSize
        };
      }
    );
  }

  async submitExpiringCustomer(
    activationId: string,
    dto: SubmitExpiringCustomerDto,
    operator?: AuthenticatedUser
  ) {
    const decision = this.parseSubmitDecision(dto.decision);
    const note = this.normalizeOptionalNullableString(dto.note);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const activation = await tx.serviceActivation.findUnique({
        where: { id: activationId },
        include: expiringCustomerInclude
      });

      if (!activation || activation.status !== 'active') {
        throw new BadRequestException('Active service activation not found');
      }

      if (!activation.appleAccountId || !activation.appleAccount) {
        throw new BadRequestException('This activation has no Apple ID to operate');
      }

      const taskInput =
        decision === 'renew'
          ? await this.buildRenewSubmitTask(tx, activation, dto, note, now)
          : this.buildStopSubmitTask(activation, note, now);

      const task = await this.upsertExpiringRenewalTask(tx, activation, taskInput, operator);
      await this.cancelConflictingExpiringTasks(tx, activation.id, task.id, taskInput.taskType);

      await tx.serviceActivation.update({
        where: { id: activation.id },
        data: {
          renewalDecision: taskInput.renewalDecision,
          targetPlan: taskInput.targetPlan,
          renewalNote: taskInput.renewalNote
        }
      });

      return {
        task,
        decision,
        activationId: activation.id
      };
    });

    this.listCache.clear();
    this.appleRenewalTasksService.clearListCache();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_action_plan',
      action: 'apple_action_plan.expiring_customer_submit',
      objectType: 'service_activation',
      objectId: activationId,
      afterData: this.toAuditJson({
        decision,
        taskId: result.task.id,
        taskType: result.task.taskType,
        targetPlan: result.task.targetPlan
      }),
      remark: `Submitted expiring customer ${activationId} as ${decision}`
    });

    const updatedActivation = await this.prisma.serviceActivation.findUnique({
      where: { id: activationId },
      include: expiringCustomerInclude
    });

    return {
      submitted: true,
      decision,
      task: this.toSubmittedTaskResponse(result.task),
      row: updatedActivation ? this.toExpiringCustomerResponse(updatedActivation) : null
    };
  }

  async generate(dto: GenerateActionPlansDto, operator?: AuthenticatedUser) {
    const daysAhead = this.parseDaysAhead(dto.daysAhead);
    const now = this.parseDate(dto.now, 'now') ?? new Date();
    const planDate = this.startOfUtcDay(now);
    const rangeEnd = this.addDays(now, daysAhead);

    const activations = await this.prisma.serviceActivation.findMany({
      where: {
        status: 'active',
        appleAccountId: {
          not: null
        },
        expireTime: {
          not: null,
          lte: rangeEnd
        }
      },
      include: activationForPlanInclude,
      orderBy: [{ appleAccountId: 'asc' }, { expireTime: 'asc' }],
      take: 500
    });

    const grouped = this.groupActivationsByAppleAccount(activations);
    let createdCount = 0;
    let updatedCount = 0;
    let itemCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const [appleAccountId, group] of grouped) {
        const account = group[0]?.appleAccount;
        if (!account) {
          continue;
        }

        const activeServiceCount = await tx.serviceActivation.count({
          where: {
            appleAccountId,
            status: 'active'
          }
        });
        const snapshot = this.buildPlanSnapshot({
          currentBalance: account.currentBalance,
          avgUnitCost: account.averageCost,
          activeServiceCount,
          activations: group.map((activation) => this.toSnapshotActivation(activation)),
          now
        });

        const existing = await tx.appleAccountActionPlan.findUnique({
          where: {
            appleAccountId_planDate: {
              appleAccountId,
              planDate
            }
          }
        });

        const planData = {
          currentBalance: snapshot.currentBalance,
          avgUnitCost: snapshot.avgUnitCost,
          activeServiceCount: snapshot.activeServiceCount,
          renewServicesCount: snapshot.renewServicesCount,
          cancelServicesCount: snapshot.cancelServicesCount,
          pendingCustomerCount: snapshot.pendingCustomerCount,
          requiredRenewalAmount: snapshot.requiredRenewalAmount,
          suggestedTopupAmount: snapshot.suggestedTopupAmount,
          hasWrongChargeRisk: snapshot.hasWrongChargeRisk,
          status: snapshot.hasWrongChargeRisk ? 'abnormal' : 'pending',
          mainNote: snapshot.mainNote
        } satisfies Prisma.AppleAccountActionPlanUpdateInput;

        const plan = existing
          ? await tx.appleAccountActionPlan.update({
              where: { id: existing.id },
              data: planData
            })
          : await tx.appleAccountActionPlan.create({
              data: {
                appleAccountId,
                planDate,
                ...planData,
                createdByUserId: operator?.id
              }
            });

        await tx.appleAccountActionPlanItem.deleteMany({
          where: {
            planId: plan.id
          }
        });

        if (snapshot.items.length) {
          await tx.appleAccountActionPlanItem.createMany({
            data: snapshot.items.map((item) => ({
              planId: plan.id,
              activationId: item.activationId,
              customerId: item.customerId,
              serviceId: item.serviceId,
              currentPlan: item.currentPlan,
              targetPlan: item.targetPlan,
              expireTime: item.expireTime,
              customerDecision: item.customerDecision,
              actionType: item.actionType,
              expectedChargeAmount: item.expectedChargeAmount,
              cancelDeadline: item.cancelDeadline,
              taskId: item.taskId,
              status: item.status,
              note: item.note
            }))
          });
        }

        if (existing) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
        itemCount += snapshot.items.length;
      }
    });

    this.listCache.clear();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_action_plan',
      action: 'apple_action_plan.generate',
      objectType: 'apple_action_plan',
      afterData: this.toAuditJson({
        scannedActivations: activations.length,
        accountCount: grouped.size,
        createdCount,
        updatedCount,
        itemCount,
        daysAhead
      }),
      remark: `Generated Apple action plans for ${grouped.size} Apple IDs`
    });

    return {
      scannedActivations: activations.length,
      accountCount: grouped.size,
      createdCount,
      updatedCount,
      itemCount,
      daysAhead,
      planDate,
      rangeEnd
    };
  }

  async complete(id: string, dto: CompleteActionPlanDto, operator?: AuthenticatedUser) {
    const plan = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appleAccountActionPlan.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new NotFoundException('Apple action plan not found');
      }

      await tx.appleAccountActionPlanItem.updateMany({
        where: {
          planId: id,
          status: 'pending'
        },
        data: {
          status: 'completed'
        }
      });

      return tx.appleAccountActionPlan.update({
        where: { id },
        data: {
          status: 'completed',
          mainNote: this.normalizeOptionalNullableString(dto.mainNote) ?? existing.mainNote,
          completedBy: operator?.id ? { connect: { id: operator.id } } : undefined,
          completedAt: new Date()
        }
      });
    });

    this.listCache.clear();
    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_action_plan',
      action: 'apple_action_plan.complete',
      objectType: 'apple_action_plan',
      objectId: plan.id,
      afterData: this.toAuditJson({
        status: plan.status,
        mainNote: plan.mainNote
      }),
      remark: `Completed Apple action plan ${plan.id}`
    });

    return this.get(plan.id);
  }

  buildPlanSnapshot(input: ActionPlanSnapshotInput): ActionPlanSnapshot {
    const now = input.now ?? new Date();
    const currentBalance = new PrismaNamespace.Decimal(input.currentBalance).toDecimalPlaces(4);
    const avgUnitCost = new PrismaNamespace.Decimal(input.avgUnitCost).toDecimalPlaces(8);
    const items = input.activations.map((activation) => this.buildItemSnapshot(activation, now));
    const renewItems = items.filter(
      (item) => item.actionType === 'renew' || item.actionType === 'change_plan'
    );
    const requiredRenewalAmount = renewItems
      .reduce((sum, item) => sum.plus(item.expectedChargeAmount), new PrismaNamespace.Decimal(0))
      .toDecimalPlaces(4);
    const suggestedTopupAmount = PrismaNamespace.Decimal.max(
      new PrismaNamespace.Decimal(0),
      requiredRenewalAmount.minus(currentBalance)
    ).toDecimalPlaces(4);
    const hasWrongChargeRisk = input.activations.some((activation) =>
      this.hasWrongChargeRisk(activation, now)
    );

    return {
      currentBalance,
      avgUnitCost,
      activeServiceCount: input.activeServiceCount,
      renewServicesCount: items.filter(
        (item) => item.actionType === 'renew' || item.actionType === 'change_plan'
      ).length,
      cancelServicesCount: items.filter((item) => item.actionType === 'cancel').length,
      pendingCustomerCount: items.filter((item) => item.actionType === 'wait_customer').length,
      requiredRenewalAmount,
      suggestedTopupAmount,
      hasWrongChargeRisk,
      mainNote: this.buildMainNote({
        itemCount: items.length,
        requiredRenewalAmount,
        suggestedTopupAmount,
        hasWrongChargeRisk
      }),
      items
    };
  }

  private async buildRenewSubmitTask(
    tx: Prisma.TransactionClient,
    activation: ExpiringCustomerPayload,
    dto: SubmitExpiringCustomerDto,
    note: string | null | undefined,
    now: Date
  ): Promise<ExpiringRenewalTaskInput> {
    const targetPrice = dto.targetServicePriceId
      ? await tx.appleServiceRegionPrice.findFirst({
          where: {
            id: dto.targetServicePriceId,
            status: 'active',
            deletedAt: null
          },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                category: true,
                currency: true,
                officialCostValue: true
              }
            }
          }
        })
      : null;

    if (dto.targetServicePriceId && !targetPrice) {
      throw new BadRequestException('Selected service price is unavailable');
    }

    const targetServiceId = targetPrice?.serviceId || dto.targetServiceId || activation.serviceId;
    const targetService =
      targetPrice?.service ??
      (targetServiceId !== activation.serviceId
        ? await tx.appleService.findFirst({
            where: {
              id: targetServiceId,
              status: 'enabled',
              deletedAt: null
            },
            select: {
              id: true,
              name: true,
              category: true,
              currency: true,
              officialCostValue: true,
              defaultPeriodType: true,
              defaultPeriodValue: true
            }
          })
        : activation.service);

    if (!targetService) {
      throw new BadRequestException('Selected service is unavailable');
    }

    const currentBalance = new PrismaNamespace.Decimal(
      activation.appleAccount?.currentBalance ?? 0
    ).toDecimalPlaces(4);
    const expectedChargeAmount = this.resolveTargetChargeAmount(
      activation,
      targetPrice,
      targetService
    );
    const suggestedTopupAmount = PrismaNamespace.Decimal.max(
      new PrismaNamespace.Decimal(0),
      expectedChargeAmount.minus(currentBalance)
    ).toDecimalPlaces(4);
    const currentPlan = this.buildActivationPackageSummary(activation);
    const targetPlan = targetPrice
      ? this.buildRegionPricePlanLabel(targetPrice)
      : this.buildServicePlanLabel({
          name: targetService.name,
          category: targetService.category,
          region: dto.targetRegion || activation.serviceRegion || activation.appleAccount?.region,
          amount: expectedChargeAmount,
          currency: targetService.currency || activation.currency
        });
    const isChangePlan =
      targetServiceId !== activation.serviceId ||
      Boolean(targetPrice && targetPrice.id !== activation.servicePriceId);
    const taskType: RenewalTaskType = suggestedTopupAmount.greaterThan(0)
      ? 'topup_apple_balance'
      : isChangePlan
        ? 'change_plan'
        : 'wait_auto_renewal';
    const status: RenewalTaskStatus = suggestedTopupAmount.greaterThan(0)
      ? 'waiting_payment'
      : taskType === 'wait_auto_renewal'
        ? 'waiting_auto_renewal'
        : 'pending';
    const dueAt = activation.expireTime ?? this.addDays(now, 1);
    const renewalDecision: RenewalDecision = isChangePlan ? 'change_plan' : 'renew';
    const titlePrefix = suggestedTopupAmount.greaterThan(0)
      ? '待充值续费'
      : isChangePlan
        ? '改套餐续费'
        : '等待续费';
    const requiredAction = suggestedTopupAmount.greaterThan(0)
      ? `客户确认续费，先给 Apple ID 充值 ${suggestedTopupAmount.toString()} ${
          activation.appleAccount?.currency ?? activation.currency
        }`
      : isChangePlan
        ? '客户确认续费，按选择的国家、分类、业务提交改套餐续费'
        : '客户确认续费，余额足够，等待自动续费或检查扣费结果';
    const renewalNote = this.buildSubmitRenewalNote(renewalDecision, targetPlan, note);

    return {
      taskType,
      title: `${titlePrefix}：${activation.customer.name} · ${targetPlan}`,
      status,
      priority: this.resolvePriorityByExpireTime(activation.expireTime, now),
      serviceId: targetServiceId,
      currentPlan,
      targetPlan,
      renewalDecision,
      customerDecision: 'confirmed_renewal',
      requiredAction,
      currentBalance,
      expectedChargeAmount,
      suggestedTopupAmount,
      expectedChargeTime: activation.expireTime,
      cancelDeadline: null,
      remindAt: this.safeDateBefore(activation.expireTime, 1, now),
      dueAt,
      note: note ?? null,
      renewalNote
    };
  }

  private buildStopSubmitTask(
    activation: ExpiringCustomerPayload,
    note: string | null | undefined,
    now: Date
  ): ExpiringRenewalTaskInput {
    const currentBalance = new PrismaNamespace.Decimal(
      activation.appleAccount?.currentBalance ?? 0
    ).toDecimalPlaces(4);
    const currentPlan = this.buildActivationPackageSummary(activation);
    const cancelDeadline = this.safeDateBefore(activation.expireTime, 1, now);
    const renewalNote = this.buildSubmitRenewalNote('no_renew', currentPlan, note);

    return {
      taskType: 'cancel_subscription',
      title: `停止续费：${activation.customer.name} · ${currentPlan}`,
      status: 'pending',
      priority: this.resolvePriorityByExpireTime(activation.expireTime, now),
      serviceId: activation.serviceId,
      currentPlan,
      targetPlan: currentPlan,
      renewalDecision: 'no_renew',
      customerDecision: 'confirmed_no_renewal',
      requiredAction: '客户选择停止，到期前取消订阅或关闭自动续费',
      currentBalance,
      expectedChargeAmount: new PrismaNamespace.Decimal(0),
      suggestedTopupAmount: new PrismaNamespace.Decimal(0),
      expectedChargeTime: null,
      cancelDeadline,
      remindAt: cancelDeadline,
      dueAt: cancelDeadline,
      note: note ?? null,
      renewalNote
    };
  }

  private async upsertExpiringRenewalTask(
    tx: Prisma.TransactionClient,
    activation: ExpiringCustomerPayload,
    input: ExpiringRenewalTaskInput,
    operator?: AuthenticatedUser
  ) {
    const existing = await tx.renewalTask.findFirst({
      where: {
        activationId: activation.id,
        taskType: input.taskType,
        status: {
          in: EXPIRING_UNFINISHED_RENEWAL_STATUSES
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    const data = {
      taskType: input.taskType,
      title: input.title,
      status: input.status,
      priority: input.priority,
      customerId: activation.customerId,
      appleAccountId: activation.appleAccountId,
      serviceId: input.serviceId,
      activationId: activation.id,
      orderId: activation.orderId,
      currentPlan: input.currentPlan,
      targetPlan: input.targetPlan,
      customerDecision: input.customerDecision,
      requiredAction: input.requiredAction,
      currentBalance: input.currentBalance,
      expectedChargeAmount: input.expectedChargeAmount,
      suggestedTopupAmount: input.suggestedTopupAmount,
      expectedChargeTime: input.expectedChargeTime,
      cancelDeadline: input.cancelDeadline,
      remindAt: input.remindAt,
      dueAt: input.dueAt,
      note: input.note
    };

    if (existing) {
      return tx.renewalTask.update({
        where: { id: existing.id },
        data
      });
    }

    return tx.renewalTask.create({
      data: {
        ...data,
        createdByUserId: operator?.id
      }
    });
  }

  private async cancelConflictingExpiringTasks(
    tx: Prisma.TransactionClient,
    activationId: string,
    keepTaskId: string,
    keepTaskType: RenewalTaskType
  ) {
    const conflictingTaskTypes: RenewalTaskType[] =
      keepTaskType === 'cancel_subscription'
        ? EXPIRING_RENEWAL_WORKFLOW_TASK_TYPES.filter((item) => item !== 'cancel_subscription')
        : ['cancel_subscription'];

    await tx.renewalTask.updateMany({
      where: {
        activationId,
        id: {
          not: keepTaskId
        },
        taskType: {
          in: conflictingTaskTypes
        },
        status: {
          in: EXPIRING_UNFINISHED_RENEWAL_STATUSES
        }
      },
      data: {
        status: 'cancelled',
        resultNote: '到期客户处理台已提交新的续费处理方式，旧任务自动取消'
      }
    });
  }

  private resolveTargetChargeAmount(
    activation: ExpiringCustomerPayload,
    targetPrice:
      | ({
          appleBalancePrice: PrismaNamespace.Decimal.Value;
        } & Record<string, unknown>)
      | null,
    targetService: {
      officialCostValue: PrismaNamespace.Decimal.Value;
    }
  ) {
    if (targetPrice) {
      return new PrismaNamespace.Decimal(targetPrice.appleBalancePrice).toDecimalPlaces(4);
    }

    const consumedValue = new PrismaNamespace.Decimal(activation.consumedValue);
    if (consumedValue.greaterThan(0)) {
      return consumedValue.toDecimalPlaces(4);
    }

    return new PrismaNamespace.Decimal(targetService.officialCostValue).toDecimalPlaces(4);
  }

  private buildSubmitRenewalNote(
    decision: RenewalDecision,
    targetPlan: string | null,
    note: string | null | undefined
  ) {
    const decisionLabel =
      decision === 'no_renew' ? '停止续费' : decision === 'change_plan' ? '改套餐续费' : '续费';
    return [
      `到期客户处理台提交：${decisionLabel}`,
      targetPlan ? `目标：${targetPlan}` : '',
      note || ''
    ]
      .filter(Boolean)
      .join('；');
  }

  private resolvePriorityByExpireTime(expireTime: Date | null, now: Date): RenewalTaskPriority {
    const days = this.calculateDaysUntil(expireTime, now);
    if (days <= 1) return 'urgent';
    if (days <= 3) return 'high';
    if (days <= 7) return 'medium';
    return 'low';
  }

  private buildExpiringDateRange(query: ListExpiringCustomersQuery) {
    const expireFrom = this.parseDate(query.expireFrom, 'expireFrom');
    const expireTo = this.parseDate(query.expireTo, 'expireTo');

    if (expireFrom || expireTo) {
      return {
        gte: expireFrom ?? undefined,
        lte: expireTo ?? undefined
      };
    }

    const daysAhead = this.parseExpiresInDays(query.expiresInDays);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + daysAhead + 1);

    return {
      gte: start,
      lt: end
    };
  }

  private parseExpiresInDays(value: string | undefined) {
    if (value === undefined || value === '') {
      return 3;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
      throw new BadRequestException('expiresInDays must be an integer between 0 and 365');
    }

    return parsed;
  }

  private parseActivationStatus(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'active' ||
      value === 'expired' ||
      value === 'cancelled' ||
      value === 'abnormal'
    ) {
      return value;
    }

    throw new BadRequestException('Invalid activation status');
  }

  private parseOwnershipType(value: unknown): AppleAccountOwnershipType | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'consigned' || value === 'sold') {
      return value;
    }

    throw new BadRequestException('Invalid Apple ID ownership type');
  }

  private parseAppleAccountStatus(value: unknown): AppleAccountStatus | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'normal' ||
      value === 'need_verify' ||
      value === 'locked' ||
      value === 'password_error' ||
      value === 'risk' ||
      value === 'unknown'
    ) {
      return value;
    }

    throw new BadRequestException('Invalid Apple ID status');
  }

  private parseSubmitDecision(value: unknown): 'renew' | 'stop' {
    if (value === 'renew' || value === 'stop') {
      return value;
    }

    throw new BadRequestException('decision must be renew or stop');
  }

  private buildExpiringOrderBy(
    query: ListExpiringCustomersQuery
  ): Prisma.ServiceActivationOrderByWithRelationInput[] {
    const sortField = query.sortBy ? EXPIRING_CUSTOMER_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ expireTime: 'asc' }, { createdAt: 'desc' }];
    }

    return sortField === 'createdAt'
      ? [{ createdAt: sortOrder }]
      : [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private buildActivationPackageSummary(activation: ExpiringCustomerPayload) {
    const serviceName =
      activation.servicePrice?.serviceName ||
      activation.targetPlan ||
      activation.currentPlan ||
      activation.service.name;
    const region =
      activation.servicePrice?.region ||
      activation.serviceRegion ||
      activation.appleAccount?.region;
    const currency =
      activation.servicePrice?.currency || activation.currency || activation.service.currency;
    const consumedValue = new PrismaNamespace.Decimal(activation.consumedValue);
    const amount = activation.servicePrice?.appleBalancePrice
      ? new PrismaNamespace.Decimal(activation.servicePrice.appleBalancePrice)
      : consumedValue.greaterThan(0)
        ? consumedValue
        : new PrismaNamespace.Decimal(activation.service.officialCostValue);

    return this.buildServicePlanLabel({
      name: serviceName,
      category: activation.service.category,
      region,
      amount,
      currency
    });
  }

  private buildRegionPricePlanLabel(price: {
    serviceName: string;
    category: string;
    region: string;
    appleBalancePrice: PrismaNamespace.Decimal.Value;
    currency: string;
  }) {
    return this.buildServicePlanLabel({
      name: price.serviceName,
      category: price.category,
      region: price.region,
      amount: price.appleBalancePrice,
      currency: price.currency
    });
  }

  private buildServicePlanLabel(input: {
    name: string;
    category?: string | null;
    region?: string | null;
    amount: PrismaNamespace.Decimal.Value;
    currency?: string | null;
  }) {
    const name = input.name || '未记录套餐';
    const region = input.region || '未记录国家';
    const amount = new PrismaNamespace.Decimal(input.amount).toDecimalPlaces(4).toString();
    const currency = input.currency || '';

    return [name, region, `${amount} ${currency}`.trim()].filter(Boolean).join(' / ');
  }

  private buildItemSnapshot(
    activation: ActionPlanSourceActivation,
    now: Date
  ): ActionPlanItemSnapshot {
    const actionType = this.mapActionType(activation.renewalDecision);
    const expectedChargeAmount =
      actionType === 'renew' || actionType === 'change_plan'
        ? this.resolveExpectedChargeAmount(activation)
        : new PrismaNamespace.Decimal(0);
    const wrongChargeRisk = this.hasWrongChargeRisk(activation, now);
    const cancelDeadline =
      actionType === 'cancel' || wrongChargeRisk
        ? this.safeDateBefore(activation.expireTime, 1, now)
        : null;

    return {
      activationId: activation.activationId,
      customerId: activation.customerId,
      serviceId: activation.serviceId,
      currentPlan: activation.currentPlan,
      targetPlan: activation.targetPlan,
      expireTime: activation.expireTime,
      customerDecision: activation.renewalDecision,
      actionType,
      expectedChargeAmount,
      cancelDeadline,
      taskId: activation.taskId,
      status: 'pending',
      note: this.buildItemNote(activation, actionType, wrongChargeRisk)
    };
  }

  private mapActionType(value: RenewalDecision): AppleActionPlanItemActionType {
    if (value === 'renew') {
      return 'renew';
    }

    if (value === 'no_renew') {
      return 'cancel';
    }

    if (value === 'change_plan') {
      return 'change_plan';
    }

    return 'wait_customer';
  }

  private resolveExpectedChargeAmount(activation: ActionPlanSourceActivation) {
    const consumedValue = new PrismaNamespace.Decimal(activation.consumedValue);
    if (consumedValue.greaterThan(0)) {
      return consumedValue.toDecimalPlaces(4);
    }

    return new PrismaNamespace.Decimal(activation.serviceOfficialCostValue).toDecimalPlaces(4);
  }

  private hasWrongChargeRisk(activation: ActionPlanSourceActivation, now: Date) {
    if (activation.renewalDecision === 'no_renew' && activation.autoRenewStatus !== 'disabled') {
      return true;
    }

    return (
      activation.renewalDecision === 'unconfirmed' &&
      activation.autoRenewStatus === 'enabled' &&
      this.calculateDaysUntil(activation.expireTime, now) <= 1
    );
  }

  private buildMainNote(input: {
    itemCount: number;
    requiredRenewalAmount: PrismaNamespace.Decimal;
    suggestedTopupAmount: PrismaNamespace.Decimal;
    hasWrongChargeRisk: boolean;
  }) {
    const parts = [
      `本次生成 ${input.itemCount} 个操作项`,
      `预计续费 ${input.requiredRenewalAmount.toString()}`,
      `建议充值 ${input.suggestedTopupAmount.toString()}`
    ];

    if (input.hasWrongChargeRisk) {
      parts.push('存在误扣费风险，需优先处理取消订阅或人工确认');
    }

    return parts.join('；');
  }

  private buildItemNote(
    activation: ActionPlanSourceActivation,
    actionType: AppleActionPlanItemActionType,
    wrongChargeRisk: boolean
  ) {
    if (actionType === 'cancel') {
      return wrongChargeRisk
        ? '客户确认不续费，但自动续费未明确关闭，存在误扣费风险'
        : '客户确认不续费，按截止时间取消订阅';
    }

    if (actionType === 'renew') {
      return '客户确认续费，按续费任务完成收款、余额和扣费结果检查';
    }

    if (actionType === 'change_plan') {
      return '客户要求修改套餐，续费前先确认目标套餐';
    }

    if (wrongChargeRisk) {
      return '客户未确认且自动续费开启，临近到期需要人工验证误扣费风险';
    }

    return '客户尚未确认续费决定，继续联系客户';
  }

  private toSnapshotActivation(activation: ActivationForPlan): ActionPlanSourceActivation {
    const actionType = this.mapActionType(activation.renewalDecision);
    return {
      activationId: activation.id,
      customerId: activation.customerId,
      customerName: activation.customer.name,
      serviceId: activation.serviceId,
      serviceName: activation.service.name,
      currentPlan: activation.currentPlan,
      targetPlan: activation.targetPlan,
      expireTime: activation.expireTime,
      renewalDecision: activation.renewalDecision,
      autoRenewStatus: activation.autoRenewStatus,
      consumedValue: activation.consumedValue,
      serviceOfficialCostValue: activation.service.officialCostValue,
      taskId: this.findRelatedTaskId(activation, actionType)
    };
  }

  private findRelatedTaskId(
    activation: ActivationForPlan,
    actionType: AppleActionPlanItemActionType
  ) {
    const preferredTaskTypes: Record<AppleActionPlanItemActionType, RenewalTaskType[]> = {
      cancel: ['cancel_subscription'],
      renew: ['topup_apple_balance', 'wait_auto_renewal', 'confirm_payment', 'check_balance'],
      change_plan: ['change_plan', 'confirm_payment', 'check_balance'],
      wait_customer: ['contact_customer', 'remind_customer_reply', 'handle_abnormal']
    };
    const preferred = preferredTaskTypes[actionType];
    return activation.renewalTasks.find((task) => preferred.includes(task.taskType))?.id ?? null;
  }

  private groupActivationsByAppleAccount(activations: ActivationForPlan[]) {
    const grouped = new Map<string, ActivationForPlan[]>();
    for (const activation of activations) {
      if (!activation.appleAccountId || !activation.appleAccount) {
        continue;
      }

      const group = grouped.get(activation.appleAccountId) ?? [];
      group.push(activation);
      grouped.set(activation.appleAccountId, group);
    }

    return grouped;
  }

  private calculateDaysUntil(date: Date | null, now: Date) {
    if (!date) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  }

  private safeDateBefore(date: Date | null, days: number, fallback: Date) {
    if (!date) {
      return fallback;
    }

    const result = this.addDays(date, -days);
    return result.getTime() < fallback.getTime() ? fallback : result;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private startOfUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private parseDaysAhead(value: string | number | undefined) {
    if (value === undefined || value === '') {
      return 7;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 90) {
      throw new BadRequestException('daysAhead must be an integer between 0 and 90');
    }

    return parsed;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'pending' ||
      value === 'processing' ||
      value === 'completed' ||
      value === 'abnormal'
    ) {
      return value satisfies AppleActionPlanStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid action plan status');
    }

    return undefined;
  }

  private buildOrderBy(
    query: ListActionPlansQuery
  ): Prisma.AppleAccountActionPlanOrderByWithRelationInput[] {
    const sortField = query.sortBy ? ACTION_PLAN_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (query.sortBy === 'itemCount' && sortOrder) {
      return [{ items: { _count: sortOrder } }, { createdAt: 'desc' }];
    }

    if (!sortField || !sortOrder) {
      return [{ planDate: 'desc' }, { hasWrongChargeRisk: 'desc' }, { createdAt: 'desc' }];
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

  private parseOptionalBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    throw new BadRequestException('Invalid boolean parameter');
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

  private normalizeOptionalNullableString(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return value.trim() || null;
  }

  private maskAppleId(value: string) {
    const [name, domain] = value.split('@');
    if (!domain) {
      return value.length <= 4 ? '****' : `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    const prefix = name.length <= 2 ? `${name[0] ?? '*'}***` : `${name.slice(0, 2)}***`;
    return `${prefix}@${domain}`;
  }

  private maskPhone(value: string | null, tail?: string | null) {
    if (!value) {
      return tail ? `****${tail}` : null;
    }

    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return value.length <= 4 ? '****' : `${value.slice(0, 2)}****${value.slice(-2)}`;
    }

    if (digits.length <= 4) {
      return `****${digits}`;
    }

    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toPlanResponse(plan: ActionPlanListPayload | ActionPlanDetailPayload) {
    return {
      id: plan.id,
      appleAccountId: plan.appleAccountId,
      appleAccount: {
        id: plan.appleAccount.id,
        appleIdMasked: this.maskAppleId(plan.appleAccount.appleId),
        region: plan.appleAccount.region,
        currency: plan.appleAccount.currency,
        currentBalance: plan.appleAccount.currentBalance.toString(),
        averageCost: plan.appleAccount.averageCost.toString(),
        status: plan.appleAccount.status
      },
      planDate: plan.planDate,
      currentBalance: plan.currentBalance.toString(),
      avgUnitCost: plan.avgUnitCost.toString(),
      activeServiceCount: plan.activeServiceCount,
      renewServicesCount: plan.renewServicesCount,
      cancelServicesCount: plan.cancelServicesCount,
      pendingCustomerCount: plan.pendingCustomerCount,
      requiredRenewalAmount: plan.requiredRenewalAmount.toString(),
      suggestedTopupAmount: plan.suggestedTopupAmount.toString(),
      hasWrongChargeRisk: plan.hasWrongChargeRisk,
      status: plan.status,
      mainNote: plan.mainNote,
      itemCount: plan._count.items,
      createdBy: plan.createdBy,
      completedBy: plan.completedBy,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      completedAt: plan.completedAt,
      items: this.hasDetailItems(plan)
        ? plan.items.map((item) => this.toPlanItemResponse(item))
        : undefined
    };
  }

  private toExpiringCustomerResponse(activation: ExpiringCustomerPayload) {
    const daysUntilExpire = activation.expireTime
      ? this.calculateDaysUntil(activation.expireTime, new Date())
      : null;
    const currentPackageSummary = this.buildActivationPackageSummary(activation);
    const firstRenewalTask = activation.renewalTasks[0] ?? null;

    return {
      id: activation.id,
      activationId: activation.id,
      orderId: activation.orderId,
      orderNo: activation.order.orderNo,
      externalOrderNo: activation.externalOrderNo ?? activation.order.externalOrderNo,
      sourcePlatform: activation.sourcePlatform,
      customer: {
        id: activation.customer.id,
        name: activation.customer.name,
        phoneMasked: this.maskPhone(activation.customer.phone, activation.customer.phoneTail),
        phoneTail: activation.customer.phoneTail,
        wechat: activation.customer.wechat
      },
      service: {
        id: activation.service.id,
        name: activation.service.name,
        category: activation.service.category,
        currency: activation.service.currency,
        officialCostValue: activation.service.officialCostValue.toString()
      },
      servicePrice: activation.servicePrice
        ? {
            id: activation.servicePrice.id,
            serviceId: activation.servicePrice.serviceId,
            serviceName: activation.servicePrice.serviceName,
            category: activation.servicePrice.category,
            region: activation.servicePrice.region,
            currency: activation.servicePrice.currency,
            officialPrice: activation.servicePrice.officialPrice.toString(),
            appleBalancePrice: activation.servicePrice.appleBalancePrice.toString(),
            periodType: activation.servicePrice.periodType,
            periodValue: activation.servicePrice.periodValue,
            status: activation.servicePrice.status
          }
        : null,
      appleAccount: activation.appleAccount
        ? {
            id: activation.appleAccount.id,
            appleIdMasked: this.maskAppleId(activation.appleAccount.appleId),
            region: activation.appleAccount.region,
            currency: activation.appleAccount.currency,
            currentBalance: activation.appleAccount.currentBalance.toString(),
            averageCost: activation.appleAccount.averageCost.toString(),
            ownershipType: activation.appleAccount.ownershipType,
            status: activation.appleAccount.status
          }
        : null,
      appleAccountOwnershipType:
        activation.appleAccount?.ownershipType ?? activation.appleAccountOwnershipType,
      serviceRegion: activation.serviceRegion,
      serviceAccount: activation.order.serviceAccount,
      currentPlan: activation.currentPlan,
      targetPlan: activation.targetPlan,
      currentPackageSummary,
      startTime: activation.startTime,
      expireTime: activation.expireTime,
      daysUntilExpire,
      consumedValue: activation.consumedValue.toString(),
      currency: activation.currency,
      paidAmount: activation.paidAmount.toString(),
      paidCurrency: activation.paidCurrency,
      paidAmountRmb: activation.paidAmountRmb.toString(),
      lastPaidAmount: activation.order.paidAmount.toString(),
      lastPaidCurrency: activation.order.paidCurrency,
      lastPaidAmountRmb: activation.order.paidAmountRmb.toString(),
      status: activation.status,
      autoRenewStatus: activation.autoRenewStatus,
      renewalDecision: activation.renewalDecision,
      renewalNote: activation.renewalNote,
      renewalSubmitted: Boolean(firstRenewalTask),
      renewalTask: firstRenewalTask ? this.toSubmittedTaskResponse(firstRenewalTask) : null,
      renewalTasks: activation.renewalTasks.map((task) => this.toSubmittedTaskResponse(task)),
      createdAt: activation.createdAt,
      updatedAt: activation.updatedAt
    };
  }

  private toSubmittedTaskResponse(task: {
    id: string;
    taskType: RenewalTaskType;
    title: string;
    status: RenewalTaskStatus;
    priority: RenewalTaskPriority;
    customerDecision: RenewalTaskCustomerDecision;
    currentBalance: PrismaNamespace.Decimal.Value;
    expectedChargeAmount: PrismaNamespace.Decimal.Value;
    suggestedTopupAmount: PrismaNamespace.Decimal.Value;
    dueAt: Date | null;
    targetPlan: string | null;
    createdAt: Date;
  }) {
    return {
      id: task.id,
      taskType: task.taskType,
      title: task.title,
      status: task.status,
      priority: task.priority,
      customerDecision: task.customerDecision,
      currentBalance: new PrismaNamespace.Decimal(task.currentBalance).toString(),
      expectedChargeAmount: new PrismaNamespace.Decimal(task.expectedChargeAmount).toString(),
      suggestedTopupAmount: new PrismaNamespace.Decimal(task.suggestedTopupAmount).toString(),
      dueAt: task.dueAt,
      targetPlan: task.targetPlan,
      createdAt: task.createdAt
    };
  }

  private hasDetailItems(
    plan: ActionPlanListPayload | ActionPlanDetailPayload
  ): plan is ActionPlanDetailPayload {
    return 'items' in plan && Array.isArray(plan.items);
  }

  private toPlanItemResponse(item: ActionPlanItemPayload) {
    return {
      id: item.id,
      planId: item.planId,
      activationId: item.activationId,
      customerId: item.customerId,
      customer: item.customer,
      serviceId: item.serviceId,
      service: {
        ...item.service,
        officialCostValue: item.service.officialCostValue.toString()
      },
      activation: {
        ...item.activation,
        daysUntilExpire: item.activation.expireTime
          ? this.calculateDaysUntil(item.activation.expireTime, new Date())
          : null
      },
      currentPlan: item.currentPlan,
      targetPlan: item.targetPlan,
      expireTime: item.expireTime,
      customerDecision: item.customerDecision,
      actionType: item.actionType,
      expectedChargeAmount: item.expectedChargeAmount.toString(),
      cancelDeadline: item.cancelDeadline,
      taskId: item.taskId,
      task: item.task,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
