import { defineStore } from 'pinia';
import { authApi } from '@/api/system';
import { TOKEN_STORAGE_KEY } from '@/api/client';
import type { CurrentUser } from '@/types/system';

interface AuthState {
  token: string;
  user: CurrentUser | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(TOKEN_STORAGE_KEY) ?? '',
    user: null
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) => state.user?.displayName ?? state.user?.username ?? '未登录'
  },
  actions: {
    async login(username: string, password: string, mfaCode?: string) {
      const data = await authApi.login(username, password, mfaCode);
      this.token = data.accessToken;
      this.user = data.user;
      localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
    },
    async loadCurrentUser() {
      if (!this.token) {
        return;
      }

      this.user = await authApi.me();
    },
    async logout() {
      try {
        if (this.token) {
          await authApi.logout();
        }
      } finally {
        this.token = '';
        this.user = null;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }
});
