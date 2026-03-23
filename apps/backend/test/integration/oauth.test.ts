import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { encryptOAuthSecret, hashOpaqueToken } from '../../src/utils/oauth-security';
import { withSnowflakeId } from '../../src/utils/persistence';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  webClient,
  withClientAuth,
} from '../support/backend-testkit';

let context: BackendTestContext;
let refreshExternalOAuthAccessTokens: typeof import('../../src/services/oauth-auth-server').refreshExternalOAuthAccessTokens;

const applicationBasicAuthorization = `Basic ${Buffer.from('demo-oauth-app-client:demo-oauth-app-secret').toString('base64')}`;

before(async () => {
  context = await bootstrapBackendTestContext({ mockOAuthProvider: true });
  ({ refreshExternalOAuthAccessTokens } = await import('../../src/services/oauth-auth-server'));
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('OAuth integration', () => {
  it('exposes oauth application permission options without depending on role management permissions', async () => {
    const { app, prisma } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const oauthApplicationPermission = await prisma.permission.findUnique({
      where: { code: 'oauth-application.update' },
      select: { id: true },
    });
    const dashboardPermission = await prisma.permission.findUnique({
      where: { code: 'dashboard.view' },
      select: { id: true },
    });
    assert.ok(oauthApplicationPermission);
    assert.ok(dashboardPermission);

    const createdRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'oauth-application-editor',
        name: 'OAuth 应用维护员',
        description: '仅维护 OAuth 应用配置',
        permissionIds: [oauthApplicationPermission.id],
      })
      .expect(200);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'oauthappeditor',
        email: 'oauthappeditor@example.com',
        nickname: 'OAuth 应用维护员',
        password: 'OauthApp123!',
        status: 'ACTIVE',
        roleIds: [createdRole.body.data.id],
      })
      .expect(200);

    const editorSession = await loginAs(app, 'oauthappeditor@example.com', 'OauthApp123!');

    const permissionOptions = await request(app)
      .post('/api/oauth/applications/options/permissions')
      .set('Authorization', `Bearer ${editorSession.tokens.accessToken}`)
      .send({ page: 1, pageSize: 10, code: 'dashboard.view' })
      .expect(200);

    assert.ok(
      permissionOptions.body.data.items.some(
        (item: { code: string }) => item.code === 'dashboard.view',
      ),
    );

    const resolvedPermissionOptions = await request(app)
      .post('/api/oauth/applications/options/permissions/resolve')
      .set('Authorization', `Bearer ${editorSession.tokens.accessToken}`)
      .send({ ids: [dashboardPermission.id] })
      .expect(200);

    assert.equal(resolvedPermissionOptions.body.data.length, 1);
    assert.equal(resolvedPermissionOptions.body.data[0].code, 'dashboard.view');

    await request(app)
      .get('/api/roles/options/permissions')
      .set('Authorization', `Bearer ${editorSession.tokens.accessToken}`)
      .expect(403);
  });

  it('supports authorization code + PKCE + userinfo + protected api', async () => {
    const { app } = context;
    const agent = request.agent(app);

    await withClientAuth(agent.post('/api/auth/login'), webClient)
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

    const approveDecisionUrl = /href="([^"]*\/oauth2\/authorize\/decision\?[^"]*decision=approve)"/
      .exec(authorizeResponse.text)?.[1]
      ?.replace(/&amp;/g, '&');
    assert.ok(authorizeResponse.text.includes('同意并继续'));
    assert.ok(approveDecisionUrl);

    const decisionResponse = await agent.get(approveDecisionUrl).expect(302);

    const redirected = new URL(String(decisionResponse.headers.location));
    assert.equal(redirected.searchParams.get('state'), 'demo-state');
    const code = redirected.searchParams.get('code');
    assert.ok(code);

    const tokenResponse = await request(app)
      .post('/oauth2/token')
      .set('Authorization', applicationBasicAuthorization)
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
      .set('Authorization', applicationBasicAuthorization)
      .type('form')
      .send({ token: tokenResponse.body.access_token })
      .expect(200);

    assert.equal(introspection.body.active, true);

    await request(app)
      .post('/oauth2/revoke')
      .set('Authorization', applicationBasicAuthorization)
      .type('form')
      .send({ token: tokenResponse.body.refresh_token })
      .expect(200);

    const revokedRefresh = await request(app)
      .post('/oauth2/introspect')
      .set('Authorization', applicationBasicAuthorization)
      .type('form')
      .send({ token: tokenResponse.body.refresh_token })
      .expect(200);

    assert.equal(revokedRefresh.body.active, false);
  });

  it('supports upstream oauth login, ticket exchange and refresh task', async () => {
    const { app, prisma } = context;

    const strategies = await withClientAuth(request(app).get('/api/auth/strategies')).expect(200);
    assert.ok(
      strategies.body.data.oauthProviders.some(
        (provider: { code: string }) => provider.code === 'demo-provider',
      ),
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

  it('revokes external refresh tokens when the upstream provider returns invalid_grant', async () => {
    const { app, prisma } = context;

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

    await withClientAuth(request(app).post('/api/auth/oauth/tickets/exchange'))
      .send({ ticket })
      .expect(200);

    const [externalRefreshToken, activeAccessToken] = await Promise.all([
      prisma.oAuthToken.findFirst({
        where: {
          kind: 'EXTERNAL_REFRESH_TOKEN',
          revokedAt: null,
        },
        select: {
          id: true,
        },
      }),
      prisma.oAuthToken.findFirst({
        where: {
          kind: 'EXTERNAL_ACCESS_TOKEN',
          revokedAt: null,
        },
        select: {
          id: true,
        },
      }),
    ]);

    assert.ok(externalRefreshToken);
    assert.ok(activeAccessToken);

    const invalidRefreshToken = 'upstream-refresh-invalid';
    await prisma.oAuthToken.update({
      where: { id: externalRefreshToken.id },
      data: {
        tokenHash: hashOpaqueToken(invalidRefreshToken),
        encryptedValue: encryptOAuthSecret(invalidRefreshToken),
        refreshAt: new Date(Date.now() - 60_000),
      },
    });

    const refreshResult = await refreshExternalOAuthAccessTokens();
    assert.equal(refreshResult.refreshed, 0);
    assert.equal(refreshResult.failed, 1);

    const [revokedRefreshToken, remainingActiveRefreshToken, stillActiveAccessToken] = await Promise.all([
      prisma.oAuthToken.findUnique({
        where: { id: externalRefreshToken.id },
        select: {
          revokedAt: true,
        },
      }),
      prisma.oAuthToken.findFirst({
        where: {
          kind: 'EXTERNAL_REFRESH_TOKEN',
          revokedAt: null,
        },
        select: {
          id: true,
        },
      }),
      prisma.oAuthToken.findUnique({
        where: { id: activeAccessToken.id },
        select: {
          revokedAt: true,
        },
      }),
    ]);

    assert.ok(revokedRefreshToken?.revokedAt);
    assert.equal(remainingActiveRefreshToken, null);
    assert.equal(stillActiveAccessToken?.revokedAt, null);
  });

  it('reuses an existing provider link for the same user when the upstream subject changes', async () => {
    const { app, prisma } = context;

    const [provider, adminUser] = await Promise.all([
      prisma.oAuthProvider.findUnique({
        where: { code: 'demo-provider' },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { email: 'admin@example.com' },
        select: { id: true },
      }),
    ]);

    assert.ok(provider);
    assert.ok(adminUser);

    const existingLink = await prisma.oAuthUser.create({
      data: withSnowflakeId({
        providerId: provider.id,
        providerSubject: 'legacy-demo-subject',
        userId: adminUser.id,
        email: 'admin@example.com',
        username: 'legacy_admin',
        nickname: 'Legacy Admin',
        avatarUrl: 'https://example.com/legacy.png',
        rawProfile: {
          sub: 'legacy-demo-subject',
          email: 'admin@example.com',
        },
        lastLoginAt: new Date(),
        lastSyncedAt: new Date(),
      }),
      select: {
        id: true,
      },
    });

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

    const exchanged = await withClientAuth(request(app).post('/api/auth/oauth/tickets/exchange'))
      .send({ ticket })
      .expect(200);

    assert.equal(exchanged.body.data.user.email, 'admin@example.com');

    const providerLinks = await prisma.oAuthUser.findMany({
      where: {
        providerId: provider.id,
        userId: adminUser.id,
      },
      select: {
        id: true,
        providerSubject: true,
        email: true,
      },
    });

    assert.equal(providerLinks.length, 1);
    assert.equal(providerLinks[0].id, existingLink.id);
    assert.equal(providerLinks[0].providerSubject, 'demo-upstream-user');
    assert.equal(providerLinks[0].email, 'admin@example.com');
  });
});
