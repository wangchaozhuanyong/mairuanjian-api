import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { interval, map, merge, Observable, of, Subject, filter } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types';
import type {
  PublishRealtimeEventInput,
  RealtimeEvent,
  RealtimeEventModule,
  RealtimeSseMessage
} from './realtime-event.types';

const HEARTBEAT_INTERVAL_MS = 25_000;

const modulePermissionHints: Record<RealtimeEventModule, string[]> = {
  apple: ['apple.account.view', 'apple.renewal_task.view', 'apple.order.view'],
  code: ['code.inventory.view', 'code.order.view', 'code.delivery.view', 'code.service.manage'],
  common: ['customer.view', 'source_platform.view', 'attachment.view'],
  data: ['data.overview.view', 'data.backup.view', 'data.export.view'],
  maintenance: [
    'maintenance.announcement.view',
    'maintenance.mode.view',
    'maintenance.version.view'
  ],
  notification: ['notification.view', 'notification.log.view'],
  ops: ['ops.overview.view', 'ops.platform_sync.view'],
  platform: ['ops.platform_sync.view', 'code.order.view'],
  security: ['security.login_log.view', 'security.sensitive_access.view'],
  system: ['notification.view', 'ops.overview.view', 'system.user_manage', 'system.role_manage']
};

@Injectable()
export class RealtimeService {
  private readonly events = new Subject<RealtimeEvent>();

  streamFor(user: AuthenticatedUser): Observable<RealtimeSseMessage> {
    return merge(
      of(this.toMessage(this.createSystemEvent('system.connected', 'connection', 'connected'))),
      this.events.pipe(
        filter((event) => this.canReceiveEvent(user, event)),
        map((event) => this.toMessage(event))
      ),
      interval(HEARTBEAT_INTERVAL_MS).pipe(
        map(() =>
          this.toMessage(this.createSystemEvent('system.heartbeat', 'connection', 'heartbeat'))
        )
      )
    );
  }

  publish(input: PublishRealtimeEventInput) {
    const event: RealtimeEvent = {
      id: randomUUID(),
      type: input.type,
      module: input.module,
      entity: input.entity,
      action: input.action,
      resourceId: input.resourceId ?? null,
      scope: input.scope,
      occurredAt: new Date().toISOString()
    };

    this.events.next(event);
    return event;
  }

  private createSystemEvent(type: string, entity: string, action: string): RealtimeEvent {
    return {
      id: randomUUID(),
      type,
      module: 'system',
      entity,
      action,
      occurredAt: new Date().toISOString()
    };
  }

  private toMessage(event: RealtimeEvent): RealtimeSseMessage {
    return {
      id: event.id,
      data: event,
      retry: 5000
    };
  }

  private canReceiveEvent(user: AuthenticatedUser, event: RealtimeEvent) {
    if (user.roles.includes('admin')) {
      return true;
    }

    const permissionHints = modulePermissionHints[event.module] ?? [];
    const permissionSet = new Set(user.permissions);

    return permissionHints.some((permission) => permissionSet.has(permission));
  }
}
