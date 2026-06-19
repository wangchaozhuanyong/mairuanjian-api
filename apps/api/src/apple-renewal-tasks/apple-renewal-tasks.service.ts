import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
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
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ListRenewalTasksQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  taskType?: string;
  priority?: string;
  customerDecision?: string;
  customerId?: string;
  appleAccountId?: string;
  serviceId?: string;
  activationId?: string;
  assignedToUserId?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateRenewalTaskDto {
  activationId?: string;
  taskType?: string;
  title?: string;
  priority?: string;
  customerDecision?: string;
  requiredAction?: string | null;
  assignedToUserId?: string | null;
  note?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
}

export interface UpdateRenewalTaskDto {
  title?: string;
  status?: string;
  priority?: string;
  customerDecision?: string;
  requiredAction?: string | null;
  assignedToUserId?: string | null;
  note?: string | null;
  resultNote?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  evidenceAttachmentId?: string | null;
}

export interface CompleteRenewalTaskDto {
  resultNote?: string | null;
  customerDecision?: string;
  evidenceAttachmentId?: string | null;
}

export interface CancelRenewalTaskDto {
  resultNote?: string | null;
}

export interface PostponeRenewalTaskDto {
  dueAt?: string;
  remindAt?: string | null;
  note?: string | null;
}

export interface GenerateDueTasksDto {
  daysAhead?: number | string;
  now?: string;
}

interface RenewalTaskPlanInput {
  renewalDecision: RenewalDecision;
  autoRenewStatus: AutoRenewStatus;
  expireTime: Date | null;
  currentPlan: string | null;
  targetPlan: string | null;
  serviceName: string;
  customerName: string;
  expectedChargeAmount: PrismaNamespace.Decimal.Value;
  currentBalance: PrismaNamespace.Decimal.Value;
  currency: string;
  now?: Date;
}

interface RenewalTaskPlanItem {
  taskType: RenewalTaskType;
  title: string;
  status: RenewalTaskStatus;
  priority: RenewalTaskPriority;
  customerDecision: RenewalTaskCustomerDecision;
  requiredAction: string;
  currentBalance: PrismaNamespace.Decimal;
  expectedChargeAmount: PrismaNamespace.Decimal;
  suggestedTopupAmount: PrismaNamespace.Decimal;
  expectedChargeTime: Date | null;
  cancelDeadline: Date | null;
  remindAt: Date | null;
  dueAt: Date | null;
}

const unfinishedTaskStatuses: RenewalTaskStatus[] = [
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

const RENEWAL_TASK_SORT_FIELDS: Record<string, keyof Prisma.RenewalTaskOrderByWithRelationInput> = {
  title: 'title',
  taskType: 'taskType',
  status: 'status',
  priority: 'priority',
  customerDecision: 'customerDecision',
  currentBalance: 'currentBalance',
  expectedChargeAmount: 'expectedChargeAmount',
  suggestedTopupAmount: 'suggestedTopupAmount',
  expectedChargeTime: 'expectedChargeTime',
  cancelDeadline: 'cancelDeadline',
  remindAt: 'remindAt',
  dueAt: 'dueAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  completedAt: 'completedAt'
};

const renewalTaskInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      contactName: true,
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
      averageCost: true
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
  order: {
    select: {
      id: true,
      orderNo: true,
      status: true
    }
  },
  assignedTo: {
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
  evidenceAttachment: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true
    }
  }
} satisfies Prisma.RenewalTaskInclude;

const activationForGenerationInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      contactName: true,
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
      averageCost: true
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
  order: {
    select: {
      id: true,
      orderNo: true,
      status: true
    }
  }
} satisfies Prisma.ServiceActivationInclude;

type ActivationForGeneration = Prisma.ServiceActivationGetPayload<{
  include: typeof activationForGenerationInclude;
}>;

