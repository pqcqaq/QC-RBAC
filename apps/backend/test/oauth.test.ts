import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AuthClientType,
  buildAuthClientHeaders,
} from '@rbac/api-common';
import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { refreshExternalOAuthAccessTokens } from '../src/services/oauth-auth-server';

const deriveTestDatabaseUrl = () => {
  const source = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!source) {
    throw new Error('DATABASE_URL is required for tests');
  }

  const url = new URL(source);
  const databaseName = url.pathname.replace(/^\//, '');
  url.pathname = `/${databaseName}_test`;
  return url.toString();
};

const testDatabaseUrl = deriveTestDatabaseUrl();
process.env.DATABASE_URL = testDatabaseUrl;
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let app: Express;
let prisma: PrismaClient;
let seedDatabase: (prisma: PrismaClient) => Promise<void>;
let redis: { disconnect: () => Promise<unknown> | void };
let mockProviderServer: http.Server;

const webClient = {
  code: 'web-console',
  secret: 'rbac-web-client-secret',
  type: AuthClientType.WEB,
  origin: 'http://localhost:5173',
};

const withClientAuth = (target: request.Test) => {
  const headers = buildAuthClientHeaders({
    code: webClient.code,
    secret: webClient.secret,
    type: webClient.type,
  });

  Object.entries(headers).forEach(([key, value]) => {
    target = target.set(key, value);
  });

  return target.set('Origin', webClient.origin);
};

const execPrisma = (...args: string[]) => {
  const result = spawnSync(`pnpm exec prisma ${args.join(' ')}`, {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    encoding: 'utf8',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
};

const startMockProvider = async () => {
  let refreshCounter = 0;
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost:3310');

    if (req.method === 'POST' && requestUrl.pathname === '/oauth2/token') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const responseBody = form.get('grant_type') === 'refresh_token'
        ? {
            access_token: `upstream-access-refreshed-${++refreshCounter}`,
            refresh_token: 'upstream-refresh-fixed',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email offline_access',
          }
        : {
            access_token: 'upstream-access-initial',
            refresh_token: 'upstream-refresh-fixed',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email offline_access',
          };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(responseBody));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/oauth2/userinfo') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        sub: 'demo-upstream-user',
        preferred_username: 'upstream_admin',
        name: 'Upstream Admin',
        email: 'admin@example.com',
        picture: 'https://example.com/avatar.png',
      }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(3310, () => resolve());
  });
  return server;
};

before(async () => {
  execPrisma('db', 'push', '--skip-generate', '--force-reset');
  const appModule = await import('../src/app');
  ({ prisma } = await import('../src/lib/prisma'));
  ({ redis } = await import('../src/lib/redis'));
  ({ seedDatabase } = await import('../prisma/seed-data'));
  app = appModule.createApp();
  mockProviderServer = await startMockProvider();
});

beforeEach(async () => {
  await seedDatabase(prisma);
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    mockProviderServer.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma?.$disconnect();
  await redis?.disconnect();
});

