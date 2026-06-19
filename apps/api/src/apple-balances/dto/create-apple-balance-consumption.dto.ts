export interface CreateAppleBalanceConsumptionDto {
  amount: string | number;
  reason?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  remark?: string | null;
}
