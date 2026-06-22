import type {
  AppleBalancePriceRuleType,
  AppleServiceExpireCalcType,
  AppleServiceLockRule,
  AppleServicePeriodType,
  AppleServiceStatus
} from '@prisma/client';

export interface CreateAppleServiceDto {
  name: string;
  category?: string;
  defaultPrice?: string | number;
  officialBasePrice?: string | number;
  officialCostValue?: string | number;
  appleBalancePriceRuleType?: AppleBalancePriceRuleType;
  appleBalancePriceRuleValue?: string | number | null;
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

export interface SaveAppleBalancePriceRuleDto {
  ruleType?: AppleBalancePriceRuleType;
  ruleValue?: string | number | null;
}
