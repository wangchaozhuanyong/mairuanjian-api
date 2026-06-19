export interface PlatformPollDto {
  includeOrders?: boolean;
  includeRefunds?: boolean;
  trigger?: 'manual' | 'cron' | 'worker' | 'system';
}
