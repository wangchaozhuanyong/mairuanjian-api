import type {
  AppleOfficialPriceCollectMethod,
  AppleOfficialPriceSourceStatus
} from '@prisma/client';

export interface CreateOfficialPriceSourceDto {
  name?: string;
  provider?: string;
  priceSourceType?: string;
  region?: string;
  currency?: string;
  sourceUrl?: string | null;
  collectMethod?: AppleOfficialPriceCollectMethod;
  checkIntervalHours?: number | string;
  status?: AppleOfficialPriceSourceStatus;
  remark?: string | null;
}
