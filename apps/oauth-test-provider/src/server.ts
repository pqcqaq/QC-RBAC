import { createHash, createHmac, randomBytes } from 'node:crypto';
import http from 'node:http';

type DemoUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  picture: string;
};

type AuthorizationCodeRecord = {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain' | 'PLAIN' | 'S256';
  user: DemoUser;
};

type TokenRecord = {
  user: DemoUser;
  scope: string;
};

const port = Number(process.env.PORT ?? 3310);
const issuer = process.env.ISSUER ?? `http://localhost:${port}`;
const clientId = process.env.DEMO_PROVIDER_CLIENT_ID ?? 'demo-provider-client';
const clientSecret = process.env.DEMO_PROVIDER_CLIENT_SECRET ?? 'demo-provider-secret';
const allowedRedirectUri = process.env.DEMO_PROVIDER_REDIRECT_URI
  ?? 'http://localhost:3300/api/auth/oauth/providers/demo-provider/callback';

const users: DemoUser[] = [
  {
    id: 'provider-admin',
    username: 'provider_admin',
    name: 'Provider Admin',
    email: 'admin@example.com',
    picture: 'https://api.dicebear.com/9.x/initials/svg?seed=Admin',
  },
  {
    id: 'provider-member',
    username: 'provider_member',
    name: 'Provider Member',
    email: 'user@example.com',
    picture: 'https://api.dicebear.com/9.x/initials/svg?seed=Member',
  },
];

const authorizationCodes = new Map<string, AuthorizationCodeRecord>();
const accessTokens = new Map<string, TokenRecord>();
const refreshTokens = new Map<string, TokenRecord>();

const toBase64Url = (value: Buffer | string) =>
  Buffer.from(value).toString('base64url');

const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');

const parseFormBody = async (req: http.IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
};

