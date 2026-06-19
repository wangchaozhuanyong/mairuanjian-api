import { Injectable } from '@nestjs/common';
import { CodeOrdersService } from '../../code-orders/code-orders.service';
import type {
  DeliveryAdapter,
  DeliveryAdapterDeliverInput,
  DeliveryAdapterDeliverResult,
  DeliveryAdapterRefundSyncResult,
  DeliveryAdapterSyncResult,
  DeliveryPlatform
} from './delivery-adapter.types';

abstract class UnsupportedPlatformDeliveryAdapter implements DeliveryAdapter {
  abstract readonly platform: Extract<DeliveryPlatform, 'taobao' | 'xianyu'>;
  abstract readonly displayName: string;

  constructor(private readonly codeOrdersService: CodeOrdersService) {}

  async syncOrders(): Promise<DeliveryAdapterSyncResult> {
    return {
      platform: this.platform,
      supported: false,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: `${this.displayName}订单同步接口尚未接入，当前只保留占位结构`
    };
  }

  async deliver(input: DeliveryAdapterDeliverInput): Promise<DeliveryAdapterDeliverResult> {
    const reason =
      input.reason?.trim() || `${this.displayName}自动发货接口尚未接入，订单已转入人工处理`;
    const order = await this.codeOrdersService.markManual(
      input.orderId,
      {
        reason
      },
      input.operator
    );

    return {
      platform: this.platform,
      supported: false,
      status: 'manual_required',
      message: reason,
      order
    };
  }

  async syncRefunds(): Promise<DeliveryAdapterRefundSyncResult> {
    return {
      platform: this.platform,
      supported: false,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: `${this.displayName}退款同步接口尚未接入，当前只保留占位结构`
    };
  }
}

@Injectable()
export class TaobaoDeliveryAdapter extends UnsupportedPlatformDeliveryAdapter {
  readonly platform = 'taobao' as const;
  readonly displayName = '淘宝';
}

@Injectable()
export class XianyuDeliveryAdapter extends UnsupportedPlatformDeliveryAdapter {
  readonly platform = 'xianyu' as const;
  readonly displayName = '闲鱼';
}
