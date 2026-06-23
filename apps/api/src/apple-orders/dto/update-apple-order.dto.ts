import type { AppleOrderStatus } from '@prisma/client';

export interface UpdateAppleOrderDto {
  externalOrderNo?: string | null;
  serviceAccount?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  paidAmount?: string | number;
  paidCurrency?: string;
  paidExchangeRateToRmb?: string | number;
  platformFee?: string | number;
  refundLoss?: string | number;
  status?: AppleOrderStatus;
  remark?: string | null;
}
