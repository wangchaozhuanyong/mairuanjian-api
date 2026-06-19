export interface SaveNotificationTemplateDto {
  name: string;
  eventCode: string;
  ruleId?: string | null;
  channel: 'telegram' | 'system';
  title: string;
  content: string;
  variables?: Array<string | Record<string, unknown>>;
  enabled?: boolean;
}
