import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AppleAccount,
  AppleBalanceAdjustment,
  AppleBalanceAdjustmentCostMethod,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  Prisma
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAppleBalanceAdjustmentDto } from './dto/create-apple-balance-adjustment.dto';
import type { CreateAppleBalanceConsumptionDto } from './dto/create-apple-balance-consumption.dto';
import type { CreateAppleBalanceTopupDto } from './dto/create-apple-balance-topup.dto';
import type { RevealGiftCardCodeDto } from './dto/reveal-gift-card-code.dto';

interface TopupSnapshot {
  balanceBefore: PrismaNamespace.Decimal;
  balanceAfter: PrismaNamespace.Decimal;
  costBefore: PrismaNamespace.Decimal;
  costAfter: PrismaNamespace.Decimal;
  avgCostBefore: PrismaNamespace.Decimal;
  avgCostAfter: PrismaNamespace.Decimal;
}

interface ConsumptionSnapshot {
  balanceBefore: PrismaNamespace.Decimal;
  balanceAfter: PrismaNamespace.Decimal;
  costBefore: PrismaNamespace.Decimal;
  costAfter: PrismaNamespace.Decimal;
  avgUnitCost: PrismaNamespace.Decimal;
  costAmount: PrismaNamespace.Decimal;
  avgCostAfter: PrismaNamespace.Decimal;
}

interface AdjustmentSnapshot {
  oldBalance: PrismaNamespace.Decimal;
  newBalance: PrismaNamespace.Decimal;
  difference: PrismaNamespace.Decimal;
  oldCostRmb: PrismaNamespace.Decimal;
  newCostRmb: PrismaNamespace.Decimal;
  costRmbChange: PrismaNamespace.Decimal;
  avgCostAfter: PrismaNamespace.Decimal;
}

interface AuditRequestMeta {
  ip?: string;
  userAgent?: string;
}

