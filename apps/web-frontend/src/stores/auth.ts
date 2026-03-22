import type { CurrentUser, LoginPayload, RegisterPayload } from '@rbac/api-common';
import { defineStore } from 'pinia';
import { api, clearStoredTokens, getStoredAccessToken, getStoredRefreshToken, persistTokens } from '@/api/client';
import type { AccessDirectiveValue } from '@/utils/access-control';
import { matchAccess } from '@/utils/access-control';
import { useWorkbenchStore } from '@/stores/workbench';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as CurrentUser | null,
    ready: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && getStoredAccessToken()),
    roles: (state) => state.user?.roles ?? [],
    roleCodes: (state) => state.user?.roles.map((item) => item.code) ?? [],
    permissions: (state) => state.user?.permissions ?? [],
  },
  actions: {
    setSession(payload: { user: CurrentUser; tokens: { accessToken: string; refreshToken: string } }) {
      persistTokens(payload.tokens);
      this.setUser(payload.user, { syncWorkbench: true });
      this.ready = true;
    },
    setUser(user: CurrentUser, options: { syncWorkbench?: boolean } = {}) {
      this.user = user;
      if (options.syncWorkbench !== false) {
        useWorkbenchStore().hydrateUserPreferences(user.id, user.preferences);
      }
    },
    clearSession() {
      clearStoredTokens();
      this.user = null;
      useWorkbenchStore().clearUserPreferencesContext();
      this.ready = true;
    },
    hasPermission(permission: string) {
      return this.permissions.includes(permission);
    },
    hasRole(role: string) {
      return this.roleCodes.includes(role);
    },
    matchPermissions(value: AccessDirectiveValue, operator?: string) {
      return matchAccess(this.permissions, value, operator);
    },
    matchRoles(value: AccessDirectiveValue, operator?: string) {
      return matchAccess(this.roleCodes, value, operator);
    },
    async bootstrap() {
      if (!getStoredAccessToken()) {
        useWorkbenchStore().clearUserPreferencesContext();
        this.ready = true;
        return;
      }

      try {
        const user = await api.auth.me();
        this.setUser(user, { syncWorkbench: true });
      } catch (_error) {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          try {
            const session = await api.auth.refresh(refreshToken);
            this.setSession(session);
          } catch (_refreshError) {
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
      const user = await api.auth.me();
      this.setUser(user, { syncWorkbench: false });
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
