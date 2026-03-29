import type { Request, Response } from 'express';
import { Router } from 'express';
import { HttpError, badRequest, unauthorized } from '../utils/errors';
import {
  approveAuthorizationRequest,
  denyAuthorizationRequest,
  exchangeOAuthToken,
  getJwksDocument,
  getOAuthUserInfo,
  getOpenIdConfiguration,
  introspectOAuthToken,
  resolveBrowserSessionUserId,
  revokeOAuthToken,
  startAuthorizationRequest,
} from '../services/oauth-auth-server';
import { clearBrowserSessionCookie, getBrowserSessionCookieName } from '../utils/browser-session';
import { asyncHandler, rollbackHandledResponse } from '../utils/http';
import { resolveOAuthApplicationByClientId } from '../services/oauth-admin';
import { resolveWebAuthClientOrigin } from '../services/auth-clients';

const oauth2Router = Router();

const extractBearerToken = (authorization?: string | null) => {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
};

const sendOAuthJsonError = (
  res: Response,
  status: number,
  error: string,
  description: string,
) =>
  res.status(status).json({
    error,
    error_description: description,
  });

const mapTokenError = (error: unknown) => {
  if (error instanceof HttpError) {
    if (/grant_type/i.test(error.message)) {
      return { status: 400, error: 'unsupported_grant_type', description: error.message };
    }
    if (/authorization code|refresh token|code_verifier|redirect_uri mismatch/i.test(error.message)) {
      return { status: 400, error: 'invalid_grant', description: error.message };
    }
    if (/client/i.test(error.message)) {
      return { status: 401, error: 'invalid_client', description: error.message };
    }
    return { status: error.statusCode, error: 'invalid_request', description: error.message };
  }

  return { status: 500, error: 'server_error', description: 'OAuth server error' };
};

const mapAuthorizeErrorCode = (error: unknown) => {
  if (!(error instanceof HttpError)) {
    return 'server_error';
  }
  if (/scope/i.test(error.message)) {
    return 'invalid_scope';
  }
  if (/response_type/i.test(error.message)) {
    return 'unsupported_response_type';
  }
  if (/client/i.test(error.message)) {
    return 'unauthorized_client';
  }
  return 'invalid_request';
};