@Injectable()
export class AppleRenewalTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: ListRenewalTasksQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseTaskStatus(query.status, false);
    const taskType = this.parseTaskType(query.taskType, false);
    const priority = this.parsePriority(query.priority, false);
    const customerDecision = this.parseCustomerDecision(query.customerDecision, false);
    const dueFrom = this.parseDate(query.dueFrom, 'dueFrom');
    const dueTo = this.parseDate(query.dueTo, 'dueTo');

    const where: Prisma.RenewalTaskWhereInput = {
      status: status ?? undefined,
      taskType: taskType ?? undefined,
      priority: priority ?? undefined,
      customerDecision: customerDecision ?? undefined,
      customerId: query.customerId || undefined,
      appleAccountId: query.appleAccountId || undefined,
      serviceId: query.serviceId || undefined,
      activationId: query.activationId || undefined,
      assignedToUserId: query.assignedToUserId || undefined,
      dueAt:
        dueFrom || dueTo
          ? {
              gte: dueFrom ?? undefined,
              lte: dueTo ?? undefined
            }
          : undefined,
      OR: keyword
        ? [
            { title: { contains: keyword, mode: 'insensitive' } },
            { requiredAction: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
            { resultNote: { contains: keyword, mode: 'insensitive' } },
            { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { service: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
            { order: { is: { orderNo: { contains: keyword, mode: 'insensitive' } } } },
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

    const [items, total] = await this.prisma.$transaction([
      this.prisma.renewalTask.findMany({
        where,
        include: renewalTaskInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.renewalTask.count({ where })
    ]);

    return {
      items: items.map((task) => this.toRenewalTaskResponse(task)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const task = await this.prisma.renewalTask.findUnique({
      where: { id },
      include: renewalTaskInclude
    });

    if (!task) {
      throw new NotFoundException('Renewal task not found');
    }

    return this.toRenewalTaskResponse(task);
  }

  async create(dto: CreateRenewalTaskDto, operator?: AuthenticatedUser) {
    const activationId = this.normalizeRequiredId(dto.activationId, 'activationId');
    const taskType = this.parseTaskType(dto.taskType, true);
    const priority = this.parsePriority(dto.priority, false) ?? 'medium';
    const customerDecision =
      this.parseCustomerDecision(dto.customerDecision, false) ?? 'not_contacted';
    const activation = await this.resolveActivationForGeneration(activationId);
    const plan = this.buildFallbackPlanItem(activation, taskType, {
      title: this.normalizeNullableString(dto.title),
      priority,
      customerDecision,
      requiredAction: this.normalizeNullableString(dto.requiredAction),
      dueAt: this.parseDate(dto.dueAt, 'dueAt'),
      remindAt: this.parseDate(dto.remindAt, 'remindAt')
    });

    const created = await this.prisma.renewalTask.create({
      data: {
        taskType,
        title: plan.title,
        status: plan.status,
        priority: plan.priority,
        customerId: activation.customerId,
        appleAccountId: activation.appleAccountId,
        serviceId: activation.serviceId,
        activationId: activation.id,
        orderId: activation.orderId,
        currentPlan: activation.currentPlan,
        targetPlan: activation.targetPlan,
        customerDecision: plan.customerDecision,
        requiredAction: plan.requiredAction,
        currentBalance: plan.currentBalance,
        expectedChargeAmount: plan.expectedChargeAmount,
        suggestedTopupAmount: plan.suggestedTopupAmount,
        expectedChargeTime: plan.expectedChargeTime,
        cancelDeadline: plan.cancelDeadline,
        remindAt: plan.remindAt,
        dueAt: plan.dueAt,
        assignedToUserId: this.normalizeNullableString(dto.assignedToUserId),
        note: this.normalizeNullableString(dto.note),
        createdByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.create',
      objectType: 'renewal_task',
      objectId: created.id,
      afterData: this.toAuditJson({
        taskType: created.taskType,
        activationId: created.activationId,
        title: created.title
      }),
      remark: `Created renewal task ${created.title}`
    });

    return this.get(created.id);
  }

  async update(id: string, dto: UpdateRenewalTaskDto, operator?: AuthenticatedUser) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.renewalTask.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Renewal task not found');
      }

      const status = this.parseTaskStatus(dto.status, false);
      const priority = this.parsePriority(dto.priority, false);
      const customerDecision = this.parseCustomerDecision(dto.customerDecision, false);
      const updateData: Prisma.RenewalTaskUpdateInput = {
        title: this.normalizeOptionalString(dto.title),
        status: status ?? undefined,
        priority: priority ?? undefined,
        customerDecision: customerDecision ?? undefined,
        requiredAction: this.normalizeOptionalNullableString(dto.requiredAction),
        assignedTo: this.buildNullableUserRelation(dto.assignedToUserId),
        note: this.normalizeOptionalNullableString(dto.note),
        resultNote: this.normalizeOptionalNullableString(dto.resultNote),
        dueAt: this.parseOptionalDate(dto.dueAt, 'dueAt'),
        remindAt: this.parseOptionalDate(dto.remindAt, 'remindAt'),
        evidenceAttachment: this.buildNullableAttachmentRelation(dto.evidenceAttachmentId),
        completedAt: status === 'completed' ? new Date() : undefined,
        completedBy:
          status === 'completed' && operator?.id ? { connect: { id: operator.id } } : undefined
      };

      const task = await tx.renewalTask.update({
        where: { id },
        data: updateData
      });

      if (customerDecision) {
        await this.applyCustomerDecision(tx, task.activationId, customerDecision);
        await this.ensureTasksForActivation(tx, task.activationId, operator);
      }

      return task;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.update',
      objectType: 'renewal_task',
      objectId: updated.id,
      afterData: this.toAuditJson({
        status: updated.status,
        priority: updated.priority,
        customerDecision: updated.customerDecision
      }),
      remark: `Updated renewal task ${updated.title}`
    });

    return this.get(updated.id);
  }

  async complete(id: string, dto: CompleteRenewalTaskDto, operator?: AuthenticatedUser) {
    const completed = await this.prisma.$transaction(async (tx) => {
      const current = await tx.renewalTask.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Renewal task not found');
      }

      const customerDecision = this.parseCustomerDecision(dto.customerDecision, false);
      const task = await tx.renewalTask.update({
        where: { id },
        data: {
          status: 'completed',
          customerDecision: customerDecision ?? undefined,
          resultNote: this.normalizeOptionalNullableString(dto.resultNote),
          evidenceAttachment: this.buildNullableAttachmentRelation(dto.evidenceAttachmentId),
          completedBy: operator?.id ? { connect: { id: operator.id } } : undefined,
          completedAt: new Date()
        }
      });

      if (customerDecision) {
        await this.applyCustomerDecision(tx, task.activationId, customerDecision);
        await this.ensureTasksForActivation(tx, task.activationId, operator);
      }

      if (task.taskType === 'cancel_subscription') {
        await tx.serviceActivation.update({
          where: { id: task.activationId },
          data: {
            autoRenewStatus: 'disabled',
            renewalDecision: 'no_renew',
            renewalNote: this.appendNote(current.resultNote, dto.resultNote)
          }
        });
      }

      return task;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.complete',
      objectType: 'renewal_task',
      objectId: completed.id,
      afterData: this.toAuditJson({
        taskType: completed.taskType,
        resultNote: completed.resultNote
      }),
      remark: `Completed renewal task ${completed.title}`
    });

    return this.get(completed.id);
  }

  async cancel(id: string, dto: CancelRenewalTaskDto, operator?: AuthenticatedUser) {
    const task = await this.prisma.renewalTask.update({
      where: { id },
      data: {
        status: 'cancelled',
        resultNote: this.normalizeOptionalNullableString(dto.resultNote),
        completedByUserId: operator?.id,
        completedAt: new Date()
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.cancel',
      objectType: 'renewal_task',
      objectId: task.id,
      remark: `Cancelled renewal task ${task.title}`
    });

    return this.get(task.id);
  }

  async postpone(id: string, dto: PostponeRenewalTaskDto, operator?: AuthenticatedUser) {
    const dueAt = this.parseDate(dto.dueAt, 'dueAt');
    if (!dueAt) {
      throw new BadRequestException('dueAt is required');
    }

    const task = await this.prisma.renewalTask.update({
      where: { id },
      data: {
        status: 'postponed',
        dueAt,
        remindAt: this.parseDate(dto.remindAt, 'remindAt') ?? dueAt,
        note: this.normalizeOptionalNullableString(dto.note)
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.postpone',
      objectType: 'renewal_task',
      objectId: task.id,
      afterData: this.toAuditJson({ dueAt: task.dueAt }),
      remark: `Postponed renewal task ${task.title}`
    });

    return this.get(task.id);
  }

  async generateDueTasks(dto: GenerateDueTasksDto, operator?: AuthenticatedUser) {
    const daysAhead = this.parseDaysAhead(dto.daysAhead);
    const now = this.parseDate(dto.now, 'now') ?? new Date();
    const rangeEnd = this.addDays(now, daysAhead);

    const activations = await this.prisma.serviceActivation.findMany({
      where: {
        status: 'active',
        expireTime: {
          not: null,
          lte: rangeEnd
        }
      },
      include: activationForGenerationInclude,
      orderBy: {
        expireTime: 'asc'
      },
      take: 200
    });

    let createdCount = 0;
    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const activation of activations) {
        const result = await this.ensureTasksForActivation(tx, activation.id, operator, now);
        createdCount += result.createdCount;
        updatedCount += result.updatedCount;
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_renewal_task',
      action: 'apple_renewal_task.generate_due_tasks',
      objectType: 'renewal_task',
      afterData: this.toAuditJson({
        scannedActivations: activations.length,
        createdCount,
        updatedCount,
        daysAhead
      }),
      remark: `Generated renewal tasks for ${activations.length} activations`
    });

    await this.notifyDueTaskEvents(activations, {
      now,
      rangeEnd,
      daysAhead,
      createdCount,
      updatedCount
    });

    return {
      scannedActivations: activations.length,
      createdCount,
      updatedCount,
      daysAhead,
      rangeEnd
    };
  }

  private async notifyDueTaskEvents(
    activations: ActivationForGeneration[],
    context: {
      now: Date;
      rangeEnd: Date;
      daysAhead: number;
      createdCount: number;
      updatedCount: number;
    }
  ) {
    if (!activations.length) {
      return;
    }

    const expiringWithin3Days = activations.filter((activation) => {
      const daysUntil = this.calculateDaysUntil(activation.expireTime, context.now);
      return daysUntil >= 0 && daysUntil <= 3;
    });
    const expiredUnhandled = activations.filter(
      (activation) => activation.expireTime && activation.expireTime <= context.now
    );
    const confirmedRenewal = activations.filter(
      (activation) =>
        activation.renewalDecision === 'renew' || activation.renewalDecision === 'change_plan'
    );
    const noRenewNotCancelled = activations.filter(
      (activation) => activation.renewalDecision === 'no_renew'
    );
    const lowBalance = activations.filter((activation) => {
      if (!activation.appleAccount) {
        return false;
      }

      const expectedChargeAmount = new PrismaNamespace.Decimal(
        activation.consumedValue.greaterThan(0)
          ? activation.consumedValue
          : activation.service.officialCostValue
      );

      return new PrismaNamespace.Decimal(activation.appleAccount.currentBalance).lessThan(
        expectedChargeAmount
      );
    });
    const enoughBalanceButNoRenew = noRenewNotCancelled.filter((activation) => {
      if (!activation.appleAccount) {
        return false;
      }

      const expectedChargeAmount = new PrismaNamespace.Decimal(
        activation.consumedValue.greaterThan(0)
          ? activation.consumedValue
          : activation.service.officialCostValue
      );

      return new PrismaNamespace.Decimal(
        activation.appleAccount.currentBalance
      ).greaterThanOrEqualTo(expectedChargeAmount);
    });

    await Promise.all([
      this.triggerRenewalNotification(
        'apple.service.expiring_3d',
        '业务到期前 3 天',
        expiringWithin3Days,
        context
      ),
      this.triggerRenewalNotification(
        'apple.service.expired_unhandled',
        '业务到期当天仍未处理',
        expiredUnhandled,
        context
      ),
      this.triggerRenewalNotification(
        'apple.payment.confirmed_unpaid',
        '客户确认续费但未收款',
        confirmedRenewal,
        context
      ),
      this.triggerRenewalNotification(
        'apple.no_renew_not_cancelled',
        '客户确认不续费但未取消订阅',
        noRenewNotCancelled,
        context
      ),
      this.triggerRenewalNotification(
        'apple.balance.low',
        'Apple ID 余额不足',
        lowBalance,
        context
      ),
      this.triggerRenewalNotification(
        'apple.balance.enough_has_no_renew_uncancelled',
        'Apple ID 余额足够但存在不续费业务未取消',
        enoughBalanceButNoRenew,
        context
      )
    ]);
  }

  private async triggerRenewalNotification(
    eventCode: string,
    title: string,
    activations: ActivationForGeneration[],
    context: {
      now: Date;
      rangeEnd: Date;
      daysAhead: number;
      createdCount: number;
      updatedCount: number;
    }
  ) {
    if (!activations.length) {
      return;
    }

    const examples = activations.slice(0, 5).map((activation) => ({
      activationId: activation.id,
      customerName: activation.customer.name,
      serviceName: activation.service.name,
      appleAccountId: activation.appleAccountId,
      expireTime: activation.expireTime?.toISOString() ?? null,
      renewalDecision: activation.renewalDecision
    }));

    await this.notificationsService.triggerEvent({
      eventCode,
      module: 'apple',
      title,
      content: `${title}：${activations.length} 个业务需要处理`,
      payload: {
        title,
        summary: `${title}：${activations.length} 个业务需要处理`,
        detail: `扫描范围 ${context.now.toISOString()} 至 ${context.rangeEnd.toISOString()}，新建任务 ${context.createdCount} 个，更新任务 ${context.updatedCount} 个。`,
        daysAhead: context.daysAhead,
        activationCount: activations.length,
        examples
      }
    });
  }

  buildTaskPlan(input: RenewalTaskPlanInput): RenewalTaskPlanItem[] {
    const now = input.now ?? new Date();
    const expectedChargeAmount = new PrismaNamespace.Decimal(input.expectedChargeAmount);
    const currentBalance = new PrismaNamespace.Decimal(input.currentBalance);
    const suggestedTopupAmount = PrismaNamespace.Decimal.max(
      new PrismaNamespace.Decimal(0),
      expectedChargeAmount.minus(currentBalance)
    ).toDecimalPlaces(4);
    const customerDecision = this.mapRenewalDecisionToCustomerDecision(input.renewalDecision);
    const base = {
      priority: this.calculatePriority(input.expireTime, now),
      customerDecision,
      currentBalance: currentBalance.toDecimalPlaces(4),
      expectedChargeAmount: expectedChargeAmount.toDecimalPlaces(4),
      suggestedTopupAmount,
      expectedChargeTime: input.expireTime,
      cancelDeadline: null,
      remindAt: now
    };

    if (input.renewalDecision === 'no_renew') {
      const dueAt = this.safeDateBefore(input.expireTime, 1, now);
      return [
        {
          ...base,
          taskType: 'cancel_subscription',
          title: `取消订阅：${input.customerName} · ${input.serviceName}`,
          status: 'pending',
          requiredAction: '客户确认不续费，需在到期前取消订阅，避免自动扣费',
          cancelDeadline: dueAt,
          dueAt
        }
      ];
    }

    if (input.renewalDecision === 'renew' || input.renewalDecision === 'change_plan') {
      const paymentDueAt = this.safeDateBefore(input.expireTime, 2, now);
      const topupDueAt = this.safeDateBefore(input.expireTime, 1, now);
      const resultCheckDueAt = this.safeDateAfter(input.expireTime, 1, this.addDays(now, 1));
      const plan: RenewalTaskPlanItem[] = [
        {
          ...base,
          taskType: 'confirm_payment',
          title: `确认收款：${input.customerName} · ${input.serviceName}`,
          status: 'waiting_payment',
          requiredAction: '客户确认续费后，先确认是否已收款',
          dueAt: paymentDueAt
        },
        {
          ...base,
          taskType: 'check_balance',
          title: `检查余额：${input.serviceName} · ${input.currency}`,
          status: 'pending',
          requiredAction: '检查 Apple ID 余额是否足够覆盖本次续费扣费',
          dueAt: topupDueAt
        }
      ];

      if (input.renewalDecision === 'change_plan') {
        plan.push({
          ...base,
          taskType: 'change_plan',
          title: `修改套餐：${input.customerName} · ${input.serviceName}`,
          status: 'pending',
          requiredAction: '客户要求更换套餐，续费前需确认目标套餐',
          dueAt: paymentDueAt
        });
      }

      if (suggestedTopupAmount.greaterThan(0)) {
        plan.push({
          ...base,
          taskType: 'topup_apple_balance',
          title: `待充值续费：${input.serviceName} 需补 ${suggestedTopupAmount.toString()} ${input.currency}`,
          status: 'pending',
          requiredAction: 'Apple ID 余额不足，需先充值后再等待自动续费',
          dueAt: topupDueAt
        });
      } else {
        plan.push({
          ...base,
          taskType: 'wait_auto_renewal',
          title: `等待自动续费：${input.customerName} · ${input.serviceName}`,
          status: 'waiting_auto_renewal',
          requiredAction: '余额足够，等待 Apple 自动扣费并在扣费后检查结果',
          dueAt: input.expireTime ?? this.addDays(now, 1)
        });
      }

      plan.push({
        ...base,
        taskType: 'check_renewal_result',
        title: `检查续费结果：${input.customerName} · ${input.serviceName}`,
        status: 'pending',
        requiredAction: '自动扣费后检查服务是否成功续期',
        dueAt: resultCheckDueAt
      });

      return plan;
    }

    const contactDueAt = this.safeDateBefore(input.expireTime, 3, now);
    const plan: RenewalTaskPlanItem[] = [
      {
        ...base,
        taskType: 'contact_customer',
        title: `联系客户续费：${input.customerName} · ${input.serviceName}`,
        status: 'pending',
        requiredAction: '到期前联系客户确认是否续费、是否换套餐',
        dueAt: contactDueAt
      }
    ];

    if (this.calculateDaysUntil(input.expireTime, now) <= 1) {
      plan.push({
        ...base,
        taskType: 'remind_customer_reply',
        title: `催客户回复：${input.customerName} · ${input.serviceName}`,
        status: 'waiting_customer',
        requiredAction: '临近到期仍未确认续费决定，需再次催回复',
        dueAt: input.expireTime ?? this.addDays(now, 1)
      });
    }

    if (input.autoRenewStatus === 'enabled') {
      plan.push({
        ...base,
        taskType: 'handle_abnormal',
        title: `确认自动续费风险：${input.customerName} · ${input.serviceName}`,
        status: 'waiting_manual_verify',
        requiredAction: '客户未确认前自动续费仍开启，需人工确认是否存在误扣费风险',
        dueAt: input.expireTime ?? this.addDays(now, 1)
      });
    }

    return plan;
  }

  calculateDaysUntil(date: Date | null, now = new Date()) {
    if (!date) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  }

  private async ensureTasksForActivation(
    tx: Prisma.TransactionClient,
    activationId: string,
    operator?: AuthenticatedUser,
    now = new Date()
  ) {
    const activation = await tx.serviceActivation.findUnique({
      where: { id: activationId },
      include: activationForGenerationInclude
    });

    if (!activation || activation.status !== 'active') {
      return { createdCount: 0, updatedCount: 0 };
    }

    const plan = this.buildTaskPlan(this.toPlanInput(activation, now));
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of plan) {
      const existing = await tx.renewalTask.findFirst({
        where: {
          activationId: activation.id,
          taskType: item.taskType,
          status: {
            in: unfinishedTaskStatuses
          }
        }
      });

      if (existing) {
        await tx.renewalTask.update({
          where: { id: existing.id },
          data: {
            title: item.title,
            priority: item.priority,
            customerDecision: item.customerDecision,
            requiredAction: item.requiredAction,
            currentBalance: item.currentBalance,
            expectedChargeAmount: item.expectedChargeAmount,
            suggestedTopupAmount: item.suggestedTopupAmount,
            expectedChargeTime: item.expectedChargeTime,
            cancelDeadline: item.cancelDeadline,
            remindAt: item.remindAt,
            dueAt: item.dueAt
          }
        });
        updatedCount += 1;
      } else {
        await tx.renewalTask.create({
          data: {
            taskType: item.taskType,
            title: item.title,
            status: item.status,
            priority: item.priority,
            customerId: activation.customerId,
            appleAccountId: activation.appleAccountId,
            serviceId: activation.serviceId,
            activationId: activation.id,
            orderId: activation.orderId,
            currentPlan: activation.currentPlan,
            targetPlan: activation.targetPlan,
            customerDecision: item.customerDecision,
            requiredAction: item.requiredAction,
            currentBalance: item.currentBalance,
            expectedChargeAmount: item.expectedChargeAmount,
            suggestedTopupAmount: item.suggestedTopupAmount,
            expectedChargeTime: item.expectedChargeTime,
            cancelDeadline: item.cancelDeadline,
            remindAt: item.remindAt,
            dueAt: item.dueAt,
            createdByUserId: operator?.id
          }
        });
        createdCount += 1;
      }
    }

    return { createdCount, updatedCount };
  }

  private async applyCustomerDecision(
    tx: Prisma.TransactionClient,
    activationId: string,
    customerDecision: RenewalTaskCustomerDecision
  ) {
    const renewalDecision = this.mapCustomerDecisionToRenewalDecision(customerDecision);
    if (!renewalDecision) {
      return;
    }

    await tx.serviceActivation.update({
      where: { id: activationId },
      data: {
        renewalDecision,
        renewalNote: `续费任务更新：${this.getCustomerDecisionLabel(customerDecision)}`
      }
    });
  }

  private async resolveActivationForGeneration(id: string) {
    const activation = await this.prisma.serviceActivation.findUnique({
      where: { id },
      include: activationForGenerationInclude
    });

    if (!activation || activation.status !== 'active') {
      throw new BadRequestException('Active service activation not found');
    }

    return activation;
  }

  private buildFallbackPlanItem(
    activation: ActivationForGeneration,
    taskType: RenewalTaskType,
    overrides: {
      title: string | null;
      priority: RenewalTaskPriority;
      customerDecision: RenewalTaskCustomerDecision;
      requiredAction: string | null;
      dueAt: Date | null;
      remindAt: Date | null;
    }
  ): RenewalTaskPlanItem {
    const generated = this.buildTaskPlan(this.toPlanInput(activation, new Date()));
    const matched = generated.find((item) => item.taskType === taskType) ?? generated[0];
    if (!matched) {
      throw new BadRequestException('Unable to build renewal task');
    }

    return {
      ...matched,
      taskType,
      title: overrides.title ?? matched.title,
      priority: overrides.priority,
      customerDecision: overrides.customerDecision,
      requiredAction: overrides.requiredAction ?? matched.requiredAction,
      dueAt: overrides.dueAt ?? matched.dueAt,
      remindAt: overrides.remindAt ?? matched.remindAt
    };
  }

  private toPlanInput(activation: ActivationForGeneration, now: Date): RenewalTaskPlanInput {
    const expectedChargeAmount = new PrismaNamespace.Decimal(
      activation.consumedValue.greaterThan(0)
        ? activation.consumedValue
        : activation.service.officialCostValue
    );
    const currentBalance = new PrismaNamespace.Decimal(
      activation.appleAccount?.currentBalance ?? 0
    );

    return {
      renewalDecision: activation.renewalDecision,
      autoRenewStatus: activation.autoRenewStatus,
      expireTime: activation.expireTime,
      currentPlan: activation.currentPlan,
      targetPlan: activation.targetPlan,
      serviceName: activation.service.name,
      customerName: activation.customer.name,
      expectedChargeAmount,
      currentBalance,
      currency: activation.currency,
      now
    };
  }

  private mapRenewalDecisionToCustomerDecision(
    value: RenewalDecision
  ): RenewalTaskCustomerDecision {
    if (value === 'renew') {
      return 'confirmed_renewal';
    }

    if (value === 'no_renew') {
      return 'confirmed_no_renewal';
    }

    if (value === 'change_plan') {
      return 'change_plan';
    }

    return 'not_contacted';
  }

  private mapCustomerDecisionToRenewalDecision(
    value: RenewalTaskCustomerDecision
  ): RenewalDecision | null {
    if (value === 'confirmed_renewal' || value === 'paid') {
      return 'renew';
    }

    if (value === 'confirmed_no_renewal' || value === 'cancelled') {
      return 'no_renew';
    }

    if (value === 'change_plan') {
      return 'change_plan';
    }

    if (
      value === 'not_contacted' ||
      value === 'contacted_waiting_reply' ||
      value === 'considering' ||
      value === 'unpaid'
    ) {
      return 'unconfirmed';
    }

    return null;
  }

  private calculatePriority(expireTime: Date | null, now: Date): RenewalTaskPriority {
    const daysUntil = this.calculateDaysUntil(expireTime, now);
    if (daysUntil <= 1) {
      return 'urgent';
    }

    if (daysUntil <= 3) {
      return 'high';
    }

    if (daysUntil <= 7) {
      return 'medium';
    }

    return 'low';
  }

  private safeDateBefore(date: Date | null, days: number, fallback: Date) {
    if (!date) {
      return fallback;
    }

    const result = this.addDays(date, -days);
    return result.getTime() < fallback.getTime() ? fallback : result;
  }

  private safeDateAfter(date: Date | null, days: number, fallback: Date) {
    return date ? this.addDays(date, days) : fallback;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private parseDaysAhead(value: string | number | undefined) {
    if (value === undefined || value === '') {
      return 3;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 90) {
      throw new BadRequestException('daysAhead must be an integer between 0 and 90');
    }

    return parsed;
  }

  private buildOrderBy(query: ListRenewalTasksQuery): Prisma.RenewalTaskOrderByWithRelationInput[] {
    const sortField = query.sortBy ? RENEWAL_TASK_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }];
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

  private parseTaskType(value: unknown, strict: true): RenewalTaskType;
  private parseTaskType(value: unknown, strict: false): RenewalTaskType | undefined;
  private parseTaskType(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      if (strict) {
        throw new BadRequestException('taskType is required');
      }

      return undefined;
    }

    if (
      value === 'contact_customer' ||
      value === 'remind_customer_reply' ||
      value === 'confirm_payment' ||
      value === 'topup_apple_balance' ||
      value === 'check_balance' ||
      value === 'cancel_subscription' ||
      value === 'change_plan' ||
      value === 'wait_auto_renewal' ||
      value === 'check_renewal_result' ||
      value === 'notify_customer' ||
      value === 'handle_abnormal' ||
      value === 'after_sale'
    ) {
      return value satisfies RenewalTaskType;
    }

    if (strict) {
      throw new BadRequestException('Invalid renewal task type');
    }

    return undefined;
  }

  private parseTaskStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'pending' ||
      value === 'processing' ||
      value === 'waiting_customer' ||
      value === 'waiting_payment' ||
      value === 'waiting_auto_renewal' ||
      value === 'waiting_manual_verify' ||
      value === 'completed' ||
      value === 'cancelled' ||
      value === 'failed' ||
      value === 'abnormal' ||
      value === 'postponed'
    ) {
      return value satisfies RenewalTaskStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid renewal task status');
    }

    return undefined;
  }

  private parsePriority(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') {
      return value satisfies RenewalTaskPriority;
    }

    if (strict) {
      throw new BadRequestException('Invalid renewal task priority');
    }

    return undefined;
  }

  private parseCustomerDecision(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      value === 'not_contacted' ||
      value === 'contacted_waiting_reply' ||
      value === 'confirmed_renewal' ||
      value === 'confirmed_no_renewal' ||
      value === 'change_plan' ||
      value === 'considering' ||
      value === 'paid' ||
      value === 'unpaid' ||
      value === 'cancelled' ||
      value === 'renewed_success' ||
      value === 'abnormal'
    ) {
      return value satisfies RenewalTaskCustomerDecision;
    }

    if (strict) {
      throw new BadRequestException('Invalid renewal customer decision');
    }

    return undefined;
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

  private parseOptionalDate(value: string | null | undefined, field: string) {
    if (value === undefined) {
      return undefined;
    }

    return this.parseDate(value, field);
  }

  private normalizeRequiredId(value: string | null | undefined, field: string) {
    const normalized = this.normalizeNullableString(value);
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }

    return normalized;
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeOptionalString(value: string | undefined) {
    if (value === undefined) {
      return undefined;
    }

    return value.trim();
  }

  private normalizeOptionalNullableString(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    return this.normalizeNullableString(value);
  }

  private buildNullableUserRelation(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    const id = this.normalizeNullableString(value);
    return id ? { connect: { id } } : { disconnect: true };
  }

  private buildNullableAttachmentRelation(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    const id = this.normalizeNullableString(value);
    return id ? { connect: { id } } : { disconnect: true };
  }

  private getCustomerDecisionLabel(value: RenewalTaskCustomerDecision) {
    const labels: Record<RenewalTaskCustomerDecision, string> = {
      not_contacted: '未询问',
      contacted_waiting_reply: '已询问待回复',
      confirmed_renewal: '客户确认续费',
      confirmed_no_renewal: '客户确认不续费',
      change_plan: '客户要改套餐',
      considering: '客户犹豫中',
      paid: '已收款',
      unpaid: '未收款',
      cancelled: '已取消',
      renewed_success: '已续费成功',
      abnormal: '异常处理'
    };
    return labels[value];
  }

  private appendNote(before: string | null, next: string | null | undefined) {
    const normalizedNext = this.normalizeNullableString(next);
    if (!normalizedNext) {
      return before;
    }

    return before ? `${before}\n${normalizedNext}` : normalizedNext;
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

  private toRenewalTaskResponse(
    task: Prisma.RenewalTaskGetPayload<{ include: typeof renewalTaskInclude }>
  ) {
    return {
      id: task.id,
      taskType: task.taskType,
      title: task.title,
      status: task.status,
      priority: task.priority,
      customerId: task.customerId,
      customer: task.customer,
      appleAccountId: task.appleAccountId,
      appleAccount: task.appleAccount
        ? {
            id: task.appleAccount.id,
            appleIdMasked: this.maskAppleId(task.appleAccount.appleId),
            region: task.appleAccount.region,
            currency: task.appleAccount.currency,
            currentBalance: task.appleAccount.currentBalance.toString(),
            averageCost: task.appleAccount.averageCost.toString()
          }
        : null,
      serviceId: task.serviceId,
      service: {
        ...task.service,
        officialCostValue: task.service.officialCostValue.toString()
      },
      activationId: task.activationId,
      activation: {
        ...task.activation,
        daysUntilExpire: task.activation.expireTime
          ? this.calculateDaysUntil(task.activation.expireTime, new Date())
          : null
      },
      orderId: task.orderId,
      order: task.order,
      currentPlan: task.currentPlan,
      targetPlan: task.targetPlan,
      customerDecision: task.customerDecision,
      requiredAction: task.requiredAction,
      currentBalance: task.currentBalance.toString(),
      expectedChargeAmount: task.expectedChargeAmount.toString(),
      suggestedTopupAmount: task.suggestedTopupAmount.toString(),
      expectedChargeTime: task.expectedChargeTime,
      cancelDeadline: task.cancelDeadline,
      remindAt: task.remindAt,
      dueAt: task.dueAt,
      assignedToUserId: task.assignedToUserId,
      assignedTo: task.assignedTo,
      note: task.note,
      resultNote: task.resultNote,
      evidenceAttachmentId: task.evidenceAttachmentId,
      evidenceAttachment: task.evidenceAttachment
        ? {
            ...task.evidenceAttachment,
            sizeBytes: task.evidenceAttachment.sizeBytes.toString()
          }
        : null,
      completedByUserId: task.completedByUserId,
      completedBy: task.completedBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt
    };
  }
}
