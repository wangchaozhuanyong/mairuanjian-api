import type { AppleAccountOwnershipType, AppleAccountStatus } from '@prisma/client';

export interface CreateAppleAccountDto {
  appleId: string;
  region?: string;
  currency?: string;
  currentBalance?: string | number;
  balanceCostAmount?: string | number;
  ownershipType?: AppleAccountOwnershipType;
  purchaseCost?: string | number;
  salePrice?: string | number;
  sourceChannelId?: string | null;
  sourcePlatformId?: string | null;
  status?: AppleAccountStatus;
  isManuallyLocked?: boolean;
  manualLockReason?: string | null;
  password?: string | null;
  securityInfo?: string | null;
  phone?: string | null;
  recoveryEmail?: string | null;
  remark?: string | null;
}
