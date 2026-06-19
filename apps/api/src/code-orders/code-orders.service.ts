import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CodeDeliveryLog,
  CodeDeliveryLogStatus,
  CodeDeliveryMethod,
  CodeDeliveryStatus,
  CodePlatformMapping,
  CodePlatformOrder,
  CodeRefundStatus,
  CodeService,
  Prisma,
  RedeemCode,
  SourcePlatform
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ConfirmCodeDeliveryDto } from './dto/confirm-code-delivery.dto';
import type { CreateManualCodeOrderDto } from './dto/create-manual-code-order.dto';
import type { GenerateDeliveryContentDto } from './dto/generate-delivery-content.dto';
import type { MarkCodeOrderManualDto } from './dto/mark-code-order-manual.dto';

interface ListCodeOrdersQuery extends PaginationQuery {
  keyword?: string;
  platformId?: string;
  serviceId?: string;
  deliveryStatus?: string;
  refundStatus?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListCodeDeliveryLogsQuery extends PaginationQuery {
  keyword?: string;
  platformId?: string;
  orderId?: string;
  deliveryStatus?: string;
}

interface AuditRequestMeta {
  ip?: string;
  userAgent?: string;
}

type CodeOrderWithRelations = CodePlatformOrder & {
  platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type' | 'status'>;
  service?: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'> | null;
  lockedCodes: Array<Pick<RedeemCode, 'id' | 'codeTail' | 'faceValue' | 'cost' | 'status'>>;
  deliveredCodes: Array<Pick<RedeemCode, 'id' | 'codeTail' | 'faceValue' | 'cost' | 'status'>>;
};

type CodeDeliveryLogWithRelations = CodeDeliveryLog & {
  platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'>;
  order: Pick<CodePlatformOrder, 'id' | 'externalOrderNo' | 'deliveryStatus'>;
  code: Pick<RedeemCode, 'id' | 'codeTail' | 'status'>;
};

type MappingWithService = CodePlatformMapping & {
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'>;
};

const CODE_ORDER_SORT_FIELDS: Record<
  string,
  keyof Prisma.CodePlatformOrderOrderByWithRelationInput
> = {
  externalOrderNo: 'externalOrderNo',
  quantity: 'quantity',
  paidAmount: 'paidAmount',
  platformFee: 'platformFee',
  costAmount: 'costAmount',
  profitAmount: 'profitAmount',
  orderStatus: 'orderStatus',
  deliveryStatus: 'deliveryStatus',
  refundStatus: 'refundStatus',
  paidAt: 'paidAt',
  deliveredAt: 'deliveredAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

@Injectable()
export class CodeOrdersService {
  private readonly lowInventoryThreshold = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fieldEncryptionService: FieldEncryptionService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: ListCodeOrdersQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const deliveryStatus = this.parseDeliveryStatus(query.deliveryStatus, false);
    const refundStatus = this.parseRefundStatus(query.refundStatus, false);
    const where: Prisma.CodePlatformOrderWhereInput = {
      platformId: this.normalizeOptionalUuid(query.platformId, 'platformId') ?? undefined,
      serviceId: this.normalizeOptionalUuid(query.serviceId, 'serviceId') ?? undefined,
      deliveryStatus: deliveryStatus ?? undefined,
      refundStatus: refundStatus ?? undefined,
      OR: keyword
        ? [
            { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
            { buyerId: { contains: keyword, mode: 'insensitive' } },
            { buyerNameMasked: { contains: keyword, mode: 'insensitive' } },
            { itemId: { contains: keyword, mode: 'insensitive' } },
            { skuId: { contains: keyword, mode: 'insensitive' } },
            { itemTitle: { contains: keyword, mode: 'insensitive' } },
            { skuName: { contains: keyword, mode: 'insensitive' } },
            { service: { name: { contains: keyword, mode: 'insensitive' } } },
            { platform: { name: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.codePlatformOrder.findMany({
        where,
        include: this.getOrderInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.codePlatformOrder.count({ where })
    ]);

    return {
      items: items.map((order) => this.toResponse(order)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async get(id: string) {
    const order = await this.findOrderOrThrow(id);
    return this.toResponse(order);
  }

  async createManual(dto: CreateManualCodeOrderDto, operator?: AuthenticatedUser) {
    const platformId = this.normalizeRequiredUuid(dto.platformId, 'platformId');
    await this.assertPlatformAvailable(platformId);
    const externalOrderNo = this.normalizeRequiredString(dto.externalOrderNo, 'externalOrderNo');
    await this.assertExternalOrderNoAvailable(platformId, externalOrderNo);

    const itemId = this.normalizeRequiredString(dto.itemId, 'itemId');
    const skuId = this.normalizeOptionalCode(dto.skuId);
    const mapped = await this.resolveMapping({
      platformId,
      itemId,
      skuId,
      itemTitle: dto.itemTitle,
      skuName: dto.skuName
    });
    const explicitService = dto.serviceId
      ? await this.assertCodeServiceAvailable(dto.serviceId)
      : null;
    const service = explicitService ?? mapped?.service ?? null;
    const quantity = this.normalizePositiveInteger(dto.quantity ?? mapped?.quantity, 'quantity', 1);
    const faceValue =
      dto.faceValue !== undefined && dto.faceValue !== null
        ? this.normalizePositiveDecimal(dto.faceValue, 'faceValue')
        : (mapped?.faceValue.toString() ?? service?.faceValue.toString() ?? null);
    const paidAmount = this.normalizeNonNegativeDecimal(dto.paidAmount, 'paidAmount', '0');
    const platformFee = this.normalizeNonNegativeDecimal(dto.platformFee, 'platformFee', '0');
    const profitAmount = new PrismaNamespace.Decimal(paidAmount)
      .minus(new PrismaNamespace.Decimal(platformFee))
      .toString();

    const order = await this.prisma.codePlatformOrder.create({
      data: {
        platformId,
        externalOrderNo,
        buyerId: this.normalizeNullableString(dto.buyerId),
        buyerNameMasked: this.normalizeNullableString(dto.buyerNameMasked),
        itemId,
        skuId,
        itemTitle: this.normalizeNullableString(dto.itemTitle),
        skuName: this.normalizeNullableString(dto.skuName),
        serviceId: service?.id,
        faceValue,
        quantity,
        paidAmount,
        platformFee,
        profitAmount,
        orderStatus: this.normalizeOrderStatus(dto.orderStatus),
        paidAt: this.normalizeNullableDate(dto.paidAt, 'paidAt')
      },
      include: this.getOrderInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_order',
      action: 'code_order.manual_create',
      objectType: 'code_platform_order',
      objectId: order.id,
      afterData: this.toAuditJson(this.toResponse(order)),
      remark: `Created manual code order ${externalOrderNo}`
    });

    return this.toResponse(order);
  }

  async matchAndLock(id: string, operator?: AuthenticatedUser) {
    const existingOrder = await this.findOrderOrThrow(id);

    if (existingOrder.lockedCodes.length || existingOrder.deliveredCodes.length) {
      throw new ConflictException('Order already has locked or delivered redeem codes');
    }

    const resolved = await this.resolveOrderService(existingOrder);
    const faceValue = resolved.faceValue;
    const availableCodes = await this.prisma.redeemCode.findMany({
      where: {
        serviceId: resolved.serviceId,
        faceValue,
        status: 'unsold'
      },
      take: existingOrder.quantity,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        codeTail: true,
        cost: true,
        faceValue: true
      }
    });

    if (availableCodes.length < existingOrder.quantity) {
      await this.notifyInventoryShortage(existingOrder, resolved, availableCodes.length);
      throw new BadRequestException('Redeem code inventory is not enough for this order');
    }

    const costAmount = availableCodes.reduce(
      (sum, code) => sum.plus(code.cost),
      new PrismaNamespace.Decimal(0)
    );
    const profitAmount = existingOrder.paidAmount
      .minus(existingOrder.platformFee)
      .minus(costAmount);

    await this.prisma.$transaction(async (tx) => {
      for (const code of availableCodes) {
        const result = await tx.redeemCode.updateMany({
          where: {
            id: code.id,
            status: 'unsold'
          },
          data: {
            status: 'locked',
            lockedOrderId: existingOrder.id
          }
        });

        if (result.count !== 1) {
          throw new ConflictException('Redeem code was locked by another order');
        }
      }

      await tx.codePlatformOrder.update({
        where: { id: existingOrder.id },
        data: {
          serviceId: resolved.serviceId,
          faceValue,
          costAmount,
          profitAmount,
          deliveryStatus: 'pending'
        }
      });
    });

    const order = await this.findOrderOrThrow(existingOrder.id);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_order',
      action: 'code_order.match_and_lock',
      objectType: 'code_platform_order',
      objectId: order.id,
      afterData: this.toAuditJson({
        orderId: order.id,
        serviceId: resolved.serviceId,
        faceValue: faceValue.toString(),
        lockedCodeTails: availableCodes.map((code) => code.codeTail),
        costAmount: costAmount.toString(),
        profitAmount: profitAmount.toString()
      }),
      remark: `Matched and locked redeem codes for order ${order.externalOrderNo}`
    });

    await this.notifyInventoryAfterLock(order, resolved);

    return this.toResponse(order);
  }

  async generateDeliveryContent(
    id: string,
    dto: GenerateDeliveryContentDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const order = await this.prisma.codePlatformOrder.findUnique({
      where: { id },
      include: {
        ...this.getOrderInclude(),
        lockedCodes: {
          where: {
            lockedOrderId: id,
            status: 'locked'
          },
          select: {
            id: true,
            codeEncrypted: true,
            codeTail: true,
            faceValue: true,
            cost: true,
            status: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Code order not found');
    }

    if (!order.lockedCodes.length) {
      throw new BadRequestException('Order has no locked redeem codes');
    }

    const codes = order.lockedCodes.map((code) => {
      const redeemCode = this.fieldEncryptionService.decrypt(code.codeEncrypted);

      if (!redeemCode) {
        throw new NotFoundException('Redeem code not found');
      }

      return {
        id: code.id,
        codeTail: code.codeTail,
        redeemCode
      };
    });
    const deliveryContent = [
      `订单 ${order.externalOrderNo} 的兑换码如下：`,
      ...codes.map((code) => code.redeemCode),
      '请尽快兑换，如有问题请联系客服。'
    ].join('\n');

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_order',
      action: 'code_order.delivery_content.generate',
      objectType: 'code_platform_order',
      objectId: order.id,
      afterData: this.toAuditJson({
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        codeTails: codes.map((code) => code.codeTail),
        reason
      }),
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
      remark: `Generated delivery content for code order ${order.externalOrderNo}`
    });

    return {
      orderId: order.id,
      externalOrderNo: order.externalOrderNo,
      deliveryContent,
      codeCount: codes.length,
      codeTails: codes.map((code) => code.codeTail),
      generatedAt: new Date()
    };
  }

  async confirmDelivery(
    id: string,
    dto: ConfirmCodeDeliveryDto,
    operator?: AuthenticatedUser,
    requestMeta?: AuditRequestMeta
  ) {
    const deliveryContent = this.normalizeRequiredString(dto.deliveryContent, 'deliveryContent');
    const deliveryMethod = this.normalizeDeliveryMethod(dto.deliveryMethod);
    const errorMessage = this.normalizeNullableString(dto.errorMessage);
    const order = await this.findOrderOrThrow(id);

    if (order.refundStatus !== 'none') {
      throw new ConflictException('Refunding or refunded order cannot be delivered');
    }

    if (order.deliveryStatus === 'delivered' || order.deliveredCodes.length > 0) {
      throw new ConflictException('Order already delivered');
    }

    if (!order.lockedCodes.length) {
      throw new BadRequestException('Order has no locked redeem codes');
    }

    if (order.lockedCodes.length < order.quantity) {
      throw new BadRequestException('Locked redeem code count is less than order quantity');
    }

    const now = new Date();
    const codeCount = order.lockedCodes.length;
    const codeCountDecimal = new PrismaNamespace.Decimal(codeCount);
    const paidShare = order.paidAmount.div(codeCountDecimal).toDecimalPlaces(2);
    const platformFeeShare = order.platformFee.div(codeCountDecimal).toDecimalPlaces(2);
    const costAmount = order.lockedCodes.reduce(
      (sum, code) => sum.plus(code.cost),
      new PrismaNamespace.Decimal(0)
    );
    const profitAmount = order.paidAmount.minus(order.platformFee).minus(costAmount);

    await this.prisma.$transaction(async (tx) => {
      for (const code of order.lockedCodes) {
        const result = await tx.redeemCode.updateMany({
          where: {
            id: code.id,
            status: 'locked',
            lockedOrderId: order.id
          },
          data: {
            status: 'delivered',
            deliveredOrderId: order.id,
            deliveredPlatformId: order.platformId,
            deliveredAt: now
          }
        });

        if (result.count !== 1) {
          throw new ConflictException('Redeem code already delivered or released');
        }

        await tx.codeDeliveryLog.create({
          data: {
            orderId: order.id,
            platformId: order.platformId,
            externalOrderNo: order.externalOrderNo,
            codeId: code.id,
            faceValue: code.faceValue,
            deliveryMethod,
            deliveryContentSnapshot: deliveryContent,
            deliveryStatus: 'success',
            errorMessage,
            cost: code.cost,
            paidAmount: paidShare,
            profit: paidShare.minus(platformFeeShare).minus(code.cost)
          }
        });
      }

      await tx.codePlatformOrder.update({
        where: { id: order.id },
        data: {
          deliveryStatus: 'delivered',
          deliveredAt: now,
          costAmount,
          profitAmount
        }
      });
    });

    const deliveredOrder = await this.findOrderOrThrow(order.id);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_order',
      action: 'code_order.deliver',
      objectType: 'code_platform_order',
      objectId: order.id,
      afterData: this.toAuditJson({
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        deliveryMethod,
        codeTails: order.lockedCodes.map((code) => code.codeTail),
        deliveryContentLength: deliveryContent.length,
        costAmount: costAmount.toString(),
        profitAmount: profitAmount.toString()
      }),
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
      remark: `Confirmed code delivery for order ${order.externalOrderNo}`
    });

    return this.toResponse(deliveredOrder);
  }

  async markManual(id: string, dto: MarkCodeOrderManualDto, operator?: AuthenticatedUser) {
    const reason = this.normalizeRequiredString(dto.reason, 'reason');
    const order = await this.findOrderOrThrow(id);

    if (order.deliveryStatus === 'delivered' || order.deliveredCodes.length > 0) {
      throw new ConflictException('Delivered order cannot be marked as manual');
    }

    const updated = await this.prisma.codePlatformOrder.update({
      where: { id: order.id },
      data: {
        deliveryStatus: 'manual'
      },
      include: this.getOrderInclude()
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'code_order',
      action: 'code_order.mark_manual',
      objectType: 'code_platform_order',
      objectId: order.id,
      afterData: this.toAuditJson({
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        previousDeliveryStatus: order.deliveryStatus,
        deliveryStatus: 'manual',
        reason
      }),
      remark: `Marked code order ${order.externalOrderNo} as manual`
    });

    await this.notifyDeliveryFailed(updated, reason);

    return this.toResponse(updated);
  }

  async listDeliveryLogs(query: ListCodeDeliveryLogsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const deliveryStatus = this.parseDeliveryLogStatus(query.deliveryStatus, false);
    const where: Prisma.CodeDeliveryLogWhereInput = {
      platformId: this.normalizeOptionalUuid(query.platformId, 'platformId') ?? undefined,
      orderId: this.normalizeOptionalUuid(query.orderId, 'orderId') ?? undefined,
      deliveryStatus: deliveryStatus ?? undefined,
      OR: keyword
        ? [
            { externalOrderNo: { contains: keyword, mode: 'insensitive' } },
            { platform: { name: { contains: keyword, mode: 'insensitive' } } },
            { code: { codeTail: { contains: keyword, mode: 'insensitive' } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.codeDeliveryLog.findMany({
        where,
        include: this.getDeliveryLogInclude(),
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.codeDeliveryLog.count({ where })
    ]);

    return {
      items: items.map((log) => this.toDeliveryLogResponse(log)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getDeliveryLog(id: string) {
    const log = await this.prisma.codeDeliveryLog.findUnique({
      where: { id },
      include: this.getDeliveryLogInclude()
    });

    if (!log) {
      throw new NotFoundException('Code delivery log not found');
    }

    return this.toDeliveryLogResponse(log);
  }

  async listOrderDeliveryLogs(id: string) {
    const orderId = this.normalizeRequiredUuid(id, 'id');
    const order = await this.prisma.codePlatformOrder.findUnique({
      where: { id: orderId },
      select: { id: true }
    });

    if (!order) {
      throw new NotFoundException('Code order not found');
    }

    const items = await this.prisma.codeDeliveryLog.findMany({
      where: { orderId },
      include: this.getDeliveryLogInclude(),
      orderBy: { createdAt: 'desc' }
    });

    return {
      items: items.map((log) => this.toDeliveryLogResponse(log))
    };
  }

  private async notifyInventoryShortage(
    order: CodeOrderWithRelations,
    resolved: { serviceId: string; faceValue: PrismaNamespace.Decimal },
    availableCount: number
  ) {
    const service = await this.findCodeServiceSnapshot(resolved.serviceId);
    await this.notificationsService.triggerEvent({
      eventCode: 'code.inventory.out_of_stock',
      module: 'code',
      title: '某面值缺货',
      content: `订单 ${order.externalOrderNo} 需要 ${order.quantity} 张兑换码，当前可用 ${availableCount} 张`,
      payload: {
        title: '某面值缺货',
        summary: `订单 ${order.externalOrderNo} 需要 ${order.quantity} 张兑换码，当前可用 ${availableCount} 张`,
        detail: `业务：${service?.name ?? resolved.serviceId}，面值 ${resolved.faceValue.toString()}，平台：${order.platform.name}。`,
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        serviceId: resolved.serviceId,
        serviceName: service?.name ?? null,
        faceValue: resolved.faceValue.toString(),
        requiredCount: order.quantity,
        availableCount
      }
    });
  }

  private async notifyInventoryAfterLock(
    order: CodeOrderWithRelations,
    resolved: { serviceId: string; faceValue: PrismaNamespace.Decimal }
  ) {
    const [service, unsoldCount] = await Promise.all([
      this.findCodeServiceSnapshot(resolved.serviceId),
      this.prisma.redeemCode.count({
        where: {
          serviceId: resolved.serviceId,
          status: 'unsold'
        }
      })
    ]);

    if (unsoldCount > this.lowInventoryThreshold) {
      return;
    }

    const eventCode = unsoldCount === 0 ? 'code.inventory.out_of_stock' : 'code.inventory.low';
    const title = unsoldCount === 0 ? '某面值缺货' : '兑换码低库存';
    await this.notificationsService.triggerEvent({
      eventCode,
      module: 'code',
      title,
      content: `${service?.name ?? resolved.serviceId} 锁码后可售库存剩余 ${unsoldCount} 张`,
      payload: {
        title,
        summary: `${service?.name ?? resolved.serviceId} 锁码后可售库存剩余 ${unsoldCount} 张`,
        detail: `触发订单：${order.externalOrderNo}，面值 ${resolved.faceValue.toString()}，低库存阈值 ${this.lowInventoryThreshold}。`,
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        serviceId: resolved.serviceId,
        serviceName: service?.name ?? null,
        faceValue: resolved.faceValue.toString(),
        unsoldCount,
        threshold: this.lowInventoryThreshold
      }
    });
  }

  private async notifyDeliveryFailed(order: CodeOrderWithRelations, reason: string) {
    await this.notificationsService.triggerEvent({
      eventCode: 'code.delivery.failed',
      module: 'code',
      title: '自动发货失败',
      content: `订单 ${order.externalOrderNo} 已转入人工处理`,
      payload: {
        title: '自动发货失败',
        summary: `订单 ${order.externalOrderNo} 已转入人工处理`,
        detail: reason,
        orderId: order.id,
        externalOrderNo: order.externalOrderNo,
        platformId: order.platformId,
        platformName: order.platform.name,
        serviceId: order.serviceId,
        serviceName: order.service?.name ?? null,
        deliveryStatus: order.deliveryStatus
      }
    });
  }

  private async findCodeServiceSnapshot(serviceId: string) {
    return this.prisma.codeService.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        faceValue: true,
        status: true
      }
    });
  }

  private async resolveOrderService(order: CodeOrderWithRelations) {
    if (order.serviceId && order.faceValue) {
      return {
        serviceId: order.serviceId,
        faceValue: order.faceValue
      };
    }

    const mapping = await this.resolveMapping({
      platformId: order.platformId,
      itemId: order.itemId,
      skuId: order.skuId,
      itemTitle: order.itemTitle,
      skuName: order.skuName
    });

    if (!mapping) {
      throw new BadRequestException('No code service mapping matched this order');
    }

    return {
      serviceId: mapping.serviceId,
      faceValue: mapping.faceValue
    };
  }

  private async resolveMapping(order: {
    platformId: string;
    itemId: string;
    skuId: string;
    itemTitle?: string | null;
    skuName?: string | null;
  }) {
    const candidates = await this.prisma.codePlatformMapping.findMany({
      where: {
        platformId: order.platformId,
        platformItemId: order.itemId,
        enabled: true,
        service: {
          deletedAt: null,
          status: { not: 'disabled' }
        }
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            faceValue: true,
            defaultCost: true,
            status: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!candidates.length) {
      return null;
    }

    const searchableText = `${order.skuName ?? ''} ${order.itemTitle ?? ''}`.toLowerCase();
    const scored = candidates
      .map((mapping) => ({
        mapping,
        score: this.getMappingScore(mapping, order.skuId, searchableText)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return scored[0]?.mapping ?? null;
  }

  private getMappingScore(mapping: MappingWithService, skuId: string, searchableText: string) {
    let score = 0;

    if (mapping.platformSkuId && mapping.platformSkuId === skuId) {
      score += 100;
    }

    if (!mapping.platformSkuId) {
      score += 20;
    }

    if (mapping.skuKeyword && searchableText.includes(mapping.skuKeyword.toLowerCase())) {
      score += 30;
    }

    return score;
  }

  private async findOrderOrThrow(id: string) {
    const order = await this.prisma.codePlatformOrder.findUnique({
      where: { id },
      include: this.getOrderInclude()
    });

    if (!order) {
      throw new NotFoundException('Code order not found');
    }

    return order;
  }

  private async assertExternalOrderNoAvailable(platformId: string, externalOrderNo: string) {
    const existingOrder = await this.prisma.codePlatformOrder.findUnique({
      where: {
        platformId_externalOrderNo: {
          platformId,
          externalOrderNo
        }
      },
      select: { id: true }
    });

    if (existingOrder) {
      throw new ConflictException('Code order already exists');
    }
  }

  private async assertPlatformAvailable(id: string) {
    const platform = await this.prisma.sourcePlatform.findFirst({
      where: {
        id,
        deletedAt: null,
        status: 'active'
      },
      select: { id: true }
    });

    if (!platform) {
      throw new BadRequestException('Source platform does not exist or is disabled');
    }
  }

  private async assertCodeServiceAvailable(id: string) {
    const serviceId = this.normalizeRequiredUuid(id, 'serviceId');
    const service = await this.prisma.codeService.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
        status: { not: 'disabled' }
      },
      select: {
        id: true,
        name: true,
        faceValue: true,
        defaultCost: true,
        status: true
      }
    });

    if (!service) {
      throw new BadRequestException('Code service does not exist or is disabled');
    }

    return service;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeRequiredUuid(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new BadRequestException(`${field} must be a uuid`);
    }

    return normalized;
  }

  private normalizeOptionalUuid(value: string | undefined, field: string) {
    if (!value) {
      return undefined;
    }

    return this.normalizeRequiredUuid(value, field);
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeOptionalCode(value: string | null | undefined) {
    return this.normalizeNullableString(value) ?? '';
  }

  private normalizePositiveInteger(value: number | undefined, field: string, fallback: number) {
    const normalized = value ?? fallback;

    if (!Number.isInteger(normalized) || normalized < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return normalized;
  }

  private normalizePositiveDecimal(value: string | number, field: string) {
    const normalized = this.normalizeDecimal(value, field, undefined);

    if (Number(normalized) <= 0) {
      throw new BadRequestException(`${field} must be greater than 0`);
    }

    return normalized;
  }

  private normalizeNonNegativeDecimal(
    value: string | number | undefined,
    field: string,
    fallback: string
  ) {
    return this.normalizeDecimal(value, field, fallback);
  }

  private normalizeDecimal(value: string | number | undefined, field: string, fallback?: string) {
    const normalized = value === undefined || value === '' ? fallback : String(value).trim();

    if (!normalized || !/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a non-negative decimal`);
    }

    return normalized;
  }

  private normalizeNullableDate(value: string | null | undefined, field: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private normalizeOrderStatus(value: string | undefined) {
    return this.normalizeNullableString(value) ?? 'paid';
  }

  private parseDeliveryStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'pending' || value === 'delivered' || value === 'failed' || value === 'manual') {
      return value satisfies CodeDeliveryStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid code delivery status');
    }

    return undefined;
  }

  private parseRefundStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'none' || value === 'refunding' || value === 'refunded') {
      return value satisfies CodeRefundStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid code refund status');
    }

    return undefined;
  }

  private buildOrderBy(
    query: ListCodeOrdersQuery
  ): Prisma.CodePlatformOrderOrderByWithRelationInput[] {
    const sortField = query.sortBy ? CODE_ORDER_SORT_FIELDS[query.sortBy] : undefined;
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

  private parseDeliveryLogStatus(value: unknown, strict: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'success' || value === 'failed' || value === 'pending') {
      return value satisfies CodeDeliveryLogStatus;
    }

    if (strict) {
      throw new BadRequestException('Invalid code delivery log status');
    }

    return undefined;
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

  private getDeliveryLogInclude() {
    return {
      platform: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true
        }
      },
      order: {
        select: {
          id: true,
          externalOrderNo: true,
          deliveryStatus: true
        }
      },
      code: {
        select: {
          id: true,
          codeTail: true,
          status: true
        }
      }
    } satisfies Prisma.CodeDeliveryLogInclude;
  }

  private getOrderInclude() {
    return {
      platform: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          status: true
        }
      },
      service: {
        select: {
          id: true,
          name: true,
          faceValue: true,
          defaultCost: true,
          status: true
        }
      },
      lockedCodes: {
        select: {
          id: true,
          codeTail: true,
          faceValue: true,
          cost: true,
          status: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      deliveredCodes: {
        select: {
          id: true,
          codeTail: true,
          faceValue: true,
          cost: true,
          status: true
        },
        orderBy: {
          deliveredAt: 'asc'
        }
      }
    } satisfies Prisma.CodePlatformOrderInclude;
  }

  private toAuditJson(data: unknown) {
    return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  }

  private toResponse(order: CodeOrderWithRelations) {
    return {
      id: order.id,
      platformId: order.platformId,
      platform: {
        id: order.platform.id,
        name: order.platform.name,
        code: order.platform.code,
        type: order.platform.type,
        status: order.platform.status
      },
      externalOrderNo: order.externalOrderNo,
      buyerId: order.buyerId,
      buyerNameMasked: order.buyerNameMasked,
      itemId: order.itemId,
      skuId: order.skuId,
      itemTitle: order.itemTitle,
      skuName: order.skuName,
      serviceId: order.serviceId,
      service: order.service
        ? {
            id: order.service.id,
            name: order.service.name,
            faceValue: order.service.faceValue.toString(),
            defaultCost: order.service.defaultCost.toString(),
            status: order.service.status
          }
        : null,
      faceValue: order.faceValue?.toString() ?? null,
      quantity: order.quantity,
      paidAmount: order.paidAmount.toString(),
      platformFee: order.platformFee.toString(),
      costAmount: order.costAmount.toString(),
      profitAmount: order.profitAmount.toString(),
      orderStatus: order.orderStatus,
      deliveryStatus: order.deliveryStatus,
      refundStatus: order.refundStatus,
      lockedCodeCount: order.lockedCodes.length,
      deliveredCodeCount: order.deliveredCodes.length,
      lockedCodes: order.lockedCodes.map((code) => ({
        id: code.id,
        codeTail: code.codeTail,
        faceValue: code.faceValue.toString(),
        cost: code.cost.toString(),
        status: code.status
      })),
      deliveredCodes: order.deliveredCodes.map((code) => ({
        id: code.id,
        codeTail: code.codeTail,
        faceValue: code.faceValue.toString(),
        cost: code.cost.toString(),
        status: code.status
      })),
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  private toDeliveryLogResponse(log: CodeDeliveryLogWithRelations) {
    return {
      id: log.id,
      orderId: log.orderId,
      order: {
        id: log.order.id,
        externalOrderNo: log.order.externalOrderNo,
        deliveryStatus: log.order.deliveryStatus
      },
      platformId: log.platformId,
      platform: {
        id: log.platform.id,
        name: log.platform.name,
        code: log.platform.code,
        type: log.platform.type
      },
      externalOrderNo: log.externalOrderNo,
      codeId: log.codeId,
      code: {
        id: log.code.id,
        codeTail: log.code.codeTail,
        status: log.code.status
      },
      faceValue: log.faceValue.toString(),
      deliveryMethod: log.deliveryMethod,
      deliveryContentSnapshot: log.deliveryContentSnapshot,
      deliveryStatus: log.deliveryStatus,
      errorMessage: log.errorMessage,
      cost: log.cost.toString(),
      paidAmount: log.paidAmount.toString(),
      profit: log.profit.toString(),
      createdAt: log.createdAt
    };
  }
}
