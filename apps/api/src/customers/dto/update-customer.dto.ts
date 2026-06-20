import type { CustomerStatus } from '@prisma/client';

export interface UpdateCustomerDto {
  name?: string;
  phone?: string | null;
  wechat?: string | null;
  sourcePlatformId?: string | null;
  tags?: string[];
  remark?: string | null;
  status?: CustomerStatus;
}
