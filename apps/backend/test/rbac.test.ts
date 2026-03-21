import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { before, beforeEach, after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';

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
let createApp: typeof import('../src/app.ts').createApp;
let redis: { disconnect: () => Promise<unknown> | void };

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

const loginAs = async (account: string, password: string) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ account, password })
    .expect(200);

  return response.body.data as {
    tokens: { accessToken: string; refreshToken: string };
    user: { id: string; permissions: string[] };
  };
};

before(async () => {
  execPrisma('db', 'push', '--skip-generate', '--accept-data-loss');
  ({ createApp } = await import('../src/app.ts'));
  ({ prisma } = await import('../src/lib/prisma.ts'));
  ({ redis } = await import('../src/lib/redis.ts'));
  ({ seedDatabase } = await import('../prisma/seed-data.ts'));
  app = createApp();
});
beforeEach(async () => {
  await seedDatabase(prisma);
});

after(async () => {
  await prisma?.$disconnect();
  await redis?.disconnect();
});

describe('RBAC backend', () => {
  it('supports register, me, refresh and logout', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
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

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assert.equal(meResponse.body.data.email, 'newmember@example.com');
    assert.deepEqual(meResponse.body.data.permissions, ['dashboard.view']);

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    assert.notEqual(refreshResponse.body.data.tokens.refreshToken, refreshToken);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshResponse.body.data.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: refreshResponse.body.data.tokens.refreshToken })
      .expect(200);
  });

  it('supports strategy discovery, verification and code-based auth flows', async () => {
    const strategiesResponse = await request(app)
      .get('/api/auth/strategies')
      .expect(200);

    assert.deepEqual(
      strategiesResponse.body.data.loginStrategies.map((item: { code: string }) => item.code),
      ['username-password', 'email-code', 'phone-code'],
    );

    const emailCodeSend = await request(app)
      .post('/api/auth/verification-codes/send')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(emailCodeSend.body.data.mockCode, '123456');

    const emailCodeVerify = await request(app)
      .post('/api/auth/verification-codes/verify')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
        code: '123456',
      })
      .expect(200);

    assert.equal(emailCodeVerify.body.data.valid, true);

    const emailCodeLogin = await request(app)
      .post('/api/auth/login')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        code: '123456',
      })
      .expect(200);

    assert.equal(emailCodeLogin.body.data.user.email, 'admin@example.com');

    const phoneIdentifier = '13800000999';
    const phoneRegisterSend = await request(app)
      .post('/api/auth/verification-codes/send')
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'REGISTER',
      })
      .expect(200);

    assert.equal(phoneRegisterSend.body.data.mockCode, '654321');

    await request(app)
      .post('/api/auth/verification-codes/verify')
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'REGISTER',
        code: '654321',
      })
      .expect(200);

    const phoneRegister = await request(app)
      .post('/api/auth/register')
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

    const phoneLoginSend = await request(app)
      .post('/api/auth/verification-codes/send')
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(phoneLoginSend.body.data.mockCode, '654321');

    const phoneLogin = await request(app)
      .post('/api/auth/login')
      .send({
        strategyCode: 'phone-code',
        identifier: phoneIdentifier,
        code: '654321',
      })
      .expect(200);

    assert.equal(phoneLogin.body.data.user.username, 'phonejoiner');
  });

  it('links email-code auth to password accounts and respects login toggles', async () => {
    const selfRegisteredEmail = 'emailbridge@example.com';
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'emailbridge',
        email: selfRegisteredEmail,
        nickname: '邮箱桥接',
        password: 'Bridge123!',
      })
      .expect(200);

    const selfRegisterSend = await request(app)
      .post('/api/auth/verification-codes/send')
      .send({
        strategyCode: 'email-code',
        identifier: selfRegisteredEmail,
        purpose: 'LOGIN',
      })
      .expect(200);

    assert.equal(selfRegisterSend.body.data.mockCode, '123456');

    const adminSession = await loginAs('admin@example.com', 'Admin123!');
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

    const managedSend = await request(app)
      .post('/api/auth/verification-codes/send')
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

    const disabledSend = await request(app)
      .post('/api/auth/verification-codes/send')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
      })
      .expect(400);

    assert.match(disabledSend.body.message, /Login is not enabled/);

    const disabledVerify = await request(app)
      .post('/api/auth/verification-codes/verify')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        purpose: 'LOGIN',
        code: '123456',
      })
      .expect(400);

    assert.match(disabledVerify.body.message, /Login is not enabled/);

    const disabledLogin = await request(app)
      .post('/api/auth/login')
      .send({
        strategyCode: 'email-code',
        identifier: 'admin@example.com',
        code: '123456',
      })
      .expect(400);

    assert.match(disabledLogin.body.message, /Login is not enabled/);
  });

  it('prevents ordinary members from reading admin resources', async () => {
    const memberSession = await loginAs('user@example.com', 'User123!');

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
    const adminSession = await loginAs('admin@example.com', 'Admin123!');

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

    const memberSession = await loginAs('reporter@example.com', 'Reporter123!');
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(meResponse.body.data.permissions.includes('report.export'));
  });

  it('invalidates cached permissions after role updates', async () => {
    const adminSession = await loginAs('admin@example.com', 'Admin123!');

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

    const userSession = await loginAs('cachetester@example.com', 'Cache123!');
    const beforeUpdate = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
      .expect(200);

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

    const afterUpdate = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(afterUpdate.body.data.permissions.includes('custom.read-a'), false);
    assert.ok(afterUpdate.body.data.permissions.includes('custom.read-b'));
  });

  it('returns 400 instead of 500 for duplicate unique values', async () => {
    const adminSession = await loginAs('admin@example.com', 'Admin123!');

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

  it('protects audit logs and immutable seed identifiers', async () => {
    const memberSession = await loginAs('user@example.com', 'User123!');
    await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);

    const adminSession = await loginAs('admin@example.com', 'Admin123!');
    const auditResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(auditResponse.body.data.items.length > 0);

    const permissionList = await request(app)
      .get('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
    const dashboardPermission = permissionList.body.data.find((item: { code: string }) => item.code === 'dashboard.view');

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
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
    const memberRole = roleList.body.data.find((item: { code: string }) => item.code === 'member');

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
    const adminSession = await loginAs('admin@example.com', 'Admin123!');

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

    const currentAdmin = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

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

  it('enforces assignment permissions for scoped operators', async () => {
    const adminSession = await loginAs('admin@example.com', 'Admin123!');

    const permissionList = await request(app)
      .get('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const roleList = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const userCreatePermission = permissionList.body.data.find((item: { code: string }) => item.code === 'user.create');
    const roleUpdatePermission = permissionList.body.data.find((item: { code: string }) => item.code === 'role.update');
    const dashboardPermission = permissionList.body.data.find((item: { code: string }) => item.code === 'dashboard.view');
    const memberRole = roleList.body.data.find((item: { code: string }) => item.code === 'member');

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

    const limitedCreatorSession = await loginAs('limitedcreator@example.com', 'Limited123!');
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

    const limitedEditorSession = await loginAs('limitededitor@example.com', 'Limited123!');
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

