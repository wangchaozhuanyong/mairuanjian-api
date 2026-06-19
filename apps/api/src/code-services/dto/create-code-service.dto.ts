import type { CodeDeliveryMode, CodeServiceStatus } from '@prisma/client';

export interface CreateCodeServiceDto {
  name: string;
  faceValue: string | number;
  defaultPrice?: string | number;
  defaultCost?: string | number;
  deliveryMode?: CodeDeliveryMode;
  exactFaceValueOnly?: boolean;
  allowCombination?: boolean;
  status?: CodeServiceStatus;
  remark?: string | null;
}
