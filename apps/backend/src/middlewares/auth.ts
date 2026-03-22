import type { RequestHandler } from 'express';
import { isSameAuthClientIdentity } from '@rbac/api-common';
import {
  authenticateOptionalHeadersClient,
  resolveAuthClientSummary,
} from '../services/auth-clients.js';
import { resolveOAuthAccessContext } from '../services/oauth-auth-server.js';
import { getBrowserSessionCookieName } from '../utils/browser-session.js';
import { buildCurrentUser } from '../utils/rbac.js';
import { HttpError, unauthorized } from '../utils/errors.js';
import { setRequestActorId } from '../utils/request-context.js';
import { verifyAccessToken } from '../utils/token.js';

export type AuthContext = Awaited<ReturnType<typeof buildCurrentUser>>;

const extractAuthorizationToken = (value?: string | null) =>
  value?.startsWith('Bearer ')
    ? value.slice(7)
    : (value ?? null);

export const authMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const requestClient = req.authClient ?? await authenticateOptionalHeadersClient(req.headers);
    const token = extractAuthorizationToken(req.headers.authorization)
      ?? req.cookies?.[getBrowserSessionCookieName()]
      ?? null;

    if (!token) {
      throw unauthorized('Missing access token');
    }

    try {
      const payload = verifyAccessToken(token);
      if (payload.type !== 'access') {
        throw unauthorized('Invalid access token');
      }
      if (requestClient && !isSameAuthClientIdentity(payload.client, requestClient)) {
        throw unauthorized('Access token client mismatch');
      }

      const auth = await buildCurrentUser(payload.sub);
      if (auth.status !== 'ACTIVE') {
        throw unauthorized('Account disabled');
      }

      req.authClient = requestClient ?? await resolveAuthClientSummary(payload.client);
      req.auth = auth;
      req.authMode = 'local';
      req.oauthApplication = undefined;
      setRequestActorId(auth.id);
      next();
      return;
    } catch (_error) {
      // Local JWT verification failed; continue with OAuth access token resolution.
    }

    if (requestClient) {
      throw unauthorized('OAuth access token cannot be combined with auth client headers');
    }

    const oauthContext = await resolveOAuthAccessContext(token);
    req.auth = oauthContext.user;
    req.authMode = 'oauth';
    req.oauthApplication = {
      id: oauthContext.application.id,
      code: oauthContext.application.code,
      clientId: oauthContext.application.clientId,
    };
    req.authClient = undefined;
    setRequestActorId(oauthContext.user.id);
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(unauthorized('Invalid or expired token'));
      return;
    }

    next(error);
  }
};
