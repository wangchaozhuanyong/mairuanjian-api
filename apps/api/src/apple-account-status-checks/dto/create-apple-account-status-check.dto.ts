import type { AppleAccountStatus, AppleAccountStatusCheckType } from '@prisma/client';

export interface CreateAppleAccountStatusCheckDto {
  checkType?: AppleAccountStatusCheckType;
  resultStatus: AppleAccountStatus;
  balanceSnapshot?: string | number | null;
  remark?: string | null;
  evidenceAttachmentId?: string | null;
}
