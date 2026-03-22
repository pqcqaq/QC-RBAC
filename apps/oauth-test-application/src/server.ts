import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';

type SessionState = {
  state?: string;
  codeVerifier?: string;
  tokens?: {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    expires_in?: number;
    token_type?: string;
  };
};

const port = Number(process.env.PORT ?? 3320);
const appOrigin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;
const oauthIssuer = process.env.OAUTH_ISSUER ?? 'http://localhost:3300';
const clientId = process.env.OAUTH_CLIENT_ID ?? 'demo-oauth-app-client';
const clientSecret = process.env.OAUTH_CLIENT_SECRET ?? 'demo-oauth-app-secret';
const redirectUri = process.env.OAUTH_REDIRECT_URI ?? `${appOrigin}/callback`;
const postLogoutRedirectUri = process.env.OAUTH_POST_LOGOUT_REDIRECT_URI ?? `${appOrigin}/logout/callback`;

const sessionCookieName = 'demo_oauth_app_session';
const sessions = new Map<string, SessionState>();

const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');

const parseCookies = (cookieHeader?: string) =>
  Object.fromEntries(
    (cookieHeader ?? '')
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split('=');
        return [key, decodeURIComponent(rest.join('='))];
      }),
  );

const getSession = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[sessionCookieName] || randomToken(18);
  let session = sessions.get(sessionId);
  if (!session) {
    session = {};
    sessions.set(sessionId, session);
  }

  if (!cookies[sessionCookieName]) {
    res.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`);
  }

  return session;
};

const clearSession = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[sessionCookieName];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.setHeader('Set-Cookie', `${sessionCookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
};

const writeHtml = (res: http.ServerResponse, html: string) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
};

const redirect = (res: http.ServerResponse, location: string) => {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
};

const writeJson = (res: http.ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const toBase64Url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

const buildPkceChallenge = (codeVerifier: string) =>
  createHash('sha256').update(codeVerifier).digest('base64url');

const fetchToken = async (body: URLSearchParams) => {
  const response = await fetch(`${oauthIssuer}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error((payload as { error_description?: string; error?: string } | null)?.error_description ?? 'token exchange failed');
  }

  return payload as SessionState['tokens'];
};

const fetchJson = async (url: string, accessToken: string) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      payload,
    };
  }

  return {
    ok: true,
    payload,
  };
};

const buildHomePage = async (session: SessionState, message?: string) => {
  const accessToken = session.tokens?.access_token;
  const userInfo = accessToken
    ? await fetchJson(`${oauthIssuer}/oauth2/userinfo`, accessToken)
    : null;
  const dashboard = accessToken
    ? await fetchJson(`${oauthIssuer}/api/dashboard/summary`, accessToken)
    : null;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OAuth Test Application</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f5f7; color: #111827; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 860px); background: #fff; border-radius: 24px; padding: 32px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); display: grid; gap: 18px; }
      h1 { margin: 0; font-size: 30px; }
      p { margin: 0; color: #4b5563; line-height: 1.7; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      a { display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 18px; border-radius: 12px; background: #111827; color: #fff; text-decoration: none; font-weight: 600; }
      a.secondary { background: #eef2f7; color: #334155; }
      pre { margin: 0; padding: 16px; border-radius: 16px; background: #0f172a; color: #e5e7eb; overflow: auto; font-size: 13px; line-height: 1.6; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .notice { padding: 14px 16px; border-radius: 14px; background: #eef6ff; color: #1d4ed8; }
      @media (max-width: 880px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>OAuth Test Application</h1>
        <p>这个 demo 应用通过我们系统的 OAuth2/OIDC Provider 完成登录，并尝试访问标准 userinfo 与受保护 API。</p>
        ${message ? `<div class="notice">${message}</div>` : ''}
        <div class="actions">
          <a href="/login">开始登录</a>
          <a href="/refresh" class="secondary">刷新令牌</a>
          <a href="/logout" class="secondary">退出</a>
        </div>
        <div class="grid">
          <div>
            <p>当前 token</p>
            <pre>${JSON.stringify(session.tokens ?? null, null, 2)}</pre>
          </div>
          <div>
            <p>UserInfo</p>
            <pre>${JSON.stringify(userInfo?.payload ?? null, null, 2)}</pre>
          </div>
          <div>
            <p>Dashboard API</p>
            <pre>${JSON.stringify(dashboard?.payload ?? null, null, 2)}</pre>
          </div>
          <div>
            <p>客户端配置</p>
            <pre>${JSON.stringify({ oauthIssuer, clientId, redirectUri, postLogoutRedirectUri }, null, 2)}</pre>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`;
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', appOrigin);
  const session = getSession(req, res);

  if (req.method === 'GET' && requestUrl.pathname === '/login') {
    const state = randomToken(16);
    const codeVerifier = randomToken(48);
    session.state = state;
    session.codeVerifier = codeVerifier;

    const authorizeUrl = new URL(`${oauthIssuer}/oauth2/authorize`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'openid profile email offline_access dashboard.view');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', buildPkceChallenge(codeVerifier));
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    redirect(res, authorizeUrl.toString());
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/callback') {
    if (!requestUrl.searchParams.get('code') || requestUrl.searchParams.get('state') !== session.state) {
      writeHtml(res, await buildHomePage(session, 'OAuth 回调校验失败。'));
      return;
    }

    try {
      session.tokens = await fetchToken(new URLSearchParams({
        grant_type: 'authorization_code',
        code: requestUrl.searchParams.get('code') ?? '',
        redirect_uri: redirectUri,
        code_verifier: session.codeVerifier ?? '',
      }));
      session.state = undefined;
      session.codeVerifier = undefined;
      redirect(res, '/');
    } catch (error) {
      writeHtml(res, await buildHomePage(session, error instanceof Error ? error.message : 'OAuth 登录失败'));
    }
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/refresh') {
    if (!session.tokens?.refresh_token) {
      writeHtml(res, await buildHomePage(session, '当前没有可用的 refresh token。'));
      return;
    }

    try {
      session.tokens = await fetchToken(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.tokens.refresh_token,
      }));
      redirect(res, '/');
    } catch (error) {
      writeHtml(res, await buildHomePage(session, error instanceof Error ? error.message : '刷新失败'));
    }
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/logout') {
    clearSession(req, res);
    const logoutUrl = new URL(`${oauthIssuer}/oauth2/logout`);
    logoutUrl.searchParams.set('client_id', clientId);
    logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    redirect(res, logoutUrl.toString());
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/logout/callback') {
    writeHtml(res, await buildHomePage({}, '已退出当前 demo 应用。'));
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/') {
    writeHtml(res, await buildHomePage(session));
    return;
  }

  writeJson(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.log(`[oauth-test-application] ${appOrigin}`);
});
