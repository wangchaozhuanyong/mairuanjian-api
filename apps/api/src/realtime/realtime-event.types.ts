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

export interface RealtimeEventScope {
  appleAccountId?: string | null;
  customerId?: string | null;
  platform?: string | null;
  orderId?: string | null;
  notificationId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface RealtimeEvent {
  id: string;
  type: string;
  module: RealtimeEventModule;
  entity: string;
  action: string;
  resourceId?: string | null;
  scope?: RealtimeEventScope;
  occurredAt: string;
}

export interface PublishRealtimeEventInput {
  type: string;
  module: RealtimeEventModule;
  entity: string;
  action: string;
  resourceId?: string | null;
  scope?: RealtimeEventScope;
}

export interface RealtimeSseMessage {
  id?: string;
  type?: string;
  data: RealtimeEvent;
  retry?: number;
}
