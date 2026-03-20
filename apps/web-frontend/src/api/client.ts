import type { ApiEnvelope, AuthSession } from '@rbac/api-common';
import { createApiFactory, createFetchAdaptor } from '@rbac/api-common';

const ACCESS_TOKEN_KEY = 'rbac_access_token';
const REFRESH_TOKEN_KEY = 'rbac_refresh_token';

export const getStoredAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const persistTokens = (tokens: { accessToken: string; refreshToken: string }) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

export const clearStoredTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3300/api';
export const wsBaseUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:3300';
const refreshUrl = `${apiBaseUrl.replace(/\/$/, '')}/auth/refresh`;

let refreshPromise: Promise<boolean> | null = null;

const refreshSession = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<AuthSession> | null;
        if (!response.ok || !payload?.data?.tokens) {
          throw new Error(payload?.message ?? 'Refresh failed');
        }
        persistTokens(payload.data.tokens);
        return true;
      })
      .catch(() => {
        clearStoredTokens();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const api = createApiFactory({
  baseUrl: apiBaseUrl,
  adaptor: createFetchAdaptor(),
  getAccessToken: getStoredAccessToken,
  onUnauthorized: async () => {
    const refreshed = await refreshSession();
    if (!refreshed && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return refreshed;
  },
});
