import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CodeAfterSale,
  CodeAfterSaleStatus,
  CodeDeliveryMethod,
  CodePlatformOrder,
  CodeService,
  Prisma,
  RedeemCode,
  SourcePlatform,
  User
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateCodeAfterSaleDto } from './dto/create-code-after-sale.dto';
import type { ReissueCodeAfterSaleDto } from './dto/reissue-code-after-sale.dto';

interface ListCodeAfterSalesQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  orderId?: string;
  sortBy?: string;
  sortOrder?: string;
}

type AfterSaleOrder = Pick<
  CodePlatformOrder,
  | 'id'
  | 'platformId'
  | 'externalOrderNo'
  | 'itemTitle'
  | 'skuName'
  | 'deliveryStatus'
  | 'refundStatus'
  | 'paidAmount'
  | 'platformFee'
  | 'costAmount'
  | 'profitAmount'
> & {
  platform: Pick<SourcePlatform, 'id' | 'name'>;
  service?: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'status'> | null;
};

type AfterSaleCode = Pick<
  RedeemCode,
  'id' | 'serviceId' | 'codeTail' | 'faceValue' | 'cost' | 'status'
>;

type AfterSaleWithRelations = CodeAfterSale & {
  order: AfterSaleOrder;
  originalCode: AfterSaleCode;
  newCode?: AfterSaleCode | null;
  handledBy?: Pick<User, 'id' | 'username' | 'displayName'> | null;
};

type ReissueCandidate = Pick<
  RedeemCode,
  'id' | 'serviceId' | 'codeEncrypted' | 'codeTail' | 'faceValue' | 'cost' | 'status'
>;

const CODE_AFTER_SALE_SORT_FIELDS: Record<
  string,
  keyof Prisma.CodeAfterSaleOrderByWithRelationInput
> = {
  status: 'status',
  createdAt: 'createdAt',
  completedAt: 'completedAt'
};

