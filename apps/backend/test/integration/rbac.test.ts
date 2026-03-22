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

describe('RBAC integration', () => {
  it('prevents ordinary members from reading admin resources', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user@example.com', 'User123!');

    await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    const usersResponse = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);

    assert.match(usersResponse.body.message, /Missing permission: user\.read/);
  });

  it('lets admins create permission-role-user chains and inspect permission sources', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const permissionResponse = await request(app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'report.export',
        name: '导出报表',
        module: 'report',
        action: 'export',
        description: '导出运营报表',
      })
      .expect(200);

    const roleResponse = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'report-operator',
        name: '报表运营',
        description: '可导出报表',
        permissionIds: [permissionResponse.body.data.id],
      })
      .expect(200);

    const userResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'reporter',
        email: 'reporter@example.com',
        nickname: '报表员',
        password: 'Reporter123!',
        status: 'ACTIVE',
        roleIds: [roleResponse.body.data.id],
      })
      .expect(200);

    const sourceResponse = await request(app)
      .get(`/api/users/${userResponse.body.data.id}/permission-sources`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const effectiveCodes = sourceResponse.body.data.effectivePermissions.map((item: { code: string }) => item.code);
    assert.ok(effectiveCodes.includes('report.export'));
    assert.equal(sourceResponse.body.data.groups[0].role.code, 'report-operator');

    const memberSession = await loginAs(app, 'reporter@example.com', 'Reporter123!');
    const meResponse = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`),
    ).expect(200);

    assert.ok(meResponse.body.data.permissions.includes('report.export'));
  });

  it('invalidates cached permissions after role updates', async () => {
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

    const roleResponse = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom-reader',
        name: '自定义读者',
        description: '测试缓存失效',
        permissionIds: [permissionA.body.data.id],
      })
      .expect(200);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'cachetester',
        email: 'cachetester@example.com',
        nickname: '缓存测试员',
        password: 'Cache123!',
        status: 'ACTIVE',
        roleIds: [roleResponse.body.data.id],
      })
      .expect(200);

    const userSession = await loginAs(app, 'cachetester@example.com', 'Cache123!');
    const beforeUpdate = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`),
    ).expect(200);

    assert.ok(beforeUpdate.body.data.permissions.includes('custom.read-a'));
    assert.equal(beforeUpdate.body.data.permissions.includes('custom.read-b'), false);

    await request(app)
      .put(`/api/roles/${roleResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'custom-reader',
        name: '自定义读者',
        description: '测试缓存失效',
        permissionIds: [permissionB.body.data.id],
      })
      .expect(200);

    const afterUpdate = await withClientAuth(
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`),
    ).expect(200);

    assert.equal(afterUpdate.body.data.permissions.includes('custom.read-a'), false);
    assert.ok(afterUpdate.body.data.permissions.includes('custom.read-b'));
  });

  it('blocks deleting referenced records until business code clears the relation', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const permissionResponse = await request(app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'guarded.read',
        name: '引用校验权限',
        module: 'guarded',
        action: 'read',
        description: '用于验证统一删除检查器',
      })
      .expect(200);

    const roleResponse = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'guarded-role',
        name: '引用校验角色',
        description: '用于验证统一删除检查器',
        permissionIds: [permissionResponse.body.data.id],
      })
      .expect(200);

    const userResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'guardeduser',
        email: 'guardeduser@example.com',
        nickname: '引用校验用户',
        password: 'Guarded123!',
        status: 'ACTIVE',
        roleIds: [roleResponse.body.data.id],
      })
      .expect(200);

    const blockedRoleDelete = await request(app)
      .delete(`/api/roles/${roleResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedRoleDelete.body.message, /UserRole\.role/);

    await request(app)
      .delete(`/api/users/${userResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/roles/${roleResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
  });

  it('enforces assignment permissions for scoped operators', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const permissionList = await request(app)
      .get('/api/permissions')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const roleList = await request(app)
      .get('/api/roles')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const userCreatePermission = permissionList.body.data.items.find((item: { code: string }) => item.code === 'user.create');
    const roleUpdatePermission = permissionList.body.data.items.find((item: { code: string }) => item.code === 'role.update');
    const dashboardPermission = permissionList.body.data.items.find((item: { code: string }) => item.code === 'dashboard.view');
    const memberRole = roleList.body.data.items.find((item: { code: string }) => item.code === 'member');

    assert.ok(userCreatePermission);
    assert.ok(roleUpdatePermission);
    assert.ok(dashboardPermission);
    assert.ok(memberRole);

    const limitedUserCreatorRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'limited-user-creator',
        name: '受限建号员',
        description: '仅允许创建用户，不允许绑定角色',
        permissionIds: [userCreatePermission.id],
      })
      .expect(200);

    const limitedRoleEditorRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'limited-role-editor',
        name: '受限角色编辑员',
        description: '仅允许编辑角色基础信息，不允许改权限',
        permissionIds: [roleUpdatePermission.id],
      })
      .expect(200);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'limitedcreator',
        email: 'limitedcreator@example.com',
        nickname: '受限建号员',
        password: 'Limited123!',
        status: 'ACTIVE',
        roleIds: [limitedUserCreatorRole.body.data.id],
      })
      .expect(200);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'limitededitor',
        email: 'limitededitor@example.com',
        nickname: '受限角色编辑员',
        password: 'Limited123!',
        status: 'ACTIVE',
        roleIds: [limitedRoleEditorRole.body.data.id],
      })
      .expect(200);

    const limitedCreatorSession = await loginAs(app, 'limitedcreator@example.com', 'Limited123!');
    const createUserDenied = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${limitedCreatorSession.tokens.accessToken}`)
      .send({
        username: 'blockedmember',
        email: 'blockedmember@example.com',
        nickname: '失败成员',
        password: 'Blocked123!',
        status: 'ACTIVE',
        roleIds: [memberRole.id],
      })
      .expect(400);

    assert.match(createUserDenied.body.message, /user\.assign-role/);

    const limitedEditorSession = await loginAs(app, 'limitededitor@example.com', 'Limited123!');
    const updateRoleDenied = await request(app)
      .put(`/api/roles/${limitedUserCreatorRole.body.data.id}`)
      .set('Authorization', `Bearer ${limitedEditorSession.tokens.accessToken}`)
      .send({
        code: 'limited-user-creator',
        name: '受限建号员',
        description: '仍然不允许改权限',
        permissionIds: [dashboardPermission.id],
      })
      .expect(400);

    assert.match(updateRoleDenied.body.message, /role\.assign-permission/);
  });
});
