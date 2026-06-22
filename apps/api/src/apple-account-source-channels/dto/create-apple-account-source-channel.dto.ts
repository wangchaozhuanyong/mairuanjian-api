import type { AppleAccountSourceChannelStatus } from '@prisma/client';

export interface CreateAppleAccountSourceChannelDto {
  name: string;
  status?: AppleAccountSourceChannelStatus;
  remark?: string | null;
}
