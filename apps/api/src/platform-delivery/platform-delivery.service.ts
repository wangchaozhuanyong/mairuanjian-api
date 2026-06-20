import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManualDeliveryAdapter } from './adapters/manual-delivery.adapter';
import {
  TaobaoDeliveryAdapter,
  XianyuDeliveryAdapter
} from './adapters/unsupported-platform-delivery.adapter';
import type {
  DeliveryAdapter,
  DeliveryAdapterDeliverResult,
  DeliveryAdapterRefundSyncResult,
  DeliveryAdapterSyncResult,
  DeliveryPlatform
} from './adapters/delivery-adapter.types';
import type { PlatformDeliverDto } from './dto/platform-deliver.dto';
import type { PlatformPollDto } from './dto/platform-poll.dto';

type AutoDeliveryPlatform = Extract<DeliveryPlatform, 'taobao' | 'xianyu'>;
type PlatformSyncAction = 'orders' | 'refunds';
type PlatformPollStatus = 'success' | 'failed';

export interface PlatformPollActionResult {
  action: PlatformSyncAction;
  status: PlatformPollStatus;
  supported: boolean;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
}

@Injectable()
export class PlatformDeliveryService {
  private readonly adapters: Record<DeliveryPlatform, DeliveryAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    manualDeliveryAdapter: ManualDeliveryAdapter,
    taobaoDeliveryAdapter: TaobaoDeliveryAdapter,
    xianyuDeliveryAdapter: XianyuDeliveryAdapter
  ) {
    this.adapters = {
      manual: manualDeliveryAdapter,
      taobao: taobaoDeliveryAdapter,
      xianyu: xianyuDeliveryAdapter
    };
  }

  async syncOrders(platform: DeliveryPlatform) {
    return this.runPlatformSyncAction(platform, 'orders', '订单同步', () =>
      this.getAdapter(platform).syncOrders()
    );
  }

  async syncRefunds(platform: DeliveryPlatform) {
    return this.runPlatformSyncAction(platform, 'refunds', '退款同步', () =>
      this.getAdapter(platform).syncRefunds()
    );
  }

  async pollPlatform(
    platform: AutoDeliveryPlatform,
    dto: PlatformPollDto = {},
    operator?: AuthenticatedUser
  ) {
    const includeOrders = dto.includeOrders !== false;
    const includeRefunds = dto.includeRefunds !== false;
    const trigger = this.normalizePollTrigger(dto.trigger);

    if (!includeOrders && !includeRefunds) {
      throw new BadRequestException('At least one poll action is required');
    }

    const startedAt = new Date();
    const jobName = `platform.${platform}.poll`;
    const cronLog = await this.prisma.cronJobLog.create({
      data: {
        jobName,
        status: 'running',
        startedAt,
        metadata: this.toJson({
          platform,
          trigger,
          includeOrders,
          includeRefunds
        })
      }
    });
    const results: PlatformPollActionResult[] = [];

    if (includeOrders) {
      results.push(await this.runPollAction(platform, 'orders'));
    }
    if (includeRefunds) {
      results.push(await this.runPollAction(platform, 'refunds'));
    }

    const finishedAt = new Date();
    const hasFailure = results.some((result) => result.status === 'failed' || !result.supported);
    const status = hasFailure ? 'failed' : 'success';
    const errorMessage = hasFailure
      ? results
          .filter((result) => result.status === 'failed' || !result.supported)
          .map((result) => `${result.action}: ${result.message}`)
          .join('\n')
      : null;
    const updatedCronLog = await this.prisma.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status,
        finishedAt,
        errorMessage,
        metadata: this.toJson({
          platform,
          trigger,
          includeOrders,
          includeRefunds,
          results
        })
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'platform',
      action: 'platform.poll.execute',
      objectType: 'cron_job_log',
      objectId: updatedCronLog.id,
      afterData: this.toJson({
        jobName,
        status,
        platform,
        trigger,
        results
      }),
      remark: `Executed platform polling job ${jobName}`
    });

    return {
      platform,
      trigger,
      status,
      startedAt,
      finishedAt,
      cronLog: updatedCronLog,
      results
    };
  }

  async pollAllPlatforms(dto: PlatformPollDto = {}, operator?: AuthenticatedUser) {
    const [taobao, xianyu] = await Promise.all([
      this.pollPlatform('taobao', dto, operator),
      this.pollPlatform('xianyu', dto, operator)
    ]);

    return {
      status: taobao.status === 'success' && xianyu.status === 'success' ? 'success' : 'failed',
      items: [taobao, xianyu]
    };
  }

  async getOrderByExternalNo(
    platform: Extract<DeliveryPlatform, 'taobao' | 'xianyu'>,
    externalOrderNo: string
  ) {
    const normalizedExternalOrderNo = this.normalizeRequiredString(
      externalOrderNo,
      'externalOrderNo'
    );
    const order = await this.prisma.codePlatformOrder.findFirst({
      where: {
        externalOrderNo: normalizedExternalOrderNo
      },
      include: {
        platform: {
          select: {
            id: true,
            name: true,
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
          }
        },
        deliveredCodes: {
          select: {
            id: true,
            codeTail: true,
            faceValue: true,
            cost: true,
            status: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Platform code order not found');
    }

    return {
      id: order.id,
      platformId: order.platformId,
      platform: order.platform,
      externalOrderNo: order.externalOrderNo,
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

  async deliver(
    platform: DeliveryPlatform,
    orderId: string,
    dto: PlatformDeliverDto,
    operator?: AuthenticatedUser
  ) {
    const normalizedOrderId = this.normalizeRequiredUuid(orderId, 'orderId');
    const order = await this.prisma.codePlatformOrder.findUnique({
      where: { id: normalizedOrderId },
      select: {
        id: true
      }
    });

    if (!order) {
      throw new NotFoundException('Code order not found');
    }

    const result = await this.getAdapter(platform).deliver({
      orderId: normalizedOrderId,
      deliveryContent: dto.deliveryContent,
      deliveryMethod: dto.deliveryMethod,
      reason: dto.reason,
      operator
    });
    await this.notifyPlatformDeliveryResult(platform, normalizedOrderId, result);
    return result;
  }

  private async notifyPlatformSyncResult(
    platform: DeliveryPlatform,
    action: string,
    result: DeliveryAdapterSyncResult | DeliveryAdapterRefundSyncResult
  ) {
    if (platform === 'manual' || (result.supported && result.failedCount === 0)) {
      return;
    }

    const eventCode =
      platform === 'taobao' ? 'platform.taobao.sync_failed' : 'platform.xianyu.sync_failed';
    const platformLabel = this.getPlatformLabel(platform);
    await this.notificationsService.triggerEvent({
      eventCode,
      module: 'platform',
      title: `${platformLabel}${action}失败`,
      content: result.message,
      payload: {
        title: `${platformLabel}${action}失败`,
        summary: result.message,
        detail: `同步数量 ${result.syncedCount}，跳过 ${result.skippedCount}，失败 ${result.failedCount}。`,
        platform,
        action,
        supported: result.supported,
        syncedCount: result.syncedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount
      }
    });
  }

  private async notifyPlatformSyncException(
    platform: DeliveryPlatform,
    action: string,
    error: unknown
  ) {
    if (platform === 'manual') {
      return;
    }

    const message = error instanceof Error ? error.message : 'Platform sync failed';
    const eventCode =
      platform === 'taobao' ? 'platform.taobao.sync_failed' : 'platform.xianyu.sync_failed';
    const platformLabel = this.getPlatformLabel(platform);
    await this.notificationsService.triggerEvent({
      eventCode,
      module: 'platform',
      title: `${platformLabel}${action}异常`,
      content: message,
      payload: {
        title: `${platformLabel}${action}异常`,
        summary: message,
        detail: '请检查平台授权、接口配置和最近接口日志。',
        platform,
        action
      }
    });
  }

  private async notifyPlatformDeliveryResult(
    platform: DeliveryPlatform,
    orderId: string,
    result: DeliveryAdapterDeliverResult
  ) {
    if (platform === 'manual' || (result.supported && result.status === 'success')) {
      return;
    }

    const platformLabel = this.getPlatformLabel(platform);
    await this.notificationsService.triggerEvent({
      eventCode: 'platform.delivery_api.abnormal',
      module: 'platform',
      title: `${platformLabel}发货接口异常`,
      content: result.message,
      payload: {
        title: `${platformLabel}发货接口异常`,
        summary: result.message,
        detail: '订单已进入人工处理或需要检查平台发货接口配置。',
        platform,
        orderId,
        supported: result.supported,
        status: result.status
      }
    });
  }

  private async runPlatformSyncAction<
    TResult extends DeliveryAdapterSyncResult | DeliveryAdapterRefundSyncResult
  >(
    platform: DeliveryPlatform,
    actionType: PlatformSyncAction,
    actionLabel: string,
    action: () => Promise<TResult>
  ) {
    const startedAt = new Date();
    try {
      const result = await action();
      await this.recordPlatformSyncLog(platform, actionType, startedAt, result);
      await this.notifyPlatformSyncResult(platform, actionLabel, result);
      return result;
    } catch (error) {
      await this.recordPlatformSyncException(platform, actionType, startedAt, error);
      await this.notifyPlatformSyncException(platform, actionLabel, error);
      throw error;
    }
  }

  private async runPollAction(
    platform: AutoDeliveryPlatform,
    action: PlatformSyncAction
  ): Promise<PlatformPollActionResult> {
    try {
      const result =
        action === 'orders' ? await this.syncOrders(platform) : await this.syncRefunds(platform);
      return {
        action,
        status: result.supported && result.failedCount === 0 ? 'success' : 'failed',
        supported: result.supported,
        syncedCount: result.syncedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        message: result.message
      };
    } catch (error) {
      return {
        action,
        status: 'failed',
        supported: false,
        syncedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        message: this.getErrorMessage(error, 'Platform poll action failed')
      };
    }
  }

  private async recordPlatformSyncLog(
    platform: DeliveryPlatform,
    actionType: PlatformSyncAction,
    startedAt: Date,
    result: DeliveryAdapterSyncResult | DeliveryAdapterRefundSyncResult
  ) {
    if (platform === 'manual') return;
    const finishedAt = new Date();
    const requestCount = this.getSyncRequestCount(result);
    const hasFailure = !result.supported || result.failedCount > 0;
    await this.prisma.platformSyncLog.create({
      data: {
        platform,
        syncType: actionType === 'orders' ? 'sync_orders' : 'sync_refunds',
        status: hasFailure ? 'failed' : 'success',
        requestCount,
        errorRate: new PrismaNamespace.Decimal(this.getSyncErrorRate(result, requestCount)),
        errorMessage: hasFailure ? result.message : null,
        startedAt,
        finishedAt,
        metadata: this.toJson({
          platform,
          actionType,
          supported: result.supported,
          syncedCount: result.syncedCount,
          skippedCount: result.skippedCount,
          failedCount: result.failedCount,
          message: result.message
        })
      }
    });
  }

  private async recordPlatformSyncException(
    platform: DeliveryPlatform,
    actionType: PlatformSyncAction,
    startedAt: Date,
    error: unknown
  ) {
    if (platform === 'manual') return;
    const message = this.getErrorMessage(error, 'Platform sync failed');
    await this.prisma.platformSyncLog.create({
      data: {
        platform,
        syncType: actionType === 'orders' ? 'sync_orders' : 'sync_refunds',
        status: 'failed',
        requestCount: 1,
        errorRate: new PrismaNamespace.Decimal(1),
        errorMessage: message,
        startedAt,
        finishedAt: new Date(),
        metadata: this.toJson({
          platform,
          actionType,
          supported: false,
          message
        })
      }
    });
  }

  private getSyncRequestCount(result: DeliveryAdapterSyncResult | DeliveryAdapterRefundSyncResult) {
    const total = result.syncedCount + result.skippedCount + result.failedCount;
    return Math.max(1, total);
  }

  private getSyncErrorRate(
    result: DeliveryAdapterSyncResult | DeliveryAdapterRefundSyncResult,
    requestCount: number
  ) {
    if (!result.supported) return 1;
    if (requestCount <= 0) return result.failedCount > 0 ? 1 : 0;
    return Math.min(1, Math.max(0, result.failedCount / requestCount));
  }

  private normalizePollTrigger(value: PlatformPollDto['trigger']) {
    if (!value) return 'manual';
    if (value === 'manual' || value === 'cron' || value === 'worker' || value === 'system') {
      return value;
    }
    throw new BadRequestException('trigger is invalid');
  }

  private getAdapter(platform: DeliveryPlatform) {
    return this.adapters[platform];
  }

  private getPlatformLabel(platform: DeliveryPlatform) {
    if (platform === 'taobao') {
      return '淘宝';
    }
    if (platform === 'xianyu') {
      return '闲鱼';
    }
    return '手工';
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

  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  private toJson(value: unknown) {
    return value as PrismaNamespace.InputJsonValue;
  }
}