describe('OAuth integration', () => {
  it('supports authorization code + PKCE + userinfo + protected api', async () => {
    const agent = request.agent(app);
    await withClientAuth(agent.post('/api/auth/login'))
      .send({ account: 'admin@example.com', password: 'Admin123!' })
      .expect(200);

    const codeVerifier = 'pkce-verifier-demo-1234567890';
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const authorizeResponse = await agent
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        client_id: 'demo-oauth-app-client',
        redirect_uri: 'http://localhost:3320/callback',
        scope: 'openid profile email offline_access dashboard.view',
        state: 'demo-state',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })
      .expect(200);

    const html = authorizeResponse.text;
    const sessionState = /name="session_state" value="([^"]+)"/.exec(html)?.[1];
    assert.ok(sessionState);

    const decisionResponse = await agent
      .post('/oauth2/authorize/decision')
      .type('form')
      .send({
        session_state: sessionState,
        decision: 'approve',
      })
      .expect(302);

    const redirected = new URL(String(decisionResponse.headers.location));
    assert.equal(redirected.searchParams.get('state'), 'demo-state');
    const code = redirected.searchParams.get('code');
    assert.ok(code);

    const tokenResponse = await request(app)
      .post('/oauth2/token')
      .set('Authorization', `Basic ${Buffer.from('demo-oauth-app-client:demo-oauth-app-secret').toString('base64')}`)
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3320/callback',
        code_verifier: codeVerifier,
      })
      .expect(200);

    assert.equal(tokenResponse.body.token_type, 'Bearer');
    assert.match(String(tokenResponse.body.scope), /dashboard\.view/);
    assert.ok(tokenResponse.body.refresh_token);

    const userInfo = await request(app)
      .get('/oauth2/userinfo')
      .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
      .expect(200);

    assert.equal(userInfo.body.email, 'admin@example.com');

    const dashboard = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
      .expect(200);

    assert.ok(dashboard.body.data.metrics.length > 0);

    const introspection = await request(app)
      .post('/oauth2/introspect')
      .set('Authorization', `Basic ${Buffer.from('demo-oauth-app-client:demo-oauth-app-secret').toString('base64')}`)
      .type('form')
      .send({ token: tokenResponse.body.access_token })
      .expect(200);

    assert.equal(introspection.body.active, true);

    await request(app)
      .post('/oauth2/revoke')
      .set('Authorization', `Basic ${Buffer.from('demo-oauth-app-client:demo-oauth-app-secret').toString('base64')}`)
      .type('form')
      .send({ token: tokenResponse.body.refresh_token })
      .expect(200);

    const revokedRefresh = await request(app)
      .post('/oauth2/introspect')
      .set('Authorization', `Basic ${Buffer.from('demo-oauth-app-client:demo-oauth-app-secret').toString('base64')}`)
      .type('form')
      .send({ token: tokenResponse.body.refresh_token })
      .expect(200);

    assert.equal(revokedRefresh.body.active, false);
  });

  it('supports upstream oauth login, ticket exchange and refresh task', async () => {
    const strategies = await withClientAuth(request(app).get('/api/auth/strategies')).expect(200);
    assert.ok(
      strategies.body.data.oauthProviders.some((provider: { code: string }) => provider.code === 'demo-provider'),
    );

    const authorizeResult = await withClientAuth(
      request(app)
        .get('/api/auth/oauth/providers/demo-provider/authorize-url')
        .query({ returnTo: '/console' }),
    ).expect(200);

    const upstreamUrl = new URL(authorizeResult.body.data.redirectUrl);
    const state = upstreamUrl.searchParams.get('state');
    assert.ok(state);

    const callback = await request(app)
      .get('/api/auth/oauth/providers/demo-provider/callback')
      .query({ code: 'mock-code', state })
      .expect(302);

    const callbackUrl = new URL(String(callback.headers.location), 'http://localhost:5173');
    const ticket = callbackUrl.searchParams.get('oauth_ticket');
    assert.ok(ticket);
    assert.equal(callbackUrl.searchParams.get('returnTo'), '/console');

    const exchanged = await withClientAuth(request(app).post('/api/auth/oauth/tickets/exchange'))
      .send({ ticket })
      .expect(200);

    assert.equal(exchanged.body.data.user.email, 'admin@example.com');

    const linkedUserCount = await prisma.oAuthUser.count();
    const externalRefreshToken = await prisma.oAuthToken.findFirst({
      where: {
        kind: 'EXTERNAL_REFRESH_TOKEN',
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    assert.equal(linkedUserCount, 1);
    assert.ok(externalRefreshToken);

    await prisma.oAuthToken.update({
      where: { id: externalRefreshToken.id },
      data: {
        refreshAt: new Date(Date.now() - 60_000),
      },
    });

    const refreshResult = await refreshExternalOAuthAccessTokens();
    assert.equal(refreshResult.failed, 0);
    assert.equal(refreshResult.refreshed, 1);

    const refreshedAccessTokenCount = await prisma.oAuthToken.count({
      where: {
        kind: 'EXTERNAL_ACCESS_TOKEN',
      },
    });
    assert.ok(refreshedAccessTokenCount >= 2);
  });
});
