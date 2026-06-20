import type { SourcePlatformStatus } from '@prisma/client';

export interface CreateSourcePlatformDto {
  name: string;
  feeRate?: string | number;
  feeFixed?: string | number;
  status?: SourcePlatformStatus;
  remark?: string | null;
}
