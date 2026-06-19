import type { NotificationLevel } from '@prisma/client';

export interface SaveTelegramConfigDto {
  notificationName: string;
  enabled?: boolean;
  botToken?: string | null;
  chatId: string;
  notificationLevel?: NotificationLevel;
  silentStartTime?: string | null;
  silentEndTime?: string | null;
  retryCount?: number;
}
