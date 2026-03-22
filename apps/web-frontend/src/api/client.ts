import type { ApiEnvelope, AuthSession } from '@rbac/api-common';
import {
  AuthClientType,
  buildAuthClientHeaders,
  createApiFactory,
} from '@rbac/api-common';
import { createProgressFetchAdaptor, trackedFetch } from './progress-fetch-adaptor';

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
export const authClientCode = import.meta.env.VITE_AUTH_CLIENT_CODE ?? 'web-console';
export const authClientSecret = import.meta.env.VITE_AUTH_CLIENT_SECRET ?? 'rbac-web-client-secret';
export const authClientType = AuthClientType.WEB;
const refreshUrl = `${apiBaseUrl.replace(/\/$/, '')}/auth/refresh`;

const resolveWebClientConfig = () => {
  const protocol = (import.meta.env.VITE_AUTH_WEB_PROTOCOL ?? window.location.protocol.replace(/:$/, '') ?? 'http').toLowerCase();
  const host = import.meta.env.VITE_AUTH_WEB_HOST ?? window.location.hostname ?? 'localhost';
  const portValue = import.meta.env.VITE_AUTH_WEB_PORT ?? window.location.port;
  const port = portValue ? Number(portValue) : undefined;

  return {
    protocol: protocol === 'https' ? 'https' : 'http',
    host,
    ...(port ? { port } : {}),
  } as const;
};

export const getClientCredentialHeaders = () => buildAuthClientHeaders({
  code: authClientCode,
  secret: authClientSecret,
  type: authClientType,
  config: resolveWebClientConfig(),
});

let refreshPromise: Promise<boolean> | null = null;

const refreshSession = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = trackedFetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getClientCredentialHeaders(),
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
  adaptor: createProgressFetchAdaptor(),
  getAccessToken: getStoredAccessToken,
  getDefaultHeaders: getClientCredentialHeaders,
  onUnauthorized: async () => {
    const refreshed = await refreshSession();
    if (!refreshed && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return refreshed;
  },
});
