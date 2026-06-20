import type { AppleAccountStatus } from '@prisma/client';

export interface UpdateAppleAccountDto {
  appleId?: string;
  region?: string;
  currency?: string;
  currentBalance?: string | number;
  balanceCostAmount?: string | number;
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
