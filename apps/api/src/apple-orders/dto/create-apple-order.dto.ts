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
  paidCurrency?: string;
  paidExchangeRateToRmb?: string | number;
  platformFee?: string | number;
  refundLoss?: string | number;
  appleCostValue?: string | number;
  appleAccountOwnershipType?: 'consigned' | 'sold';
  remark?: string | null;
}
