import type { CurrentUser, LoginPayload, RegisterPayload } from '@rbac/api-common';
import { defineStore } from 'pinia';
import { api, clearStoredTokens, getStoredAccessToken, getStoredRefreshToken, persistTokens } from '@/api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as CurrentUser | null,
    ready: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && getStoredAccessToken()),
    permissions: (state) => state.user?.permissions ?? [],
  },
  actions: {
    setSession(payload: { user: CurrentUser; tokens: { accessToken: string; refreshToken: string } }) {
      persistTokens(payload.tokens);
      this.user = payload.user;
    },
    setUser(user: CurrentUser) {
      this.user = user;
    },
    clearSession() {
      clearStoredTokens();
      this.user = null;
    },
    hasPermission(permission: string) {
      return this.permissions.includes(permission);
    },
    async bootstrap() {
      if (!getStoredAccessToken()) {
        this.ready = true;
        return;
      }

      try {
        this.user = await api.auth.me();
      } catch (error) {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          try {
            const session = await api.auth.refresh(refreshToken);
            this.setSession(session);
          } catch (refreshError) {
            this.clearSession();
          }
        } else {
          this.clearSession();
        }
      } finally {
        this.ready = true;
      }
    },
    async login(payload: LoginPayload) {
      const session = await api.auth.login(payload);
      this.setSession(session);
    },
    async register(payload: RegisterPayload) {
      const session = await api.auth.register(payload);
      this.setSession(session);
    },
    async syncCurrentUser() {
      this.user = await api.auth.me();
      return this.user;
    },
    async logout() {
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        await api.auth.logout(refreshToken).catch(() => undefined);
      }
      this.clearSession();
    },
  },
});
