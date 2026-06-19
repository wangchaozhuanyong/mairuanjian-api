import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppleAccountStatus,
  AppleAccountStatusCheck,
  AppleAccountStatusCheckType,
  Prisma
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateAppleAccountStatusCheckDto } from './dto/create-apple-account-status-check.dto';

type StatusCheckWithRelations = AppleAccountStatusCheck & {
  operator?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  evidenceAttachment?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
  } | null;
};

@Injectable()
export class AppleAccountStatusChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(accountId: string, query: PaginationQuery) {
    await this.assertAccountExists(accountId);
    const pagination = getPagination(query);
    const where: Prisma.AppleAccountStatusCheckWhereInput = { appleAccountId: accountId };
    const include = this.getInclude();
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleAccountStatusCheck.findMany({
        where,
        include,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.appleAccountStatusCheck.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async create(
    accountId: string,
    dto: CreateAppleAccountStatusCheckDto,
    operator?: AuthenticatedUser
  ) {
    const checkType = this.parseCheckType(dto.checkType ?? 'manual');
    const resultStatus = this.parseResultStatus(dto.resultStatus);
    const balanceSnapshot = this.normalizeNullableDecimal(dto.balanceSnapshot, 'balanceSnapshot');
    const remark = this.normalizeNullableString(dto.remark);
    const evidenceAttachmentId = this.normalizeNullableString(dto.evidenceAttachmentId);
    const include = this.getInclude();

    const statusCheck = await this.prisma.$transaction(async (tx) => {
      const account = await tx.appleAccount.findFirst({
        where: { id: accountId, deletedAt: null },
        select: { id: true }
      });

      if (!account) {
        throw new NotFoundException('Apple account not found');
      }

      const createdStatusCheck = await tx.appleAccountStatusCheck.create({
        data: {
          appleAccountId: account.id,
          checkType,
          resultStatus,
          balanceSnapshot,
          remark,
          evidenceAttachmentId,
          operatorId: operator?.id
        },
        include
      });

      await tx.appleAccount.update({
        where: { id: account.id },
        data: {
          status: resultStatus,
          updatedByUserId: operator?.id
        }
      });

      return createdStatusCheck;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_account',
      action: 'apple_account.status_check.create',
      objectType: 'apple_account_status_check',
      objectId: statusCheck.id,
      afterData: this.toAuditJson({
        appleAccountId: accountId,
        checkType,
        resultStatus,
        balanceSnapshot: balanceSnapshot?.toString() ?? null,
        remark,
        evidenceAttachmentId
      }),
      remark: `Created Apple ID status check ${statusCheck.id}`
    });

    if (resultStatus !== 'normal') {
      await this.notifyStatusAbnormal(statusCheck, resultStatus);
    }

    return this.toResponse(statusCheck);
  }

  private async notifyStatusAbnormal(
    statusCheck: StatusCheckWithRelations,
    resultStatus: AppleAccountStatus
  ) {
    await this.notificationsService.triggerEvent({
      eventCode: 'apple.account.status_abnormal',
      module: 'apple',
      level: 'error',
      title: 'Apple ID 状态异常',
      content: `Apple ID 状态检测结果为 ${resultStatus}`,
      payload: {
        title: 'Apple ID 状态异常',
        summary: `Apple ID 状态检测结果为 ${resultStatus}`,
        detail: statusCheck.remark ?? '请进入 Apple ID 详情核对账号状态和处理方式。',
        appleAccountId: statusCheck.appleAccountId,
        statusCheckId: statusCheck.id,
        resultStatus,
        checkType: statusCheck.checkType
      }
    });
  }

  private async assertAccountExists(accountId: string) {
    const account = await this.prisma.appleAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true }
    });

    if (!account) {
      throw new NotFoundException('Apple account not found');
    }
  }

  private parseCheckType(value: unknown): AppleAccountStatusCheckType {
    if (value === 'manual' || value === 'automation') {
      return value;
    }

    throw new BadRequestException('checkType is invalid');
  }

  private parseResultStatus(value: unknown): AppleAccountStatus {
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

    throw new BadRequestException('resultStatus is invalid');
  }

  private normalizeNullableDecimal(
    value: PrismaNamespace.Decimal.Value | null | undefined,
    field: string
  ) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const normalized = String(value).trim();
    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return new PrismaNamespace.Decimal(normalized).toDecimalPlaces(4);
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private getInclude() {
    return {
      operator: {
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
    } satisfies Prisma.AppleAccountStatusCheckInclude;
  }

  private toResponse(statusCheck: StatusCheckWithRelations) {
    return {
      id: statusCheck.id,
      appleAccountId: statusCheck.appleAccountId,
      checkType: statusCheck.checkType,
      resultStatus: statusCheck.resultStatus,
      balanceSnapshot: statusCheck.balanceSnapshot?.toString() ?? null,
      remark: statusCheck.remark,
      evidenceAttachmentId: statusCheck.evidenceAttachmentId,
      evidenceAttachment: statusCheck.evidenceAttachment
        ? {
            id: statusCheck.evidenceAttachment.id,
            originalName: statusCheck.evidenceAttachment.originalName,
            mimeType: statusCheck.evidenceAttachment.mimeType,
            sizeBytes: statusCheck.evidenceAttachment.sizeBytes.toString(),
            createdAt: statusCheck.evidenceAttachment.createdAt
          }
        : null,
      operator: statusCheck.operator
        ? {
            id: statusCheck.operator.id,
            username: statusCheck.operator.username,
            displayName: statusCheck.operator.displayName
          }
        : null,
      createdAt: statusCheck.createdAt
    };
  }
}
