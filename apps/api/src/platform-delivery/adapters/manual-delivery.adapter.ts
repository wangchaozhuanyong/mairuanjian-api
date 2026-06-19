import { BadRequestException, Injectable } from '@nestjs/common';
import { CodeOrdersService } from '../../code-orders/code-orders.service';
import type {
  DeliveryAdapter,
  DeliveryAdapterDeliverInput,
  DeliveryAdapterDeliverResult,
  DeliveryAdapterRefundSyncResult,
  DeliveryAdapterSyncResult
} from './delivery-adapter.types';

@Injectable()
export class ManualDeliveryAdapter implements DeliveryAdapter {
  readonly platform = 'manual' as const;

  constructor(private readonly codeOrdersService: CodeOrdersService) {}

  async syncOrders(): Promise<DeliveryAdapterSyncResult> {
    return {
      platform: this.platform,
      supported: true,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: 'Manual platform does not need order sync'
    };
  }

  async deliver(input: DeliveryAdapterDeliverInput): Promise<DeliveryAdapterDeliverResult> {
    if (!input.deliveryContent?.trim()) {
      throw new BadRequestException('deliveryContent is required for manual delivery');
    }

    const order = await this.codeOrdersService.confirmDelivery(
      input.orderId,
      {
        deliveryMethod: input.deliveryMethod ?? 'manual',
        deliveryContent: input.deliveryContent,
        errorMessage: input.reason
      },
      input.operator
    );

    return {
      platform: this.platform,
      supported: true,
      status: 'success',
      message: 'Manual delivery confirmed',
      order
    };
  }

  async syncRefunds(): Promise<DeliveryAdapterRefundSyncResult> {
    return {
      platform: this.platform,
      supported: true,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: 'Manual platform does not need refund sync'
    };
  }
}