type BalanceAdjustmentWithRelations = AppleBalanceAdjustment & {
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
export class AppleBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async listTopups(accountId: string, query: PaginationQuery) {
    await this.assertAccountExists(accountId);
    const pagination = getPagination(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleBalanceTopup.findMany({
        where: { appleAccountId: accountId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.appleBalanceTopup.count({
        where: { appleAccountId: accountId }
      })
    ]);

    return {
      items: items.map((item) => this.toTopupResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createTopup(
    accountId: string,
    dto: CreateAppleBalanceTopupDto,
    operator?: AuthenticatedUser
  ) {
    const faceValue = this.normalizePositiveDecimal(dto.faceValue, 'faceValue');
    const costAmount = this.normalizeNonNegativeDecimal(dto.costAmount, 'costAmount');
    const giftCardCode = this.normalizeNullableString(dto.giftCardCode);
    const giftCardCodeHash = this.fieldEncryptionService.hash(giftCardCode);

    if (giftCardCodeHash) {
      const existingTopup = await this.prisma.appleBalanceTopup.findUnique({
        where: { giftCardCodeHash },
        select: { id: true }
      });

      if (existingTopup) {
        throw new ConflictException('Gift card code already used');
      }
    }

    const topup = await this.prisma.$transaction(async (tx) => {
      const account = await tx.appleAccount.findFirst({
        where: { id: accountId, deletedAt: null }
      });

      if (!account) {
        throw new NotFoundException('Apple account not found');
      }

      const snapshot = this.calculateTopupSnapshot(account, faceValue, costAmount);

      const createdTopup = await tx.appleBalanceTopup.create({
        data: {
          appleAccountId: account.id,
          faceValue,
          costAmount,
          balanceBefore: snapshot.balanceBefore,
          balanceAfter: snapshot.balanceAfter,
          costBefore: snapshot.costBefore,
          costAfter: snapshot.costAfter,
          avgCostBefore: snapshot.avgCostBefore,
          avgCostAfter: snapshot.avgCostAfter,
          giftCardCodeEncrypted: this.fieldEncryptionService.encrypt(giftCardCode),
          giftCardCodeHash,
          giftCardCodeTail: this.getTail(giftCardCode),
          remark: this.normalizeNullableString(dto.remark),
          createdByUserId: operator?.id
        }
      });

      await this.updateAccountBalanceSnapshot(tx, account, {
        currentBalance: snapshot.balanceAfter,
        balanceCostAmount: snapshot.costAfter,
        averageCost: snapshot.avgCostAfter,
        operatorId: operator?.id
      });

      return createdTopup;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_balance',
      action: 'apple_balance.topup',
      objectType: 'apple_balance_topup',
      objectId: topup.id,
      afterData: this.toAuditJson({
        appleAccountId: accountId,
        faceValue: faceValue.toString(),
        costAmount: costAmount.toString(),
        hasGiftCardCode: Boolean(giftCardCode),
        giftCardCodeTail: this.getTail(giftCardCode),
        remark: dto.remark ?? null
      }),
      remark: `Created Apple ID topup ${topup.id}`
    });

    return this.toTopupResponse(topup);
  }

  async listConsumptions(accountId: string, query: PaginationQuery) {
    await this.assertAccountExists(accountId);
    const pagination = getPagination(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleBalanceConsumption.findMany({
        where: { appleAccountId: accountId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.appleBalanceConsumption.count({
        where: { appleAccountId: accountId }
      })
    ]);

    return {
      items: items.map((item) => this.toConsumptionResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createConsumption(
    accountId: string,
    dto: CreateAppleBalanceConsumptionDto,
    operator?: AuthenticatedUser
  ) {
    const amount = this.normalizePositiveDecimal(dto.amount, 'amount');
    const consumption = await this.prisma.$transaction(async (tx) => {
      const account = await tx.appleAccount.findFirst({
        where: { id: accountId, deletedAt: null }
      });

      if (!account) {
        throw new NotFoundException('Apple account not found');
      }

      const snapshot = this.calculateConsumptionSnapshot(account, amount);

      const createdConsumption = await tx.appleBalanceConsumption.create({
        data: {
          appleAccountId: account.id,
          amount,
          costAmount: snapshot.costAmount,
          avgUnitCost: snapshot.avgUnitCost,
          balanceBefore: snapshot.balanceBefore,
          balanceAfter: snapshot.balanceAfter,
          costBefore: snapshot.costBefore,
          costAfter: snapshot.costAfter,
          reason: this.normalizeNullableString(dto.reason),
          relatedObjectType: this.normalizeNullableString(dto.relatedObjectType),
          relatedObjectId: this.normalizeNullableString(dto.relatedObjectId),
          remark: this.normalizeNullableString(dto.remark),
          createdByUserId: operator?.id
        }
      });

      await this.updateAccountBalanceSnapshot(tx, account, {
        currentBalance: snapshot.balanceAfter,
        balanceCostAmount: snapshot.costAfter,
        averageCost: snapshot.avgCostAfter,
        operatorId: operator?.id
      });

      return createdConsumption;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_balance',
      action: 'apple_balance.consume',
      objectType: 'apple_balance_consumption',
      objectId: consumption.id,
      afterData: this.toAuditJson({
        appleAccountId: accountId,
        amount: amount.toString(),
        costAmount: consumption.costAmount.toString(),
        reason: dto.reason ?? null,
        relatedObjectType: dto.relatedObjectType ?? null,
        relatedObjectId: dto.relatedObjectId ?? null,
        remark: dto.remark ?? null
      }),
      remark: `Created Apple ID consumption ${consumption.id}`
    });

    return this.toConsumptionResponse(consumption);
  }

  async listBalanceAdjustments(accountId: string, query: PaginationQuery) {
    await this.assertAccountExists(accountId);
    const pagination = getPagination(query);
    const where: Prisma.AppleBalanceAdjustmentWhereInput = { appleAccountId: accountId };
    const include = this.getAdjustmentInclude();
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appleBalanceAdjustment.findMany({
        where,
        include,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.appleBalanceAdjustment.count({ where })
    ]);

    return {
      items: items.map((item) => this.toAdjustmentResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async createBalanceAdjustment(
    accountId: string,
    dto: CreateAppleBalanceAdjustmentDto,
    operator?: AuthenticatedUser
  ) {
    const costAdjustMethod = this.parseCostAdjustMethod(dto.costAdjustMethod);
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const evidenceAttachmentId = this.normalizeNullableString(dto.evidenceAttachmentId);
    const include = this.getAdjustmentInclude();

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const account = await tx.appleAccount.findFirst({
        where: { id: accountId, deletedAt: null }
      });

      if (!account) {
        throw new NotFoundException('Apple account not found');
      }

      const snapshot = this.calculateAdjustmentSnapshot(
        account,
        dto.newBalance,
        costAdjustMethod,
        dto.newCostRmb
      );

      const createdAdjustment = await tx.appleBalanceAdjustment.create({
        data: {
          appleAccountId: account.id,
          oldBalance: snapshot.oldBalance,
          newBalance: snapshot.newBalance,
          difference: snapshot.difference,
          oldCostRmb: snapshot.oldCostRmb,
          newCostRmb: snapshot.newCostRmb,
          costAdjustMethod,
          costRmbChange: snapshot.costRmbChange,
          reason,
          evidenceAttachmentId,
          operatorId: operator?.id
        },
        include
      });

      await this.updateAccountBalanceSnapshot(tx, account, {
        currentBalance: snapshot.newBalance,
        balanceCostAmount: snapshot.newCostRmb,
        averageCost: snapshot.avgCostAfter,
        operatorId: operator?.id
      });

      return createdAdjustment;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_balance',
      action: 'apple_balance.adjust',
      objectType: 'apple_balance_adjustment',
      objectId: adjustment.id,
      afterData: this.toAuditJson({
        appleAccountId: accountId,
        oldBalance: adjustment.oldBalance.toString(),
        newBalance: adjustment.newBalance.toString(),
        difference: adjustment.difference.toString(),
        oldCostRmb: adjustment.oldCostRmb.toString(),
        newCostRmb: adjustment.newCostRmb.toString(),
        costAdjustMethod: adjustment.costAdjustMethod,
        costRmbChange: adjustment.costRmbChange.toString(),
        reason,
        evidenceAttachmentId
      }),
      remark: `Adjusted Apple ID balance ${adjustment.id}`
    });

    return this.toAdjustmentResponse(adjustment);
  }

  async revealGiftCardCode(
    topupId: string,
    dto: RevealGiftCardCodeDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const topup = await this.prisma.appleBalanceTopup.findUnique({
      where: { id: topupId },
      select: {
        id: true,
        appleAccountId: true,
        giftCardCodeEncrypted: true,
        giftCardCodeTail: true
      }
    });

    if (!topup) {
      throw new NotFoundException('Apple topup not found');
    }

    if (!topup.giftCardCodeEncrypted) {
      throw new NotFoundException('Gift card code not found');
    }

    const giftCardCode = this.fieldEncryptionService.decrypt(topup.giftCardCodeEncrypted);

    if (!giftCardCode) {
      throw new NotFoundException('Gift card code not found');
    }

    await this.prisma.sensitiveAccessLog.create({
      data: {
        userId: operator?.id,
        module: 'apple_balance',
        fieldName: 'giftCardCode',
        objectType: 'apple_balance_topup',
        objectId: topup.id,
        accessReason: reason,
        approved: true,
        ip: requestMeta?.ip,
        userAgent: requestMeta?.userAgent
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'apple_balance',
      action: 'apple_topup.gift_card_code.reveal',
      objectType: 'apple_balance_topup',
      objectId: topup.id,
      afterData: this.toAuditJson({
        appleAccountId: topup.appleAccountId,
        field: 'giftCardCode',
        giftCardCodeTail: topup.giftCardCodeTail,
        reason
      }),
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
      remark: `Revealed Apple ID topup gift card code ${topup.id}`
    });

    return {
      topupId: topup.id,
      appleAccountId: topup.appleAccountId,
      giftCardCode,
      giftCardCodeTail: topup.giftCardCodeTail,
      revealedAt: new Date()
    };
  }

  calculateTopupSnapshot(
    account: Pick<AppleAccount, 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    faceValueInput: PrismaNamespace.Decimal.Value,
    costAmountInput: PrismaNamespace.Decimal.Value
  ): TopupSnapshot {
    const faceValue = new PrismaNamespace.Decimal(faceValueInput);
    const costAmount = new PrismaNamespace.Decimal(costAmountInput);

    if (faceValue.lessThanOrEqualTo(0)) {
      throw new BadRequestException('faceValue must be greater than zero');
    }

    if (costAmount.lessThan(0)) {
      throw new BadRequestException('costAmount must be non-negative');
    }

    const balanceBefore = new PrismaNamespace.Decimal(account.currentBalance);
    const costBefore = new PrismaNamespace.Decimal(account.balanceCostAmount);
    const balanceAfter = balanceBefore.plus(faceValue).toDecimalPlaces(4);
    const costAfter = costBefore.plus(costAmount).toDecimalPlaces(4);

    return {
      balanceBefore,
      balanceAfter,
      costBefore,
      costAfter,
      avgCostBefore: new PrismaNamespace.Decimal(account.averageCost),
      avgCostAfter: this.calculateAverageCost(balanceAfter, costAfter)
    };
  }

  calculateConsumptionSnapshot(
    account: Pick<AppleAccount, 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    amountInput: PrismaNamespace.Decimal.Value
  ): ConsumptionSnapshot {
    const amount = new PrismaNamespace.Decimal(amountInput);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('amount must be greater than zero');
    }

    const balanceBefore = new PrismaNamespace.Decimal(account.currentBalance);
    const costBefore = new PrismaNamespace.Decimal(account.balanceCostAmount);
    const avgUnitCost = new PrismaNamespace.Decimal(account.averageCost);

    if (amount.greaterThan(balanceBefore)) {
      throw new BadRequestException('Insufficient Apple ID balance');
    }

    const costAmount = amount.mul(avgUnitCost).toDecimalPlaces(4);
    const balanceAfter = balanceBefore.minus(amount).toDecimalPlaces(4);
    const costAfter = balanceAfter.equals(0)
      ? new PrismaNamespace.Decimal(0)
      : costBefore.minus(costAmount).toDecimalPlaces(4);

    if (costAfter.lessThan(0)) {
      throw new BadRequestException('Apple ID balance cost would become negative');
    }

    return {
      balanceBefore,
      balanceAfter,
      costBefore,
      costAfter,
      avgUnitCost,
      costAmount,
      avgCostAfter: this.calculateAverageCost(balanceAfter, costAfter)
    };
  }

  calculateAdjustmentSnapshot(
    account: Pick<AppleAccount, 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    newBalanceInput: PrismaNamespace.Decimal.Value,
    costAdjustMethodInput: AppleBalanceAdjustmentCostMethod,
    manualNewCostInput?: PrismaNamespace.Decimal.Value | null
  ): AdjustmentSnapshot {
    const costAdjustMethod = this.parseCostAdjustMethod(costAdjustMethodInput);
    const oldBalance = new PrismaNamespace.Decimal(account.currentBalance);
    const oldCostRmb = new PrismaNamespace.Decimal(account.balanceCostAmount);
    const avgUnitCost = new PrismaNamespace.Decimal(account.averageCost);
    const newBalance = this.normalizeNonNegativeDecimal(newBalanceInput, 'newBalance');
    const difference = newBalance.minus(oldBalance).toDecimalPlaces(4);
    let newCostRmb: PrismaNamespace.Decimal;

    if (costAdjustMethod === 'none') {
      newCostRmb = oldCostRmb;
    } else if (costAdjustMethod === 'current_avg') {
      newCostRmb = newBalance.equals(0)
        ? new PrismaNamespace.Decimal(0)
        : oldCostRmb.plus(difference.mul(avgUnitCost)).toDecimalPlaces(4);
    } else {
      newCostRmb = this.normalizeNonNegativeDecimal(manualNewCostInput ?? undefined, 'newCostRmb');
    }

    if (newCostRmb.lessThan(0)) {
      throw new BadRequestException('New cost amount cannot be negative');
    }

    if (newBalance.equals(0) && !newCostRmb.equals(0)) {
      throw new BadRequestException('New cost amount must be zero when new balance is zero');
    }

    const costRmbChange = newCostRmb.minus(oldCostRmb).toDecimalPlaces(4);

    return {
      oldBalance,
      newBalance,
      difference,
      oldCostRmb,
      newCostRmb,
      costRmbChange,
      avgCostAfter: this.calculateAverageCost(newBalance, newCostRmb)
    };
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

  private async updateAccountBalanceSnapshot(
    tx: Prisma.TransactionClient,
    account: Pick<AppleAccount, 'id' | 'currentBalance' | 'balanceCostAmount' | 'averageCost'>,
    snapshot: {
      currentBalance: PrismaNamespace.Decimal;
      balanceCostAmount: PrismaNamespace.Decimal;
      averageCost: PrismaNamespace.Decimal;
      operatorId?: string;
    }
  ) {
    const result = await tx.appleAccount.updateMany({
      where: {
        id: account.id,
        deletedAt: null,
        currentBalance: account.currentBalance,
        balanceCostAmount: account.balanceCostAmount,
        averageCost: account.averageCost
      },
      data: {
        currentBalance: snapshot.currentBalance,
        balanceCostAmount: snapshot.balanceCostAmount,
        averageCost: snapshot.averageCost,
        updatedByUserId: snapshot.operatorId
      }
    });

    if (result.count !== 1) {
      throw new ConflictException('Apple ID balance changed, please retry');
    }
  }

  private calculateAverageCost(
    currentBalanceInput: PrismaNamespace.Decimal.Value,
    balanceCostAmountInput: PrismaNamespace.Decimal.Value
  ) {
    const currentBalance = new PrismaNamespace.Decimal(currentBalanceInput);
    const balanceCostAmount = new PrismaNamespace.Decimal(balanceCostAmountInput);

    if (currentBalance.equals(0)) {
      if (balanceCostAmount.greaterThan(0)) {
        throw new BadRequestException('Balance cost amount must be zero when balance is zero');
      }

      return new PrismaNamespace.Decimal(0);
    }

    return balanceCostAmount.div(currentBalance).toDecimalPlaces(8);
  }

  private normalizePositiveDecimal(
    value: PrismaNamespace.Decimal.Value | undefined,
    field: string
  ) {
    const decimal = this.normalizeNonNegativeDecimal(value, field);

    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(`${field} must be greater than zero`);
    }

    return decimal;
  }

  private normalizeNonNegativeDecimal(
    value: PrismaNamespace.Decimal.Value | undefined,
    field: string
  ) {
    if (value === undefined || value === '') {
      throw new BadRequestException(`${field} is required`);
    }

    const normalized = String(value).trim();
    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return new PrismaNamespace.Decimal(normalized);
  }

  private parseCostAdjustMethod(value: unknown): AppleBalanceAdjustmentCostMethod {
    if (value === 'none' || value === 'current_avg' || value === 'manual') {
      return value;
    }

    throw new BadRequestException('costAdjustMethod is invalid');
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeRequiredString(value: string | null | undefined, field: string) {
    const normalized = this.normalizeNullableString(value);

    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }

    return normalized;
  }

  private getTail(value: string | null | undefined) {
    const normalized = this.normalizeNullableString(value);
    return normalized ? normalized.slice(-4) : null;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toTopupResponse(topup: AppleBalanceTopup) {
    return {
      id: topup.id,
      appleAccountId: topup.appleAccountId,
      faceValue: topup.faceValue.toString(),
      costAmount: topup.costAmount.toString(),
      balanceBefore: topup.balanceBefore.toString(),
      balanceAfter: topup.balanceAfter.toString(),
      costBefore: topup.costBefore.toString(),
      costAfter: topup.costAfter.toString(),
      avgCostBefore: topup.avgCostBefore.toString(),
      avgCostAfter: topup.avgCostAfter.toString(),
      hasGiftCardCode: Boolean(topup.giftCardCodeEncrypted),
      giftCardCodeTail: topup.giftCardCodeTail,
      remark: topup.remark,
      createdAt: topup.createdAt
    };
  }

  private toConsumptionResponse(consumption: AppleBalanceConsumption) {
    return {
      id: consumption.id,
      appleAccountId: consumption.appleAccountId,
      amount: consumption.amount.toString(),
      costAmount: consumption.costAmount.toString(),
      avgUnitCost: consumption.avgUnitCost.toString(),
      balanceBefore: consumption.balanceBefore.toString(),
      balanceAfter: consumption.balanceAfter.toString(),
      costBefore: consumption.costBefore.toString(),
      costAfter: consumption.costAfter.toString(),
      reason: consumption.reason,
      relatedObjectType: consumption.relatedObjectType,
      relatedObjectId: consumption.relatedObjectId,
      remark: consumption.remark,
      createdAt: consumption.createdAt
    };
  }

  private getAdjustmentInclude() {
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
    } satisfies Prisma.AppleBalanceAdjustmentInclude;
  }

  private toAdjustmentResponse(adjustment: BalanceAdjustmentWithRelations) {
    return {
      id: adjustment.id,
      appleAccountId: adjustment.appleAccountId,
      oldBalance: adjustment.oldBalance.toString(),
      newBalance: adjustment.newBalance.toString(),
      difference: adjustment.difference.toString(),
      oldCostRmb: adjustment.oldCostRmb.toString(),
      newCostRmb: adjustment.newCostRmb.toString(),
      costAdjustMethod: adjustment.costAdjustMethod,
      costRmbChange: adjustment.costRmbChange.toString(),
      reason: adjustment.reason,
      evidenceAttachmentId: adjustment.evidenceAttachmentId,
      evidenceAttachment: adjustment.evidenceAttachment
        ? {
            id: adjustment.evidenceAttachment.id,
            originalName: adjustment.evidenceAttachment.originalName,
            mimeType: adjustment.evidenceAttachment.mimeType,
            sizeBytes: adjustment.evidenceAttachment.sizeBytes.toString(),
            createdAt: adjustment.evidenceAttachment.createdAt
          }
        : null,
      operator: adjustment.operator
        ? {
            id: adjustment.operator.id,
            username: adjustment.operator.username,
            displayName: adjustment.operator.displayName
          }
        : null,
      createdAt: adjustment.createdAt
    };
  }
}
