export type RealtimeEventModule =
  | 'apple'
  | 'code'
  | 'common'
  | 'data'
  | 'maintenance'
  | 'notification'
  | 'ops'
  | 'platform'
  | 'security'
  | 'system';

export interface RealtimeEvent {
  id: string;
  type: string;
  module: RealtimeEventModule;
  entity: string;
  action: string;
  resourceId?: string | null;
  scope?: Record<string, string | number | boolean | null | undefined>;
  occurredAt: string;
}
