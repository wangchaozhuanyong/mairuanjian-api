import { defineStore } from 'pinia';
import { authApi } from '@/api/system';
import {
  clearStoredAuthSession,
  CURRENT_USER_STORAGE_KEY,
  markAuthSessionFresh,
  TOKEN_STORAGE_KEY
} from '@/auth/session';
import type { CurrentUser } from '@/types/system';

const CURRENT_USER_REFRESH_INTERVAL_MS = 60_000;

interface AuthState {
  token: string;
  user: CurrentUser | null;
  userLoadedAt: number;
  userRefreshing: boolean;
}

let currentUserPromise: Promise<void> | null = null;

function readStoredCurrentUser() {
  try {
    const stored = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    const value = stored ? (JSON.parse(stored) as unknown) : null;

    return isCurrentUser(value) ? value : null;
  } catch {
    return null;
  }
}

function persistCurrentUser(user: CurrentUser | null) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as CurrentUser;
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.displayName === 'string' &&
    Array.isArray(user.roles) &&
    Array.isArray(user.permissions)
  );
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
    const storedUser = token ? readStoredCurrentUser() : null;

    return {
      token,
      user: storedUser,
      userLoadedAt: storedUser ? Date.now() : 0,
      userRefreshing: false
    };
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) =>
      state.user?.displayName ?? state.user?.username ?? (state.token ? '验证中' : '未登录'),
    shouldRefreshCurrentUser: (state) =>
      Boolean(state.token) &&
      !state.userRefreshing &&
      Date.now() - state.userLoadedAt > CURRENT_USER_REFRESH_INTERVAL_MS
  },
  actions: {
    async login(username: string, password: string, mfaCode?: string) {
      const data = await authApi.login(username, password, mfaCode);
      this.token = data.accessToken;
      this.user = data.user;
      this.userLoadedAt = Date.now();
      localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
      persistCurrentUser(data.user);
      markAuthSessionFresh();
    },
    async loadCurrentUser(options: { force?: boolean } = {}) {
      if (!this.token) {
        return;
      }

      if (currentUserPromise && !options.force) {
        return currentUserPromise;
      }

      currentUserPromise = (async () => {
        this.userRefreshing = true;
        try {
          this.user = await authApi.me();
          this.userLoadedAt = Date.now();
          persistCurrentUser(this.user);
        } finally {
          this.userRefreshing = false;
          currentUserPromise = null;
        }
      })();

      return currentUserPromise;
    },
    clearLocalSession() {
      currentUserPromise = null;
      this.token = '';
      this.user = null;
      this.userLoadedAt = 0;
      this.userRefreshing = false;
      clearStoredAuthSession();
    },
    async logout(options: { remote?: boolean } = {}) {
      const shouldNotifyRemote = options.remote ?? true;

      try {
        if (shouldNotifyRemote && this.token) {
          await authApi.logout();
        }
      } finally {
        this.clearLocalSession();
      }
    }
  }
});
