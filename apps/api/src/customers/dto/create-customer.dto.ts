import type { CustomerStatus } from '@prisma/client';

export interface CreateCustomerDto {
  name: string;
  phone?: string | null;
  wechat?: string | null;
  sourcePlatformId?: string | null;
  tags?: string[];
  remark?: string | null;
  status?: CustomerStatus;
}
