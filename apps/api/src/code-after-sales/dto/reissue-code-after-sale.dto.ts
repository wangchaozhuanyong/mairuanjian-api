import type { CodeDeliveryMethod } from '@prisma/client';

export interface ReissueCodeAfterSaleDto {
  newCodeId?: string | null;
  deliveryMethod?: CodeDeliveryMethod;
  deliveryContent?: string | null;
  reason?: string | null;
}
