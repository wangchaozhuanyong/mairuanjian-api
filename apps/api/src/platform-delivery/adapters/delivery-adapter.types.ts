import type { CodeDeliveryMethod, SourcePlatformType } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/auth.types';

export type DeliveryPlatform = Extract<SourcePlatformType, 'taobao' | 'xianyu' | 'manual'>;

export interface DeliveryAdapterSyncResult {
  platform: DeliveryPlatform;
  supported: boolean;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
}

export interface DeliveryAdapterRefundSyncResult {
  platform: DeliveryPlatform;
  supported: boolean;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
}

export interface DeliveryAdapterDeliverInput {
  orderId: string;
  deliveryContent?: string | null;
  deliveryMethod?: CodeDeliveryMethod;
  reason?: string | null;
  operator?: AuthenticatedUser;
}

export interface DeliveryAdapterDeliverResult {
  platform: DeliveryPlatform;
  supported: boolean;
  status: 'success' | 'manual_required' | 'unsupported';
  message: string;
  order?: unknown;
}

export interface DeliveryAdapter {
  readonly platform: DeliveryPlatform;
  syncOrders(): Promise<DeliveryAdapterSyncResult>;
  deliver(input: DeliveryAdapterDeliverInput): Promise<DeliveryAdapterDeliverResult>;
  syncRefunds(): Promise<DeliveryAdapterRefundSyncResult>;
}
