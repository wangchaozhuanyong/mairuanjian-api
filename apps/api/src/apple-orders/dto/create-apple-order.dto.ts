export interface CreateAppleOrderDto {
  customerId: string;
  sourcePlatformId?: string | null;
  externalOrderNo?: string | null;
  serviceId: string;
  appleAccountId?: string | null;
  serviceAccount?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  paidAmount?: string | number;
  platformFee?: string | number;
  refundLoss?: string | number;
  appleCostValue?: string | number;
  remark?: string | null;
}
