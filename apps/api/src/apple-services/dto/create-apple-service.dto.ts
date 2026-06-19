import type {
  AppleServiceExpireCalcType,
  AppleServiceLockRule,
  AppleServicePeriodType,
  AppleServiceStatus
} from '@prisma/client';

export interface CreateAppleServiceDto {
  name: string;
  category?: string;
  defaultPrice?: string | number;
  officialCostValue?: string | number;
  currency?: string;
  defaultPeriodType?: AppleServicePeriodType;
  defaultPeriodValue?: number;
  expireCalcType?: AppleServiceExpireCalcType;
  requireAppleId?: boolean;
  requireServiceAccount?: boolean;
  autoMatchAppleId?: boolean;
  lockRule?: AppleServiceLockRule;
  allowedRegions?: string[];
  minBalanceRequired?: string | number;
  status?: AppleServiceStatus;
  remark?: string | null;
}