@Injectable()
export class CodeAfterSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService
  ) {}

  async list(query: ListCodeAfterSalesQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const status = this.parseStatus(query.status, false);
    const where: Prisma.CodeAfterSaleWhereInput = {
      status: status ?? undefined,
      orderId: this.normalizeOptionalUuid(query.orderId, 'orderId') ?? undefined,
      OR: keyword
        ? [
            { reason: { contains: keyword, mode: 'insensitive' } },
            { order: { externalOrderNo: { contains: keyword, mode: 'insensitive' } } },
            { originalCode: { codeTail: { contains: keyword, mode: 'insensitive' } } },
            { newCode: { codeTail: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.codeAfterSale.findMany({
        where,
        include: this.getAfterSaleInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.codeAfterSale.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const afterSale = await this.findAfterSaleOrThrow(id);
    return this.toResponse(afterSale);
  }

  async create(dto: CreateCodeAfterSaleDto, operator?: AuthenticatedUser) {
    const orderId = this.normalizeRequiredUuid(dto.orderId, 'orderId');
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const requestedCodeId = this.normalizeOptionalUuid(
      dto.originalCodeId ?? undefined,
      'originalCodeId'
    );
    const order = await this.prisma.codePlatformOrder.findUnique({
      where: { id: orderId },
      include: {
        deliveredCodes: {
          where: requestedCodeId
            ? {
                id: requestedCodeId,
                status: 'delivered'
              }
            : {
                status: 'delivered'
              },
          select: {
            id: true,
            serviceId: true,
            codeTail: true,
            faceValue: true,
            cost: true,
            status: true
          },
          orderBy: { deliveredAt: 'asc' }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Code order not found');
    }

    if (order.deliveryStatus !== 'delivered') {
      throw new BadRequestException('Only delivered orders can create after-sales records');
    }

    const originalCode = order.deliveredCodes[0];

    if (!originalCode) {
      throw new BadRequestException('No delivered redeem code is available for after-sale');
    }

    const afterSale = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.redeemCode.updateMany({
        where: {
          id: originalCode.id,
          deliveredOrderId: order.id,
          status: 'delivered'
        },
        data: {
          status: 'after_sale'
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('Redeem code already has after-sale processing');
      }

      return tx.codeAfterSale.create({
        data: {
          orderId: order.id,
          originalCodeId: originalCode.id,
          reason,
          handledByUserId: operator?.id
        },
        include: this.getAfterSaleInclude()
      });
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_after_sale',
      action: 'code_after_sale.create',
      objectType: 'code_after_sale',
      objectId: afterSale.id,
      afterData: this.toAuditJson({
        id: afterSale.id,
        orderId: afterSale.orderId,
        externalOrderNo: afterSale.order.externalOrderNo,
        originalCodeTail: afterSale.originalCode.codeTail,
        reason
      }),
      remark: `Created code after-sale record for order ${afterSale.order.externalOrderNo}`
    });

    return this.toResponse(afterSale);
  }

  async reissue(id: string, dto: ReissueCodeAfterSaleDto, operator?: AuthenticatedUser) {
    const afterSale = await this.findAfterSaleOrThrow(id);

    if (afterSale.status !== 'pending') {
      throw new ConflictException('Only pending after-sales can be reissued');
    }

    if (afterSale.newCodeId) {
      throw new ConflictException('After-sale already has a reissued code');
    }

    const newCode = await this.findReissueCode(afterSale, dto.newCodeId ?? undefined);
    const redeemCode = this.fieldEncryptionService.decrypt(newCode.codeEncrypted);

    if (!redeemCode) {
      throw new NotFoundException('Redeem code not found');
    }

    const deliveryMethod = this.normalizeDeliveryMethod(dto.deliveryMethod);
    const deliveryContent =
      this.normalizeNullableString(dto.deliveryContent) ??
      [
        `订单 ${afterSale.order.externalOrderNo} 的售后补发兑换码如下：`,
        redeemCode,
        '请尽快兑换，如有问题请联系客服。'
      ].join('\n');
    const now = new Date();
    const costAmount = afterSale.order.costAmount.plus(newCode.cost);
    const profitAmount = afterSale.order.paidAmount
      .minus(afterSale.order.platformFee)
      .minus(costAmount);

    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.redeemCode.updateMany({
        where: {
          id: newCode.id,
          status: 'unsold'
        },
        data: {
          status: 'reissued',
          deliveredOrderId: afterSale.orderId,
          deliveredPlatformId: afterSale.order.platformId,
          deliveredAt: now
        }
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('Reissue redeem code is no longer unsold');
      }

      await tx.codeAfterSale.update({
        where: { id: afterSale.id },
        data: {
          newCodeId: newCode.id,
          handledByUserId: operator?.id
        }
      });

      await tx.codeDeliveryLog.create({
        data: {
          orderId: afterSale.orderId,
          platformId: afterSale.order.platformId,
          externalOrderNo: afterSale.order.externalOrderNo,
          codeId: newCode.id,
          faceValue: newCode.faceValue,
          deliveryMethod,
          deliveryContentSnapshot: deliveryContent,
          deliveryStatus: 'success',
          cost: newCode.cost,
          paidAmount: new PrismaNamespace.Decimal(0),
          profit: new PrismaNamespace.Decimal(0).minus(newCode.cost)
        }
      });

      await tx.codePlatformOrder.update({
        where: { id: afterSale.orderId },
        data: {
          costAmount,
          profitAmount
        }
      });
    });

    const updated = await this.findAfterSaleOrThrow(id);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_after_sale',
      action: 'code_after_sale.reissue',
      objectType: 'code_after_sale',
      objectId: afterSale.id,
      afterData: this.toAuditJson({
        id: afterSale.id,
        orderId: afterSale.orderId,
        externalOrderNo: afterSale.order.externalOrderNo,
        originalCodeTail: afterSale.originalCode.codeTail,
        newCodeTail: newCode.codeTail,
        deliveryMethod,
        deliveryContentLength: deliveryContent.length,
        costAmount: costAmount.toString(),
        profitAmount: profitAmount.toString(),
        reason: this.normalizeNullableString(dto.reason)
      }),
      remark: `Reissued redeem code for after-sale ${afterSale.id}`
    });

    return {
      afterSale: this.toResponse(updated),
      deliveryContent,
      codeTail: newCode.codeTail
    };
  }

  async complete(id: string, operator?: AuthenticatedUser) {
    const afterSale = await this.findAfterSaleOrThrow(id);

    if (afterSale.status !== 'pending') {
      throw new ConflictException('Only pending after-sales can be completed');
    }

    if (!afterSale.newCodeId) {
      throw new BadRequestException('After-sale must be reissued before completion');
    }

    const completed = await this.prisma.codeAfterSale.update({
      where: { id: afterSale.id },
      data: {
        status: 'completed',
        handledByUserId: operator?.id,
        completedAt: new Date()
      },
      include: this.getAfterSaleInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_after_sale',
      action: 'code_after_sale.complete',
      objectType: 'code_after_sale',
      objectId: afterSale.id,
      afterData: this.toAuditJson({
        id: completed.id,
        orderId: completed.orderId,
        status: completed.status,
        newCodeTail: completed.newCode?.codeTail ?? null
      }),
      remark: `Completed code after-sale record ${afterSale.id}`
    });

    return this.toResponse(completed);
  }

  private async findAfterSaleOrThrow(id: string) {
    const afterSaleId = this.normalizeRequiredUuid(id, 'id');
    const afterSale = await this.prisma.codeAfterSale.findUnique({
      where: { id: afterSaleId },
      include: this.getAfterSaleInclude()
    });

    if (!afterSale) {
      throw new NotFoundException('Code after-sale record not found');
    }

    return afterSale;
  }

  private async findReissueCode(afterSale: AfterSaleWithRelations, newCodeId?: string | null) {
    const where: Prisma.RedeemCodeWhereInput = {
      id: newCodeId ? this.normalizeRequiredUuid(newCodeId, 'newCodeId') : undefined,
      serviceId: afterSale.originalCode.serviceId,
      faceValue: afterSale.originalCode.faceValue,
      status: 'unsold'
    };

    const code = await this.prisma.redeemCode.findFirst({
      where,
      select: {
        id: true,
        serviceId: true,
        codeEncrypted: true,
        codeTail: true,
        faceValue: true,
        cost: true,
        status: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!code) {
      throw new BadRequestException('No unsold redeem code is available for reissue');
    }

    return code satisfies ReissueCandidate;
  }

  private getAfterSaleInclude() {
    return {
      order: {
        select: {
          id: true,
          platformId: true,
          externalOrderNo: true,
          itemTitle: true,
          skuName: true,
          deliveryStatus: true,
          refundStatus: true,
          paidAmount: true,
          platformFee: true,
          costAmount: true,
          profitAmount: true,
          platform: {
            select: {
              id: true,
              name: true
            }
          },
          service: {
            select: {
              id: true,
              name: true,
              faceValue: true,
              status: true
            }
          }
        }
      },
      originalCode: {
        select: {
          id: true,
          serviceId: true,
          codeTail: true,
          faceValue: true,
          cost: true,
          status: true
        }
      },
      newCode: {
        select: {
          id: true,
          serviceId: true,
          codeTail: true,
          faceValue: true,
          cost: true,
          status: true
        }
      },
      handledBy: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    } satisfies Prisma.CodeAfterSaleInclude;
  }

  private parseStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'pending' || value === 'completed' || value === 'rejected') {
      return value satisfies CodeAfterSaleStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid code after-sale status');
    }

    return undefined;
  }

  private buildOrderBy(
    query: ListCodeAfterSalesQuery
  ): Prisma.CodeAfterSaleOrderByWithRelationInput[] {
    const sortField = query.sortBy ? CODE_AFTER_SALE_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
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

  private normalizeDeliveryMethod(value: unknown): CodeDeliveryMethod {
    if (value === undefined || value === null || value === '') {
      return 'manual';
    }

    if (
      value === 'eticket' ||
      value === 'dummy_send' ||
      value === 'message_card' ||
      value === 'manual'
    ) {
      return value;
    }

    throw new BadRequestException('Invalid code delivery method');
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }

    return normalized;
  }

  private normalizeOptionalUuid(value: string | null | undefined, field: string) {
    if (!value) {
      return undefined;
    }

    return this.normalizeRequiredUuid(value, field);
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
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

  private toResponse(afterSale: AfterSaleWithRelations) {
    return {
      id: afterSale.id,
      orderId: afterSale.orderId,
      order: {
        id: afterSale.order.id,
        externalOrderNo: afterSale.order.externalOrderNo,
        itemTitle: afterSale.order.itemTitle,
        skuName: afterSale.order.skuName,
        deliveryStatus: afterSale.order.deliveryStatus,
        refundStatus: afterSale.order.refundStatus,
        paidAmount: afterSale.order.paidAmount.toString(),
        platformFee: afterSale.order.platformFee.toString(),
        costAmount: afterSale.order.costAmount.toString(),
        profitAmount: afterSale.order.profitAmount.toString(),
        platform: afterSale.order.platform,
        service: afterSale.order.service
          ? {
              id: afterSale.order.service.id,
              name: afterSale.order.service.name,
              faceValue: afterSale.order.service.faceValue.toString(),
              status: afterSale.order.service.status
            }
          : null
      },
      originalCodeId: afterSale.originalCodeId,
      originalCode: {
        id: afterSale.originalCode.id,
        codeTail: afterSale.originalCode.codeTail,
        faceValue: afterSale.originalCode.faceValue.toString(),
        cost: afterSale.originalCode.cost.toString(),
        status: afterSale.originalCode.status
      },
      newCodeId: afterSale.newCodeId,
      newCode: afterSale.newCode
        ? {
            id: afterSale.newCode.id,
            codeTail: afterSale.newCode.codeTail,
            faceValue: afterSale.newCode.faceValue.toString(),
            cost: afterSale.newCode.cost.toString(),
            status: afterSale.newCode.status
          }
        : null,
      reason: afterSale.reason,
      status: afterSale.status,
      handledBy: afterSale.handledBy
        ? {
            id: afterSale.handledBy.id,
            username: afterSale.handledBy.username,
            displayName: afterSale.handledBy.displayName
          }
        : null,
      createdAt: afterSale.createdAt,
      completedAt: afterSale.completedAt
    };
  }
}
