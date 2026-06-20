import type { RealtimeEvent } from './realtimeTypes';
import { markSmartQueriesStale } from '@/utils/smartQuery';

export const REALTIME_QUERY_INVALIDATED_EVENT = 'apple-business:realtime-query-invalidated';

export interface RealtimeQueryInvalidatedDetail {
  event: RealtimeEvent;
  scopes: string[];
  reason?: 'push' | 'fallback-poll' | 'manual';
}

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
