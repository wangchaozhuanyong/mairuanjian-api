export interface CreateCodePlatformMappingDto {
  platformId: string;
  shopId?: string | null;
  platformItemId: string;
  platformSkuId?: string | null;
  skuKeyword?: string | null;
  serviceId: string;
  faceValue?: string | number;
  quantity?: number;
  deliveryTemplateId?: string | null;
  enabled?: boolean;
}
