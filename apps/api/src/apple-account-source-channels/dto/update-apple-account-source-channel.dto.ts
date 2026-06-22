import type { AppleAccountSourceChannelStatus } from '@prisma/client';

export interface UpdateAppleAccountSourceChannelDto {
  name?: string;
  status?: AppleAccountSourceChannelStatus;
  remark?: string | null;
}
