export interface CreateCodeAfterSaleDto {
  orderId: string;
  originalCodeId?: string | null;
  reason: string;
}
