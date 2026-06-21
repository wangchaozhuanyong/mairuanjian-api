export const TOKEN_STORAGE_KEY = 'apple_business_access_token';
export const CURRENT_USER_STORAGE_KEY = 'apple_business_current_user';
export const AUTH_SESSION_EXPIRED_EVENT = 'apple-business:auth-session-expired';

export interface AuthSessionExpiredDetail {
  message?: string;
  reason: 'unauthorized';
}

let sessionExpiredNotified = false;

export function clearStoredAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

export function markAuthSessionFresh() {
  sessionExpiredNotified = false;
}

export function notifyAuthSessionExpired(detail: AuthSessionExpiredDetail) {
  if (sessionExpiredNotified) {
    return;
  }

  sessionExpiredNotified = true;
  clearStoredAuthSession();
  window.dispatchEvent(
    new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, {
      detail
    })
  );
}
