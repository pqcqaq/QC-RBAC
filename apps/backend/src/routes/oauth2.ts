import type { Request, Response } from 'express';
import { Router } from 'express';
import { HttpError, badRequest, unauthorized } from '../utils/errors.js';
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
} from '../services/oauth-auth-server.js';
import { clearBrowserSessionCookie, getBrowserSessionCookieName } from '../utils/browser-session.js';
import { asyncHandler } from '../utils/http.js';
import { resolveOAuthApplicationByClientId } from '../services/oauth-admin.js';

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

const renderAuthorizeErrorPage = (description: string) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>授权失败</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #1f2937; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 460px); background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 12px; font-size: 26px; }
      p { margin: 0; color: #4b5563; line-height: 1.7; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>授权失败</h1>
        <p>${description}</p>
      </section>
    </main>
  </body>
</html>`;

const renderConsentPage = (input: {
  application: { name: string; description?: string | null; logoUrl?: string | null };
  user: { nickname: string; username: string };
  sessionState: string;
  scopes: Array<{ code: string; name: string; description: string }>;
}) => {
  const scopeItems = input.scopes
    .map(scope => `<li><strong>${scope.name}</strong><span>${scope.description}</span></li>`)
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>授权确认</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #111827; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 560px); background: #fff; border-radius: 24px; padding: 32px; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0; color: #4b5563; line-height: 1.7; }
      ul { margin: 24px 0; padding: 0; list-style: none; display: grid; gap: 14px; }
      li { padding: 14px 16px; border-radius: 16px; background: #f8fafc; display: grid; gap: 4px; }
      strong { font-size: 15px; }
      span { color: #6b7280; font-size: 14px; }
      .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
      button { border: none; border-radius: 12px; padding: 0 18px; height: 42px; font-size: 14px; font-weight: 600; cursor: pointer; }
      .ghost { background: #eef2f7; color: #334155; }
      .primary { background: #111827; color: #fff; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${input.application.name}</h1>
        <p>${input.application.description ?? '该应用正在请求访问你的账号信息和授权范围。'}</p>
        <ul>${scopeItems}</ul>
        <p>当前账号：${input.user.nickname}（${input.user.username}）</p>
        <div class="actions">
          <form method="post" action="/oauth2/authorize/decision">
            <input type="hidden" name="session_state" value="${input.sessionState}" />
            <input type="hidden" name="decision" value="deny" />
            <button type="submit" class="ghost">拒绝</button>
          </form>
          <form method="post" action="/oauth2/authorize/decision">
            <input type="hidden" name="session_state" value="${input.sessionState}" />
            <input type="hidden" name="decision" value="approve" />
            <button type="submit" class="primary">同意并继续</button>
          </form>
        </div>
      </section>
    </main>
  </body>
</html>`;
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

oauth2Router.get('/oauth2/authorize', async (req, res, next) => {
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

    res.type('html').send(renderConsentPage(result));
  } catch (error) {
    const redirected = await tryRedirectAuthorizeError({
      clientId: typeof req.query.client_id === 'string' ? req.query.client_id : undefined,
      redirectUri: typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error,
      res,
    });
    if (redirected) {
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.statusCode).type('html').send(renderAuthorizeErrorPage(error.message));
      return;
    }

    next(error);
  }
});

oauth2Router.post('/oauth2/authorize/decision', async (req, res, next) => {
  try {
    const userId = resolveBrowserSessionUserId(req.cookies[getBrowserSessionCookieName()]);
    if (!userId) {
      throw unauthorized('请先登录后再继续授权');
    }

    const sessionState = String(req.body.session_state ?? '');
    const decision = String(req.body.decision ?? '');
    if (!sessionState || !['approve', 'deny'].includes(decision)) {
      throw badRequest('invalid authorization decision');
    }

    const redirectUrl = decision === 'approve'
      ? await approveAuthorizationRequest(sessionState, userId)
      : await denyAuthorizationRequest(sessionState);

    res.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).type('html').send(renderAuthorizeErrorPage(error.message));
      return;
    }

    next(error);
  }
});

oauth2Router.post('/oauth2/token', async (req, res, next) => {
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
  }
});

const handleUserInfo = async (req: Request, res: Response) => {
  const token = extractBearerToken(req.headers.authorization)
    ?? (typeof req.body?.access_token === 'string' ? req.body.access_token : null);

  if (!token) {
    sendOAuthJsonError(res, 401, 'invalid_token', 'missing access token');
    return;
  }

  try {
    res.json(await getOAuthUserInfo(token));
  } catch (error) {
    if (error instanceof HttpError) {
      sendOAuthJsonError(res, 401, 'invalid_token', error.message);
      return;
    }

    throw error;
  }
};

oauth2Router.get('/oauth2/userinfo', asyncHandler(handleUserInfo));
oauth2Router.post('/oauth2/userinfo', asyncHandler(handleUserInfo));

oauth2Router.post('/oauth2/introspect', async (req, res, next) => {
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
  }
});

oauth2Router.post('/oauth2/revoke', async (req, res, next) => {
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
  }
});

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

    res.type('html').send(renderAuthorizeErrorPage('会话已退出。'));
  }),
);

export { oauth2Router };
