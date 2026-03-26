import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { AuthClientType } from '@rbac/api-common';
import request from 'supertest';
import { verifyAccessToken } from '../../src/utils/token';
import {
  appClient,
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  uploadManagedFileForTest,
  uniClient,
  webClient,
  webH5Client,
  withClientAuth,
} from '../support/backend-testkit';

let context: BackendTestContext;

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('Auth integration', () => {
  it('requires valid client credentials for auth routes and stamps tokens with client identity', async () => {
    const { app } = context;

    await request(app)
      .get('/api/auth/strategies')
      .expect(401);

    const invalidClientResponse = await withClientAuth(request(app).get('/api/auth/strategies'), {
      code: webClient.code,
      secret: 'wrong-client-secret',
      type: AuthClientType.WEB,
      origin: webClient.origin,
    })
      .expect(401);

    assert.match(invalidClientResponse.body.message, /client/i);

    const invalidWebOriginResponse = await withClientAuth(request(app).get('/api/auth/strategies'), {
      ...webClient,
      origin: 'https://malicious.example.com',
    })
      .expect(401);

    assert.match(invalidWebOriginResponse.body.message, /client/i);

    await withClientAuth(request(app).get('/api/auth/strategies'), {
      ...webClient,
      origin: 'http://localhost:4173',
    })
      .expect(200);

    const invalidMiniappResponse = await withClientAuth(request(app).get('/api/auth/strategies'), {
      ...uniClient,
      appId: 'wrong-miniapp-appid',
    })
      .expect(401);

    assert.match(invalidMiniappResponse.body.message, /client/i);

    const invalidAppResponse = await withClientAuth(request(app).get('/api/auth/strategies'), {
      ...appClient,
      packageName: 'com.example.invalid',
    })
      .expect(401);

    assert.match(invalidAppResponse.body.message, /client/i);

    const webSession = await loginAs(app, 'admin@example.com', 'Admin123!', webClient);
    const uniSession = await loginAs(app, 'admin@example.com', 'Admin123!', uniClient);
    const appSession = await loginAs(app, 'admin@example.com', 'Admin123!', appClient);

    assert.equal(webSession.client.code, webClient.code);
    assert.equal(verifyAccessToken(webSession.tokens.accessToken).client.code, webClient.code);
    assert.equal(verifyAccessToken(webSession.tokens.accessToken).client.type, webClient.type);
    assert.equal(verifyAccessToken(uniSession.tokens.accessToken).client.code, uniClient.code);
    assert.equal(verifyAccessToken(appSession.tokens.accessToken).client.code, appClient.code);
    assert.equal(verifyAccessToken(appSession.tokens.accessToken).client.type, appClient.type);

    const crossClientMe = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${webSession.tokens.accessToken}`),
      uniClient,
    ).expect(401);

    assert.match(crossClientMe.body.message, /Invalid or expired token/);

    const crossClientRefresh = await withClientAuth(request(app).post('/api/auth/refresh'), uniClient)
      .send({ refreshToken: webSession.tokens.refreshToken })
      .expect(401);

    assert.match(crossClientRefresh.body.message, /client/i);

    const crossClientLogout = await withClientAuth(request(app).post('/api/auth/logout'), uniClient)
      .send({ refreshToken: webSession.tokens.refreshToken })
      .expect(401);

    assert.match(crossClientLogout.body.message, /client/i);
  });

  it('supports register, me, refresh and logout', async () => {
    const { app } = context;

    const registerResponse = await withClientAuth(request(app).post('/api/auth/register'))
      .send({
        username: 'newmember',
        email: 'newmember@example.com',
        nickname: '新成员',
        password: 'Member123!',
      })
      .expect(200);

    assert.equal(registerResponse.body.success, true);
    assert.equal(registerResponse.body.data.user.email, 'newmember@example.com');
    assert.deepEqual(
      registerResponse.body.data.user.roles.map((role: { code: string }) => role.code),
      ['member'],
    );

    const accessToken = registerResponse.body.data.tokens.accessToken as string;
    const refreshToken = registerResponse.body.data.tokens.refreshToken as string;

    const meResponse = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`),
    ).expect(200);

    assert.equal(meResponse.body.data.email, 'newmember@example.com');
    assert.deepEqual(
      [...meResponse.body.data.permissions].sort(),
      [
        'dashboard.view',
        'file.upload.avatar',
        'realtime.topic.chat-global.subscribe',
        'realtime.topic.user-rbac.subscribe-self',
      ].sort(),
    );

    const refreshResponse = await withClientAuth(request(app).post('/api/auth/refresh'))
      .send({ refreshToken })
      .expect(200);

    assert.notEqual(refreshResponse.body.data.tokens.refreshToken, refreshToken);
    assert.equal(refreshResponse.body.data.client.code, webClient.code);

    await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshResponse.body.data.tokens.accessToken}`),
    ).expect(200);

    await withClientAuth(request(app).post('/api/auth/logout'))
      .send({ refreshToken: refreshResponse.body.data.tokens.refreshToken })
      .expect(200);
  });

  it('seeds a dedicated localhost:9000 web client for uni h5 development', async () => {
    const { app, prisma } = context;

    const seededClient = await prisma.authClient.findUnique({
      where: { code: webH5Client.code },
      select: { code: true, type: true, enabled: true, config: true },
    });

    assert.ok(seededClient);
    assert.equal(seededClient.code, webH5Client.code);
    assert.equal(seededClient.type, AuthClientType.WEB);
    assert.equal(seededClient.enabled, true);
    assert.deepEqual(seededClient.config, {
      protocol: 'http',
      host: 'localhost',
      port: 9000,
    });

    await withClientAuth(request(app).get('/api/auth/strategies'), webH5Client)
      .expect(200);

    const session = await loginAs(app, 'admin@example.com', 'Admin123!', webH5Client);
    assert.equal(session.client.code, webH5Client.code);
    assert.equal(verifyAccessToken(session.tokens.accessToken).client.code, webH5Client.code);
  });

  it('persists workbench preferences on the current user session', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const preferencesPayload = {
      workbench: {
        themePresetId: 'graphite',
        themeMode: 'dark',
        sidebarAppearance: 'light',
        sidebarCollapsed: true,
        layoutMode: 'tabs',
        pageTransition: 'slide',
        cachedTabDisplayMode: 'browser',
        visitedTabs: [
          {
            path: '/console/dashboard',
            name: 'console-dashboard',
            title: '控制台总览',
            code: 'dashboard',
            icon: 'i-carbon-home',
            closable: false,
          },
        ],
        pageStateMap: {
          'users:list': {
            keyword: 'admin',
            page: 2,
          },
        },
      },
    };

    const updateResponse = await withClientAuth(
      request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    )
      .send(preferencesPayload)
      .expect(200);

    assert.deepEqual(updateResponse.body.data, preferencesPayload);

    const meResponse = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    ).expect(200);

    assert.deepEqual(meResponse.body.data.preferences, preferencesPayload);

    const refreshResponse = await withClientAuth(request(app).post('/api/auth/refresh'))
      .send({ refreshToken: adminSession.tokens.refreshToken })
      .expect(200);

    assert.deepEqual(refreshResponse.body.data.user.preferences, preferencesPayload);
  });

  it('updates the current user profile and refreshes the returned session payload', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!', uniClient);

    const updateResponse = await withClientAuth(
      request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`),
      uniClient,
    )
      .send({
        nickname: '移动端用户',
        email: 'mobile-user@example.com',
      })
      .expect(200);

    assert.equal(updateResponse.body.data.nickname, '移动端用户');
    assert.equal(updateResponse.body.data.email, 'mobile-user@example.com');

    const meResponse = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`),
      uniClient,
    ).expect(200);

    assert.equal(meResponse.body.data.nickname, '移动端用户');
    assert.equal(meResponse.body.data.email, 'mobile-user@example.com');
  });

  it('merges app preferences with existing workbench preferences instead of overwriting them', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const workbenchPayload = {
      workbench: {
        themePresetId: 'graphite',
        themeMode: 'dark',
        sidebarAppearance: 'light',
        sidebarCollapsed: true,
        layoutMode: 'tabs',
        pageTransition: 'slide',
        cachedTabDisplayMode: 'browser',
        visitedTabs: [],
        pageStateMap: {
          'dashboard:list': {
            page: 1,
          },
        },
      },
    };

    await withClientAuth(
      request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    )
      .send(workbenchPayload)
      .expect(200);

    const appPayload = {
      app: {
        themeMode: 'auto',
        themePresetId: 'ocean',
        surfaceStyle: 'glass',
        density: 'comfortable',
        tabbarStyle: 'floating',
        portalLayout: 'overview',
        motionEnabled: true,
      },
    };

    const updateResponse = await withClientAuth(
      request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    )
      .send(appPayload)
      .expect(200);

    assert.deepEqual(updateResponse.body.data, {
      ...workbenchPayload,
      ...appPayload,
    });

    const meResponse = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    ).expect(200);

    assert.deepEqual(meResponse.body.data.preferences, {
      ...workbenchPayload,
      ...appPayload,
    });
  });

  it('allows members to upload avatars through managed uploads but still blocks attachment uploads', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!', uniClient);

    const avatarUpload = await uploadManagedFileForTest(app, {
      accessToken: memberSession.tokens.accessToken,
      fileName: 'mobile-avatar.png',
      contentType: 'image/png',
      content: 'mobile-avatar-binary',
      kind: 'avatar',
    });

    assert.match(avatarUpload.url, /avatars\//);

    const avatarResponse = await withClientAuth(
      request(app)
        .put('/api/auth/avatar')
        .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`),
      uniClient,
    )
      .send({ avatarFileId: avatarUpload.fileId })
      .expect(200);

    assert.equal(avatarResponse.body.data.avatarFileId, avatarUpload.fileId);
    assert.match(avatarResponse.body.data.avatarUrl, /avatars\//);

    const deniedPrepare = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'blocked.txt',
        contentType: 'text/plain',
        size: 12,
      })
      .expect(403);

    assert.match(deniedPrepare.body.message, /file\.upload/i);

    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const strippedMember = await prisma.user.findUnique({
      where: { username: 'user' },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        status: true,
      },
    });

    assert.ok(strippedMember);

    await withClientAuth(
      request(app)
      .put(`/api/users/${strippedMember.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    )
      .send({
        username: strippedMember.username,
        email: strippedMember.email,
        nickname: strippedMember.nickname,
        status: strippedMember.status,
        roleIds: [],
      })
      .expect(200);

    await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'avatar',
        fileName: 'blocked-avatar.png',
        contentType: 'image/png',
        size: 24,
      })
      .expect(403);
  });

  it('supports strategy discovery, verification and code-based auth flows', async () => {
    const { app } = context;

    const strategiesResponse = await withClientAuth(request(app).get('/api/auth/strategies'))
      .expect(200);

    assert.deepEqual(
      strategiesResponse.body.data.loginStrategies.map((item: { code: string }) => item.code),
      ['username-password', 'email-code', 'phone-code'],
    );

    const emailCodeSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(emailCodeSend.body.data.mockCode, '123456');

    const emailCodeVerify = await withClientAuth(request(app).post('/api/auth/verification-codes/verify'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
        code: '123456',
      })
      .expect(200);

    assert.equal(emailCodeVerify.body.data.valid, true);

    const emailCodeLogin = await withClientAuth(request(app).post('/api/auth/login'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        code: '123456',
      })
      .expect(200);

    assert.equal(emailCodeLogin.body.data.user.email, 'admin@example.com');

    const phoneIdentifier = '13800000999';
    const phoneRegisterSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'REGISTER',
      })
      .expect(200);

    assert.equal(phoneRegisterSend.body.data.mockCode, '654321');

    await withClientAuth(request(app).post('/api/auth/verification-codes/verify'))
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'REGISTER',
        code: '654321',
      })
      .expect(200);

    const phoneRegister = await withClientAuth(request(app).post('/api/auth/register'))
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        username: 'phonejoiner',
        nickname: '手机号注册用户',
        code: '654321',
      })
      .expect(200);

    assert.equal(phoneRegister.body.data.user.email, null);
    assert.equal(phoneRegister.body.data.user.username, 'phonejoiner');

    const phoneLoginSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(phoneLoginSend.body.data.mockCode, '654321');

    const phoneLogin = await withClientAuth(request(app).post('/api/auth/login'))
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        code: '654321',
      })
      .expect(200);

    assert.equal(phoneLogin.body.data.user.username, 'phonejoiner');
  });

  it('links email-code auth to password accounts and respects login toggles', async () => {
    const { app, prisma } = context;
    const selfRegisteredEmail = 'emailbridge@example.com';

    await withClientAuth(request(app).post('/api/auth/register'))
      .send({
        username: 'emailbridge',
        email: selfRegisteredEmail,
        nickname: '邮箱桥接',
        password: 'Bridge123!',
      })
      .expect(200);

    const selfRegisterSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'email-code',
        identifier: selfRegisteredEmail,
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(selfRegisterSend.body.data.mockCode, '123456');

    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const memberRole = await prisma.role.findUnique({
      where: { code: 'member' },
      select: { id: true },
    });

    assert.ok(memberRole);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'managedmail',
        email: 'managedmail@example.com',
        nickname: '后台建号用户',
        password: 'Managed123!',
        status: 'ACTIVE',
        roleIds: [memberRole.id],
      })
      .expect(200);

    const managedSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'email-code',
        identifier: 'managedmail@example.com',
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(managedSend.body.data.mockCode, '123456');

    await prisma.authStrategy.update({
      where: { code: 'email-code' },
      data: { loginEnabled: false },
    });

    const disabledSend = await withClientAuth(request(app).post('/api/auth/verification-codes/send'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
      })
      .expect(400);

    assert.match(disabledSend.body.message, /Login is not enabled/);

    const disabledVerify = await withClientAuth(request(app).post('/api/auth/verification-codes/verify'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
        code: '123456',
      })
      .expect(400);

    assert.match(disabledVerify.body.message, /Login is not enabled/);

    const disabledLogin = await withClientAuth(request(app).post('/api/auth/login'))
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        code: '123456',
      })
      .expect(400);

    assert.match(disabledLogin.body.message, /Login is not enabled/);
  });
});
