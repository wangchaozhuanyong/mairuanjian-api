import type { AppleServicePlatformFeeType } from '@prisma/client';

export interface CreateAppleServicePlatformMappingDto {
  sourcePlatformId: string;
  shopName?: string | null;
  platformItemId: string;
  platformSkuId?: string | null;
  skuKeyword?: string | null;
  platformPrice?: string | number;
  platformFeeType?: AppleServicePlatformFeeType;
  platformFeeValue?: string | number;
  allowAutoOrder?: boolean;
  enabled?: boolean;
}
