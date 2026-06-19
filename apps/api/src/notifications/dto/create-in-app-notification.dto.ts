import type { NotificationLogStatus } from '@prisma/client';

export interface CreateInAppNotificationDto {
  eventCode: string;
  module: string;
  title: string;
  content: string;
  recipient?: string | null;
  recipientUserId?: string | null;
  payload?: Record<string, unknown> | null;
  status?: NotificationLogStatus;
}
