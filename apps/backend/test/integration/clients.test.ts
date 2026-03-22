import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  binaryParser,
  bootstrapBackendTestContext,
  type BackendTestContext,
  loadWorksheet,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  webClient,
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

describe('Client integration', () => {
  it('supports client management with typed config and protects the current request client', async () => {
    const { app, prisma } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const createdClient = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'partner-miniapp',
        name: '合作方小程序',
        type: 'UNI_WECHAT_MINIAPP',
        description: '外部合作微信小程序',
        enabled: true,
        clientSecret: 'partner-miniapp-secret',
        config: {
          appId: 'wx-partner-appid',
          appSecret: 'wx-partner-secret',
        },
      })
      .expect(200);

    assert.equal(createdClient.body.data.code, 'partner-miniapp');
    assert.equal(createdClient.body.data.type, 'UNI_WECHAT_MINIAPP');
    assert.equal(createdClient.body.data.config.appId, 'wx-partner-appid');
    assert.equal(createdClient.body.data.config.appSecret, 'wx-partner-secret');

    const clientList = await request(app)
      .get('/api/clients')
      .query({ page: 1, pageSize: 20, type: 'UNI_WECHAT_MINIAPP', enabled: 'enabled' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(clientList.body.data.items.some((item: { code: string }) => item.code === 'partner-miniapp'));

    const clientId = createdClient.body.data.id as string;
    const clientDetail = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(clientDetail.body.data.name, '合作方小程序');

    const updatedClient = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'partner-miniapp',
        name: '合作方小程序二期',
        type: 'UNI_WECHAT_MINIAPP',
        description: '升级后的合作方微信小程序',
        enabled: false,
        clientSecret: 'partner-miniapp-secret-v2',
        config: {
          appId: 'wx-partner-appid-v2',
          appSecret: 'wx-partner-secret-v2',
        },
      })
      .expect(200);

    assert.equal(updatedClient.body.data.enabled, false);
    assert.equal(updatedClient.body.data.config.appId, 'wx-partner-appid-v2');
    assert.equal(updatedClient.body.data.config.appSecret, 'wx-partner-secret-v2');

    const currentWebClient = await prisma.authClient.findUnique({
      where: { code: webClient.code },
      select: { id: true },
    });

    assert.ok(currentWebClient);

    const disableCurrentClient = await request(app)
      .put(`/api/clients/${currentWebClient.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: webClient.code,
        name: 'Web 管理后台',
        type: 'WEB',
        description: '浏览器端控制台客户端',
        enabled: false,
        config: {
          protocol: 'http',
          host: 'localhost',
          port: 5173,
        },
      })
      .expect(400);

    assert.match(disableCurrentClient.body.message, /当前请求使用的客户端/);

    const deleteCurrentClient = await request(app)
      .delete(`/api/clients/${currentWebClient.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(deleteCurrentClient.body.message, /当前请求使用的客户端/);

    await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
  });

  it('protects audit export and returns filtered client exports', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user@example.com', 'User123!');

    await request(app)
      .get('/api/audit-logs/export')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);

    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'export-miniapp',
        name: '导出测试小程序',
        type: 'UNI_WECHAT_MINIAPP',
        description: '用于测试导出过滤',
        enabled: true,
        clientSecret: 'export-miniapp-secret',
        config: {
          appId: 'wx-export-appid',
          appSecret: 'wx-export-secret',
        },
      })
      .expect(200);

    const clientExport = await request(app)
      .get('/api/clients/export')
      .query({ type: 'UNI_WECHAT_MINIAPP', enabled: 'enabled', q: '导出测试' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const clientSheet = await loadWorksheet(clientExport.body as Buffer);
    assert.equal(clientSheet.name, 'Clients');
    assert.equal(clientSheet.getRow(1).getCell(1).value, '客户端编码');
    assert.equal(clientSheet.rowCount, 2);
    assert.equal(clientSheet.getRow(2).getCell(1).value, 'export-miniapp');
    assert.equal(clientSheet.getRow(2).getCell(3).value, 'UNI_WECHAT_MINIAPP');
  });
});
