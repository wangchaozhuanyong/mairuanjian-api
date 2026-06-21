import type { AppleServicePeriodType } from '@prisma/client';

export interface OfficialPriceCollectedItemDto {
  appleServiceId?: string | null;
  serviceName?: string;
  category?: string | null;
  region?: string | null;
  currency?: string | null;
  officialPrice?: string | number;
  periodType?: AppleServicePeriodType;
  periodValue?: number | string;
  rawPayload?: Record<string, unknown> | null;
}

export interface CheckOfficialPriceSourceDto {
  trigger?: 'manual' | 'worker' | 'system';
  items?: OfficialPriceCollectedItemDto[];
  scanRemovedPlans?: boolean;
  remark?: string | null;
}
