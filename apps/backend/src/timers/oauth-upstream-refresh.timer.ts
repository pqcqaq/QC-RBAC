import { env } from '../config/env';
import { refreshExternalOAuthAccessTokens } from '../services/oauth-auth-server';
import { defineIntervalTimer } from './timer';

export const createOAuthUpstreamRefreshTimer = () =>
  defineIntervalTimer({
    id: 'oauth-upstream-refresh',
    description: 'refresh upstream OAuth provider access tokens before expiry',
    enabled: env.OAUTH_UPSTREAM_REFRESH_ENABLED,
    runImmediately: env.OAUTH_UPSTREAM_REFRESH_RUN_ON_START,
    schedule: {
      minutes: env.OAUTH_UPSTREAM_REFRESH_INTERVAL_MINUTES,
    },
    execute: async () => {
      await refreshExternalOAuthAccessTokens();
    },
  });