const writeJson = (res: http.ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

const signIdToken = (user: DemoUser, audience: string, nonce?: string, scope?: string) => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    iss: issuer,
    sub: user.id,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce,
    preferred_username: scope?.includes('profile') ? user.username : undefined,
    name: scope?.includes('profile') ? user.name : undefined,
    picture: scope?.includes('profile') ? user.picture : undefined,
    email: scope?.includes('email') ? user.email : undefined,
    email_verified: scope?.includes('email') ? true : undefined,
  }));
  const signature = createHmac('sha256', clientSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const buildAuthorizePage = (query: URLSearchParams) => {
  const userOptions = users
    .map((user) => `<option value="${user.id}">${user.name} (${user.email})</option>`)
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Demo Provider</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f5f7; color: #111827; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 560px); background: #fff; border-radius: 24px; padding: 32px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 18px; color: #4b5563; line-height: 1.7; }
      label { display: grid; gap: 8px; margin-bottom: 16px; }
      select, button { height: 44px; border-radius: 12px; border: 1px solid rgba(17, 24, 39, 0.12); padding: 0 12px; font-size: 14px; }
      .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
      .primary { background: #111827; color: #fff; border: none; }
      .ghost { background: #eef2f7; color: #334155; border: none; }
      .meta { font-size: 13px; color: #6b7280; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Demo Provider</h1>
        <p>选择一个测试账号，模拟外部 OAuth/OIDC 授权。</p>
        <form method="post" action="/oauth2/authorize/decision">
          <label>
            <span>测试账号</span>
            <select name="user_id">${userOptions}</select>
          </label>
          <p class="meta">client_id: ${query.get('client_id') ?? ''}</p>
          <p class="meta">scope: ${query.get('scope') ?? ''}</p>
          ${[...query.entries()]
            .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
            .join('')}
          <div class="actions">
            <button type="submit" name="decision" value="deny" class="ghost">拒绝</button>
            <button type="submit" name="decision" value="approve" class="primary">同意</button>
          </div>
        </form>
      </section>
    </main>
  </body>
</html>`;
};

const validateClient = (authorization?: string | null, body?: URLSearchParams) => {
  const basicAuth = authorization?.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    : '';
  const [basicClientId, basicClientSecret] = basicAuth.split(':');
  const postedClientId = body?.get('client_id') ?? '';
  const postedClientSecret = body?.get('client_secret') ?? '';
  const actualClientId = basicClientId || postedClientId;
  const actualClientSecret = basicClientSecret || postedClientSecret;

  return actualClientId === clientId && actualClientSecret === clientSecret;
};

const verifyPkce = (record: AuthorizationCodeRecord, codeVerifier: string | null) => {
  if (!record.codeChallenge) {
    return true;
  }
  if (!codeVerifier) {
    return false;
  }
  if (record.codeChallengeMethod === 'plain' || record.codeChallengeMethod === 'PLAIN') {
    return codeVerifier === record.codeChallenge;
  }

  return createHash('sha256').update(codeVerifier).digest('base64url') === record.codeChallenge;
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', issuer);

  if (req.method === 'GET' && requestUrl.pathname === '/.well-known/openid-configuration') {
    writeJson(res, 200, {
      issuer,
      authorization_endpoint: `${issuer}/oauth2/authorize`,
      token_endpoint: `${issuer}/oauth2/token`,
      userinfo_endpoint: `${issuer}/oauth2/userinfo`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      id_token_signing_alg_values_supported: ['HS256'],
    });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/oauth2/authorize') {
    if (requestUrl.searchParams.get('client_id') !== clientId || requestUrl.searchParams.get('redirect_uri') !== allowedRedirectUri) {
      writeJson(res, 400, { error: 'invalid_client' });
      return;
    }

    writeHtml(res, buildAuthorizePage(requestUrl.searchParams));
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/oauth2/authorize/decision') {
    const form = await parseFormBody(req);
    const redirectUri = form.get('redirect_uri') ?? '';
    const state = form.get('state') ?? '';

    if (form.get('decision') !== 'approve') {
      const deniedUrl = new URL(redirectUri);
      deniedUrl.searchParams.set('error', 'access_denied');
      if (state) {
        deniedUrl.searchParams.set('state', state);
      }
      redirect(res, deniedUrl.toString());
      return;
    }

    if (form.get('client_id') !== clientId || redirectUri !== allowedRedirectUri) {
      writeJson(res, 400, { error: 'invalid_client' });
      return;
    }

    const selectedUser = users.find((user) => user.id === form.get('user_id')) ?? users[0];
    const code = randomToken(18);
    authorizationCodes.set(code, {
      clientId,
      redirectUri,
      scope: form.get('scope') ?? 'openid profile email',
      state: state || undefined,
      nonce: form.get('nonce') ?? undefined,
      codeChallenge: form.get('code_challenge') ?? undefined,
      codeChallengeMethod: form.get('code_challenge_method') as AuthorizationCodeRecord['codeChallengeMethod'],
      user: selectedUser,
    });

    const successUrl = new URL(redirectUri);
    successUrl.searchParams.set('code', code);
    if (state) {
      successUrl.searchParams.set('state', state);
    }
    redirect(res, successUrl.toString());
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/oauth2/token') {
    const form = await parseFormBody(req);
    if (!validateClient(req.headers.authorization ?? null, form)) {
      writeJson(res, 401, { error: 'invalid_client' });
      return;
    }

    if (form.get('grant_type') === 'authorization_code') {
      const code = form.get('code') ?? '';
      const record = authorizationCodes.get(code);
      if (!record || record.redirectUri !== (form.get('redirect_uri') ?? '')) {
        writeJson(res, 400, { error: 'invalid_grant' });
        return;
      }

      if (!verifyPkce(record, form.get('code_verifier'))) {
        writeJson(res, 400, { error: 'invalid_grant', error_description: 'invalid code_verifier' });
        return;
      }

      authorizationCodes.delete(code);
      const accessToken = randomToken(24);
      const refreshToken = randomToken(28);
      accessTokens.set(accessToken, { user: record.user, scope: record.scope });
      refreshTokens.set(refreshToken, { user: record.user, scope: record.scope });

      writeJson(res, 200, {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: record.scope,
        id_token: signIdToken(record.user, clientId, record.nonce, record.scope),
      });
      return;
    }

    if (form.get('grant_type') === 'refresh_token') {
      const refreshToken = form.get('refresh_token') ?? '';
      const record = refreshTokens.get(refreshToken);
      if (!record) {
        writeJson(res, 400, { error: 'invalid_grant' });
        return;
      }

      const nextAccessToken = randomToken(24);
      accessTokens.set(nextAccessToken, record);

      writeJson(res, 200, {
        access_token: nextAccessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: record.scope,
      });
      return;
    }

    writeJson(res, 400, { error: 'unsupported_grant_type' });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/oauth2/userinfo') {
    const accessToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '';
    const record = accessTokens.get(accessToken);
    if (!record) {
      writeJson(res, 401, { error: 'invalid_token' });
      return;
    }

    writeJson(res, 200, {
      sub: record.user.id,
      preferred_username: record.user.username,
      name: record.user.name,
      email: record.user.email,
      email_verified: true,
      picture: record.user.picture,
    });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/') {
    writeHtml(res, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Demo Provider</title>
    <style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; line-height: 1.7; } code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }</style>
  </head>
  <body>
    <h1>OAuth Test Provider</h1>
    <p>issuer: <code>${issuer}</code></p>
    <p>client_id: <code>${clientId}</code></p>
    <p>redirect_uri: <code>${allowedRedirectUri}</code></p>
  </body>
</html>`);
    return;
  }

  writeJson(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.log(`[oauth-test-provider] ${issuer}`);
});
