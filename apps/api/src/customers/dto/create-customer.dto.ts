import type { CustomerStatus } from '@prisma/client';

export interface CreateCustomerDto {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  wechat?: string | null;
  sourcePlatformId?: string | null;
  tags?: string[];
  remark?: string | null;
  status?: CustomerStatus;
}
