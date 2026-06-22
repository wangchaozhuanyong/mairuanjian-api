import type { CheckOfficialPriceSourceDto } from './check-official-price-source.dto';

export interface OfficialPriceProviderRegionDto {
  currency?: string;
  region?: string;
  sourceUrl?: string | null;
}

export interface CheckOfficialPriceProviderDto {
  regions?: OfficialPriceProviderRegionDto[];
  scanRemovedPlans?: boolean;
  trigger?: CheckOfficialPriceSourceDto['trigger'];
}
