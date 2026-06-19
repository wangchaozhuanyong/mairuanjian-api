import type { AppleBalanceAdjustmentCostMethod } from '@prisma/client';

export interface CreateAppleBalanceAdjustmentDto {
  newBalance: string | number;
  costAdjustMethod: AppleBalanceAdjustmentCostMethod;
  newCostRmb?: string | number | null;
  reason: string;
  evidenceAttachmentId?: string | null;
}
