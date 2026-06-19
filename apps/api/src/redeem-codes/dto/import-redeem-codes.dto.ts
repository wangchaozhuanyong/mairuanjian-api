export interface ImportRedeemCodeItemDto {
  code: string;
  cost?: string | number | null;
  remark?: string | null;
  expireAt?: string | null;
}

export interface ImportRedeemCodesDto {
  serviceId: string;
  batchNo?: string | null;
  defaultCost?: string | number | null;
  remark?: string | null;
  expireAt?: string | null;
  codes: Array<string | ImportRedeemCodeItemDto>;
}