const buildFrontendUrl = async (pathname: string, query?: Record<string, string | undefined>) => {
  const webOrigin = await resolveWebAuthClientOrigin('web-console');
  const url = new URL(pathname, webOrigin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
};

const redirectToFrontendAuthorizeError = async (
  res: Response,
  errorCode: string,
  description: string,
) => {
  res.redirect(
    await buildFrontendUrl('/oauth/error', {
      error: errorCode,
      error_description: description,
    }),
  );
};

const readAuthorizeDecision = (req: Request) => {
  const source = req.method === 'GET' ? req.query : req.body;
  const sessionState = String(source.session_state ?? '');
  const decision = String(source.decision ?? '');

  if (!sessionState || !['approve', 'deny'].includes(decision)) {
    throw badRequest('invalid authorization decision');
  }

  return {
    sessionState,
    decision: decision as 'approve' | 'deny',
  };
};

const tryRedirectAuthorizeError = async (input: {
  clientId?: string;
  redirectUri?: string;
  state?: string;
  error: unknown;
  res: import('express').Response;
}) => {
  if (!input.clientId || !input.redirectUri) {
    return false;
  }

  try {
    const application = await resolveOAuthApplicationByClientId(input.clientId);
    if (!application.redirectUris.includes(input.redirectUri)) {
      return false;
    }

    const redirectUrl = new URL(input.redirectUri);
    redirectUrl.searchParams.set('error', mapAuthorizeErrorCode(input.error));
    redirectUrl.searchParams.set(
      'error_description',
      input.error instanceof Error ? input.error.message : 'authorization failed',
    );
    if (input.state) {
      redirectUrl.searchParams.set('state', input.state);
    }

    input.res.redirect(redirectUrl.toString());
    return true;
  } catch {
    return false;
  }
};

oauth2Router.get(
  '/.well-known/openid-configuration',
  asyncHandler(async (_req, res) => {
    res.json(await getOpenIdConfiguration());
  }),
);

oauth2Router.get('/oauth2/jwks', (_req, res) => {
  res.json(getJwksDocument());
});

oauth2Router.get('/oauth2/authorize', asyncHandler(async (req, res, next) => {
  try {
    const userId = resolveBrowserSessionUserId(req.cookies[getBrowserSessionCookieName()]);
    const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`).toString();

    const result = await startAuthorizationRequest({
      responseType: String(req.query.response_type ?? ''),
      clientId: String(req.query.client_id ?? ''),
      redirectUri: String(req.query.redirect_uri ?? ''),
      scope: typeof req.query.scope === 'string' ? req.query.scope : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      codeChallenge: typeof req.query.code_challenge === 'string' ? req.query.code_challenge : undefined,
      codeChallengeMethod: typeof req.query.code_challenge_method === 'string'
        ? req.query.code_challenge_method as 'S256' | 'PLAIN'
        : undefined,
      nonce: typeof req.query.nonce === 'string' ? req.query.nonce : undefined,
      currentUrl,
      userId,
    });

    if (result.type === 'login-required') {
      res.redirect(result.loginUrl);
      return;
    }

    if (result.type === 'redirect') {
      res.redirect(result.redirectUrl);
      return;
    }

    res.redirect(
      await buildFrontendUrl('/oauth/authorize', {
        session_state: result.sessionState,
      }),
    );
    return;
  } catch (error) {
    const redirected = await tryRedirectAuthorizeError({
      clientId: typeof req.query.client_id === 'string' ? req.query.client_id : undefined,
      redirectUri: typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error,
      res,
    });
    if (redirected) {
      throw rollbackHandledResponse(error);
    }

    if (error instanceof HttpError) {
      await redirectToFrontendAuthorizeError(
        res,
        mapAuthorizeErrorCode(error),
        error.message,
      );
      throw rollbackHandledResponse(error);
    }

    await redirectToFrontendAuthorizeError(res, 'server_error', 'authorization failed');
    throw rollbackHandledResponse(error);
  }
}));

const handleAuthorizationDecision = async (req: Request, res: Response) => {
  try {
    const userId = resolveBrowserSessionUserId(req.cookies[getBrowserSessionCookieName()]);
    if (!userId) {
      throw unauthorized('请先登录后再继续授权');
    }

    const { sessionState, decision } = readAuthorizeDecision(req);

    const redirectUrl = decision === 'approve'
      ? await approveAuthorizationRequest(sessionState, userId)
      : await denyAuthorizationRequest(sessionState, userId);

    res.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof HttpError) {
      await redirectToFrontendAuthorizeError(
        res,
        'invalid_request',
        error.message,
      );
      throw rollbackHandledResponse(error);
    }

    throw error;
  }
};

oauth2Router.get(
  '/oauth2/authorize/decision',
  asyncHandler(async (req, res, next) => {
    await handleAuthorizationDecision(req, res);
  }),
);
oauth2Router.post(
  '/oauth2/authorize/decision',
  asyncHandler(async (req, res, next) => {
    await handleAuthorizationDecision(req, res);
  }),
);

oauth2Router.post('/oauth2/token', asyncHandler(async (req, res) => {
  try {
    const result = await exchangeOAuthToken({
      grantType: String(req.body.grant_type ?? ''),
      code: typeof req.body.code === 'string' ? req.body.code : undefined,
      redirectUri: typeof req.body.redirect_uri === 'string' ? req.body.redirect_uri : undefined,
      codeVerifier: typeof req.body.code_verifier === 'string' ? req.body.code_verifier : undefined,
      refreshToken: typeof req.body.refresh_token === 'string' ? req.body.refresh_token : undefined,
      clientId: typeof req.body.client_id === 'string' ? req.body.client_id : undefined,
      clientSecret: typeof req.body.client_secret === 'string' ? req.body.client_secret : undefined,
      authorization: req.headers.authorization,
    });

    res.json(result);
  } catch (error) {
    const mapped = mapTokenError(error);
    sendOAuthJsonError(res, mapped.status, mapped.error, mapped.description);
    throw rollbackHandledResponse(error);
  }
}));

const handleUserInfo = async (req: Request, res: Response) => {
  const token = extractBearerToken(req.headers.authorization)
    ?? (typeof req.body?.access_token === 'string' ? req.body.access_token : null);

  if (!token) {
    sendOAuthJsonError(res, 401, 'invalid_token', 'missing access token');
    throw rollbackHandledResponse(badRequest('missing access token'));
  }

  try {
    res.json(await getOAuthUserInfo(token));
  } catch (error) {
    if (error instanceof HttpError) {
      sendOAuthJsonError(res, 401, 'invalid_token', error.message);
      throw rollbackHandledResponse(error);
    }

    throw error;
  }
};

oauth2Router.get('/oauth2/userinfo', asyncHandler(handleUserInfo));
oauth2Router.post('/oauth2/userinfo', asyncHandler(handleUserInfo));

oauth2Router.post('/oauth2/introspect', asyncHandler(async (req, res) => {
  try {
    const token = String(req.body.token ?? '');
    if (!token) {
      throw badRequest('token is required');
    }

    res.json(await introspectOAuthToken({
      token,
      clientId: typeof req.body.client_id === 'string' ? req.body.client_id : undefined,
      clientSecret: typeof req.body.client_secret === 'string' ? req.body.client_secret : undefined,
      authorization: req.headers.authorization,
    }));
  } catch (error) {
    const mapped = mapTokenError(error);
    sendOAuthJsonError(res, mapped.status, mapped.error, mapped.description);
    throw rollbackHandledResponse(error);
  }
}));

oauth2Router.post('/oauth2/revoke', asyncHandler(async (req, res) => {
  try {
    const token = String(req.body.token ?? '');
    if (!token) {
      throw badRequest('token is required');
    }

    await revokeOAuthToken({
      token,
      clientId: typeof req.body.client_id === 'string' ? req.body.client_id : undefined,
      clientSecret: typeof req.body.client_secret === 'string' ? req.body.client_secret : undefined,
      authorization: req.headers.authorization,
    });
    res.status(200).end();
  } catch (error) {
    const mapped = mapTokenError(error);
    sendOAuthJsonError(res, mapped.status, mapped.error, mapped.description);
    throw rollbackHandledResponse(error);
  }
}));

oauth2Router.get(
  '/oauth2/logout',
  asyncHandler(async (req, res) => {
    clearBrowserSessionCookie(res);

    const clientId = typeof req.query.client_id === 'string' ? req.query.client_id : '';
    const redirectUri = typeof req.query.post_logout_redirect_uri === 'string'
      ? req.query.post_logout_redirect_uri
      : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (clientId && redirectUri) {
      const application = await resolveOAuthApplicationByClientId(clientId);
      if (!application.postLogoutRedirectUris.includes(redirectUri)) {
        throw badRequest('post_logout_redirect_uri is not allowed');
      }

      const nextUrl = new URL(redirectUri);
      if (state) {
        nextUrl.searchParams.set('state', state);
      }
      res.redirect(nextUrl.toString());
      return;
    }

    await redirectToFrontendAuthorizeError(res, 'logged_out', '会话已退出。');
    return;
  }),
);

export { oauth2Router };
