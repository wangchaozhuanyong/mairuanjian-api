import type { CodeDeliveryMethod } from '@prisma/client';

export interface PlatformDeliverDto {
  deliveryContent?: string | null;
  deliveryMethod?: CodeDeliveryMethod;
  reason?: string | null;
}
