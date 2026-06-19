import type { UserStatus } from '@prisma/client';

export interface UpdateUserDto {
  displayName?: string;
  phone?: string | null;
  email?: string | null;
  status?: UserStatus;
  password?: string;
  roleIds?: string[];
}
