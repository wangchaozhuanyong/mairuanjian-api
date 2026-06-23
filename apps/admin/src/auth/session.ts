export const TOKEN_STORAGE_KEY = 'apple_business_access_token';
export const CURRENT_USER_STORAGE_KEY = 'apple_business_current_user';
export const AUTH_SESSION_EXPIRED_EVENT = 'apple-business:auth-session-expired';

export interface AuthSessionExpiredDetail {
  message?: string;
  reason: 'unauthorized';
}

let sessionExpiredNotified = false;
let authSessionExpired = false;
let authSessionAbortController = new AbortController();

export class AuthSessionExpiredError extends Error {
  constructor(message = '登录状态已过期，请重新登录。', options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthSessionExpiredError';
  }
}

export function clearStoredAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

export function markAuthSessionFresh() {
  sessionExpiredNotified = false;
  authSessionExpired = false;
  authSessionAbortController = new AbortController();
}

export function isAuthSessionExpired() {
  return authSessionExpired;
}

export function getAuthSessionAbortSignal() {
  return authSessionAbortController.signal;
}

export function isAuthSessionExpiredError(error: unknown): error is AuthSessionExpiredError {
  return (
    error instanceof AuthSessionExpiredError || getErrorName(error) === 'AuthSessionExpiredError'
  );
}

export function assertAuthSessionActive() {
  if (authSessionExpired) {
    throw new AuthSessionExpiredError();
  }
}

export function notifyAuthSessionExpired(detail: AuthSessionExpiredDetail) {
  authSessionExpired = true;
  clearStoredAuthSession();

  if (!authSessionAbortController.signal.aborted) {
    authSessionAbortController.abort(new AuthSessionExpiredError(detail.message));
  }

  if (sessionExpiredNotified) {
    return;
  }

  sessionExpiredNotified = true;
  window.dispatchEvent(
    new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, {
      detail
    })
  );
}

function getErrorName(error: unknown) {
  return error && typeof error === 'object' ? (error as { name?: unknown }).name : undefined;
}
