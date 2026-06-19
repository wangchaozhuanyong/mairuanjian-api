import type { CodeDeliveryMethod } from '@prisma/client';

export interface ConfirmCodeDeliveryDto {
  deliveryMethod?: CodeDeliveryMethod;
  deliveryContent: string;
  errorMessage?: string | null;
}
