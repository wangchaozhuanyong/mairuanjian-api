import type { NotificationLevel } from '@prisma/client';

export interface SaveNotificationRuleDto {
  name: string;
  eventCode: string;
  module: string;
  level?: NotificationLevel;
  enabled?: boolean;
  channels?: string[];
  recipients?: Record<string, unknown> | null;
  triggerCondition?: Record<string, unknown> | null;
  rateLimit?: Record<string, unknown> | null;
}
