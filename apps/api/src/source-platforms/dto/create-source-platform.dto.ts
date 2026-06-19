import type { SourcePlatformStatus, SourcePlatformType } from '@prisma/client';

export interface CreateSourcePlatformDto {
  name: string;
  code: string;
  type?: SourcePlatformType;
  feeRate?: string | number;
  feeFixed?: string | number;
  syncEnabled?: boolean;
  deliveryEnabled?: boolean;
  status?: SourcePlatformStatus;
  remark?: string | null;
}
