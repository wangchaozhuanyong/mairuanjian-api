import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppleActionPlanItemActionType,
  AppleActionPlanItemStatus,
  AppleActionPlanStatus,
  AutoRenewStatus,
  Prisma,
  RenewalDecision,
  RenewalTaskType
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
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

type ActivationForPlan = Prisma.ServiceActivationGetPayload<{
  include: typeof activationForPlanInclude;
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
    private readonly auditLogsService: AuditLogsService
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
