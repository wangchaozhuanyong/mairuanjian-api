import type { RealtimeEvent } from './realtimeTypes';
import { markSmartQueriesStale } from '@/utils/smartQuery';

export const REALTIME_QUERY_INVALIDATED_EVENT = 'apple-business:realtime-query-invalidated';
const INVALIDATION_DISPATCH_DEBOUNCE_MS = 160;

interface PendingInvalidationDispatch {
  event: RealtimeEvent;
  reason: RealtimeQueryInvalidatedDetail['reason'];
  scopes: string[];
  timer: number;
}

export interface RealtimeQueryInvalidatedDetail {
  event: RealtimeEvent;
  scopes: string[];
  reason?: 'push' | 'fallback-poll' | 'manual' | 'route-enter';
}

const pendingInvalidationDispatches = new Map<string, PendingInvalidationDispatch>();

export function notifyRealtimeQueryInvalidated(
  event: RealtimeEvent,
  scopes: string[],
  reason: RealtimeQueryInvalidatedDetail['reason'] = 'push'
) {
  dispatchRealtimeQueryInvalidated(event, scopes, reason);
}

export function notifyRealtimeScopesInvalidated(
  scopes: string[],
  reason: RealtimeQueryInvalidatedDetail['reason'] = 'fallback-poll'
) {
  if (!scopes.length) {
    return;
  }

  for (const scope of scopes) {
    markSmartQueriesStale(scope);
  }

  dispatchRealtimeQueryInvalidated(
    {
      id: `fallback-${Date.now()}`,
      type: 'system.fallback_poll',
      module: 'system',
      entity: 'fallback_poll',
      action: 'refresh',
      occurredAt: new Date().toISOString()
    },
    scopes,
    reason
  );
}

function dispatchRealtimeQueryInvalidated(
  event: RealtimeEvent,
  scopes: string[],
  reason: RealtimeQueryInvalidatedDetail['reason']
) {
  if (reason !== 'manual') {
    const normalizedScopes = [...new Set(scopes)].sort();
    const batchKey = `${reason}:${normalizedScopes.join('|')}`;
    const pending = pendingInvalidationDispatches.get(batchKey);

    if (pending) {
      pending.event = event;
      pending.scopes = normalizedScopes;
      return;
    }

    const timer = window.setTimeout(() => {
      const next = pendingInvalidationDispatches.get(batchKey);
      pendingInvalidationDispatches.delete(batchKey);

      if (next) {
        emitRealtimeQueryInvalidated(next.event, next.scopes, next.reason);
      }
    }, INVALIDATION_DISPATCH_DEBOUNCE_MS);

    pendingInvalidationDispatches.set(batchKey, {
      event,
      reason,
      scopes: normalizedScopes,
      timer
    });
    return;
  }

  emitRealtimeQueryInvalidated(event, scopes, reason);
}

function emitRealtimeQueryInvalidated(
  event: RealtimeEvent,
  scopes: string[],
  reason: RealtimeQueryInvalidatedDetail['reason']
) {
  window.dispatchEvent(
    new CustomEvent<RealtimeQueryInvalidatedDetail>(REALTIME_QUERY_INVALIDATED_EVENT, {
      detail: {
        event,
        scopes,
        reason
      }
    })
  );
}

export function onRealtimeQueryInvalidated(
  scopes: string[],
  callback: (detail: RealtimeQueryInvalidatedDetail) => void
) {
  const scopeSet = new Set(scopes);
  const listener = (rawEvent: Event) => {
    const event = rawEvent as CustomEvent<RealtimeQueryInvalidatedDetail>;
    const detail = event.detail;

    if (!detail?.scopes?.some((scope) => scopeSet.has(scope))) {
      return;
    }

    callback(detail);
  };

  window.addEventListener(REALTIME_QUERY_INVALIDATED_EVENT, listener);

  return () => {
    window.removeEventListener(REALTIME_QUERY_INVALIDATED_EVENT, listener);
  };
}
