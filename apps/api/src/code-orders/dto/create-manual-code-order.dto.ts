export interface CreateManualCodeOrderDto {
  platformId: string;
  externalOrderNo: string;
  buyerId?: string | null;
  buyerNameMasked?: string | null;
  itemId: string;
  skuId?: string | null;
  itemTitle?: string | null;
  skuName?: string | null;
  serviceId?: string | null;
  faceValue?: string | number | null;
  quantity?: number;
  paidAmount?: string | number;
  platformFee?: string | number;
  orderStatus?: string;
  paidAt?: string | null;
}
