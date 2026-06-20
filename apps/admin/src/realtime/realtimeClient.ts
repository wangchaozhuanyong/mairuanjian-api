import { handleRealtimeEvent } from './realtimeEventRouter';
import type { RealtimeEvent } from './realtimeTypes';

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export const REALTIME_CONNECTION_STATUS_CHANGED_EVENT =
  'apple-business:realtime-connection-status-changed';

export interface RealtimeConnectionStatusDetail {
  status: RealtimeConnectionStatus;
  retryAttempt: number;
}

let eventSource: EventSource | null = null;
let activeToken = '';
let status: RealtimeConnectionStatus = 'disconnected';
let reconnectTimer: number | undefined;
let retryAttempt = 0;

export function connectRealtime(token: string) {
  if (!token || (eventSource && activeToken === token)) {
    return;
  }

  disconnectRealtime();

  activeToken = token;
  retryAttempt = 0;
  openRealtimeConnection();
}

export function disconnectRealtime() {
  clearRealtimeReconnectTimer();
  eventSource?.close();
  eventSource = null;
  activeToken = '';
  retryAttempt = 0;
  setRealtimeStatus('disconnected');
}

export function getRealtimeStatus() {
  return status;
}

export function getRealtimeSnapshot(): RealtimeConnectionStatusDetail {
  return {
    status,
    retryAttempt
  };
}

function openRealtimeConnection() {
  if (!activeToken) {
    return;
  }

  clearRealtimeReconnectTimer();
  eventSource?.close();
  setRealtimeStatus('connecting');
  eventSource = new EventSource(getRealtimeEventsUrl(activeToken));

  eventSource.onopen = () => {
    retryAttempt = 0;
    setRealtimeStatus('connected');
  };

  eventSource.onerror = () => {
    setRealtimeStatus('error');
    scheduleRealtimeReconnect();
  };

  eventSource.onmessage = (message) => {
    const event = parseRealtimeEvent(message.data);

    if (event) {
      handleRealtimeEvent(event);
    }
  };
}

function scheduleRealtimeReconnect() {
  if (!activeToken || reconnectTimer) {
    return;
  }

  retryAttempt += 1;
  const delay = Math.min(30_000, 2_000 + retryAttempt * 2_500);

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    openRealtimeConnection();
  }, delay);
}

function clearRealtimeReconnectTimer() {
  if (!reconnectTimer) {
    return;
  }

  window.clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function setRealtimeStatus(nextStatus: RealtimeConnectionStatus) {
  if (status === nextStatus) {
    return;
  }

  status = nextStatus;
  window.dispatchEvent(
    new CustomEvent<RealtimeConnectionStatusDetail>(REALTIME_CONNECTION_STATUS_CHANGED_EVENT, {
      detail: getRealtimeSnapshot()
    })
  );
}

function getRealtimeEventsUrl(token: string) {
  const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
  const url = new URL(`${baseUrl}/realtime/events`, window.location.origin);
  url.searchParams.set('accessToken', token);
  return url.toString();
}

function parseRealtimeEvent(data: string): RealtimeEvent | null {
  try {
    const value = JSON.parse(data) as unknown;

    if (!isRealtimeEvent(value)) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as RealtimeEvent;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.module === 'string' &&
    typeof event.entity === 'string' &&
    typeof event.action === 'string' &&
    typeof event.occurredAt === 'string'
  );
}
