import type { AppleAccountStatus } from '@prisma/client';

export interface ImportAppleAccountItemDto {
  appleId: string;
  region?: string;
  currency?: string;
  currentBalance?: string | number;
  balanceCostAmount?: string | number;
  status?: AppleAccountStatus;
  isManuallyLocked?: boolean | string | null;
  manualLockReason?: string | null;
  password?: string | null;
  securityInfo?: string | null;
  phone?: string | null;
  recoveryEmail?: string | null;
  remark?: string | null;
}

export interface ImportAppleAccountsDto {
  accounts: Array<string | ImportAppleAccountItemDto>;
}
