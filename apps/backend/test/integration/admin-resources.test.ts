import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
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

describe('Admin resource integration', () => {
  it('returns 400 instead of 500 for duplicate unique values', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const duplicateRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'super-admin',
        name: '重复角色',
        description: '重复角色编码',
        permissionIds: [],
      })
      .expect(400);

    assert.match(duplicateRole.body.message, /Unique constraint failed/);
  });

  it('paginates roles, permissions, selector options and realtime message history', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const permissionA = await request(app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom.read-a',
        name: '读取 A',
        module: 'custom',
        action: 'read-a',
        description: '自定义读取 A',
      })
      .expect(200);

    const permissionB = await request(app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom.read-b',
        name: '读取 B',
        module: 'custom',
        action: 'read-b',
        description: '自定义读取 B',
      })
      .expect(200);

    await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom-reader',
        name: '自定义读者',
        description: '负责读取 A',
        permissionIds: [permissionA.body.data.id],
      })
      .expect(200);

    await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom-auditor',
        name: '自定义审计员',
        description: '负责读取 B',
        permissionIds: [permissionB.body.data.id],
      })
      .expect(200);

    const permissionPage = await request(app)
      .get('/api/permissions')
      .query({ page: 1, pageSize: 1, module: 'custom', sourceType: 'custom' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(permissionPage.body.data.meta.total, 2);
    assert.equal(permissionPage.body.data.items.length, 1);
    assert.equal(permissionPage.body.data.meta.page, 1);
    assert.equal(permissionPage.body.data.meta.pageSize, 1);

    const rolePage = await request(app)
      .get('/api/roles')
      .query({
        page: 1,
        pageSize: 10,
        q: '读者',
        permissionId: permissionA.body.data.id,
        roleType: 'custom',
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(rolePage.body.data.meta.total, 1);
    assert.equal(rolePage.body.data.items[0].code, 'custom-reader');

    const roleOptionsPage = await request(app)
      .post('/api/users/options/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ page: 1, pageSize: 1, code: 'custom-auditor' })
      .expect(200);

    assert.equal(roleOptionsPage.body.data.meta.total, 1);
    assert.equal(roleOptionsPage.body.data.items[0].code, 'custom-auditor');

    const permissionOptionsPage = await request(app)
      .post('/api/roles/options/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ page: 1, pageSize: 1, module: 'custom', action: 'read-b' })
      .expect(200);

    assert.equal(permissionOptionsPage.body.data.meta.total, 1);
    assert.equal(permissionOptionsPage.body.data.items[0].code, 'custom.read-b');

    const menuPermissionOptions = await request(app)
      .post('/api/menus/options/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ page: 1, pageSize: 5, code: 'dashboard.view' })
      .expect(200);

    assert.ok(menuPermissionOptions.body.data.meta.total >= 1);
    assert.ok(
      menuPermissionOptions.body.data.items.some(
        (item: { code: string }) => item.code === 'dashboard.view',
      ),
    );

    const messagePage = await request(app)
      .get('/api/realtime/messages')
      .query({ page: 1, pageSize: 2 })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(messagePage.body.data.meta.total, 3);
    assert.equal(messagePage.body.data.items.length, 2);
    assert.ok(
      new Date(messagePage.body.data.items[0].createdAt).getTime() <=
        new Date(messagePage.body.data.items[1].createdAt).getTime(),
    );
  });

  it('protects audit logs and immutable seed identifiers', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user@example.com', 'User123!');

    await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);

    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const auditResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(auditResponse.body.data.items.length > 0);

    const permissionList = await request(app)
      .get('/api/permissions')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
    const dashboardPermission = permissionList.body.data.items.find(
      (item: { code: string }) => item.code === 'dashboard.view',
    );

    const lockedPermission = await request(app)
      .put(`/api/permissions/${dashboardPermission.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'dashboard.changed',
        name: dashboardPermission.name,
        module: dashboardPermission.module,
        action: dashboardPermission.action,
        description: dashboardPermission.description,
      })
      .expect(400);

    assert.match(lockedPermission.body.message, /Seed permission/);

    const roleList = await request(app)
      .get('/api/roles')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
    const memberRole = roleList.body.data.items.find(
      (item: { code: string }) => item.code === 'member',
    );

    const lockedRole = await request(app)
      .put(`/api/roles/${memberRole.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'member-renamed',
        name: memberRole.name,
        description: memberRole.description,
        permissionIds: memberRole.permissions.map((item: { id: string }) => item.id),
      })
      .expect(400);

    assert.match(lockedRole.body.message, /System role code cannot be changed/);
  });

  it('supports full admin CRUD lifecycle and avatar upload', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const createdPermission = await request(app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'catalog.publish',
        name: '发布目录',
        module: 'catalog',
        action: 'publish',
        description: '允许发布目录内容',
      })
      .expect(200);

    const permissionDetail = await request(app)
      .get(`/api/permissions/${createdPermission.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(permissionDetail.body.data.code, 'catalog.publish');

    const updatedPermission = await request(app)
      .put(`/api/permissions/${createdPermission.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'catalog.publish',
        name: '发布目录',
        module: 'catalog',
        action: 'publish',
        description: '允许发布和上线目录内容',
      })
      .expect(200);

    assert.equal(updatedPermission.body.data.description, '允许发布和上线目录内容');

    const createdRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'catalog-publisher',
        name: '目录发布员',
        description: '负责目录发布',
        permissionIds: [createdPermission.body.data.id],
      })
      .expect(200);

    const roleDetail = await request(app)
      .get(`/api/roles/${createdRole.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(roleDetail.body.data.code, 'catalog-publisher');
    assert.equal(roleDetail.body.data.permissions.length, 1);

    const updatedRole = await request(app)
      .put(`/api/roles/${createdRole.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'catalog-publisher',
        name: '目录发布负责人',
        description: '负责目录发布与校验',
        permissionIds: [createdPermission.body.data.id],
      })
      .expect(200);

    assert.equal(updatedRole.body.data.name, '目录发布负责人');

    const createdUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'cataloger',
        email: 'cataloger@example.com',
        nickname: '目录发布员',
        password: 'Catalog123!',
        status: 'ACTIVE',
        roleIds: [createdRole.body.data.id],
      })
      .expect(200);

    const userDetail = await request(app)
      .get(`/api/users/${createdUser.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(userDetail.body.data.email, 'cataloger@example.com');

    const updatedUser = await request(app)
      .put(`/api/users/${createdUser.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'cataloger',
        email: 'cataloger@example.com',
        nickname: '目录负责人',
        status: 'ACTIVE',
        roleIds: [createdRole.body.data.id],
      })
      .expect(200);

    assert.equal(updatedUser.body.data.nickname, '目录负责人');

    const prepareResponse = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        kind: 'avatar',
        fileName: 'avatar.png',
        contentType: 'image/png',
        size: Buffer.byteLength('avatar-image-content'),
      })
      .expect(200);

    assert.equal(prepareResponse.body.data.strategy, 'single');
    assert.equal(prepareResponse.body.data.provider, 'local');

    const localUploadTarget = new URL(prepareResponse.body.data.parts[0].url);
    await request(app)
      .post(localUploadTarget.pathname)
      .field('token', prepareResponse.body.data.parts[0].fields.token)
      .attach('file', Buffer.from('avatar-image-content'), 'avatar.png')
      .expect(204);

    const uploadResponse = await request(app)
      .post('/api/files/callback')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ fileId: prepareResponse.body.data.fileId })
      .expect(200);

    assert.match(uploadResponse.body.data.url, /avatars\//);

    const currentAdmin = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`),
    ).expect(200);

    assert.match(currentAdmin.body.data.avatar, /avatars\//);

    await request(app)
      .delete(`/api/users/${createdUser.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/roles/${createdRole.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/permissions/${createdPermission.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .get(`/api/users/${createdUser.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);
  });
});
