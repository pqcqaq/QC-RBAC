import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { permissionCatalog } from '@rbac/api-common';

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  const permissions = await Promise.all(
    permissionCatalog.map((permission) =>
      prisma.permission.create({
        data: {
          code: permission.code,
          name: permission.name,
          module: permission.module,
          action: permission.action,
          description: `${permission.module} / ${permission.action}`,
        },
      }),
    ),
  );

  const allPermissionIds = permissions.map((item) => item.id);
  const managerPermissionIds = permissions
    .filter((item) => !['permission.delete', 'role.delete', 'user.delete'].includes(item.code))
    .map((item) => item.id);
  const memberPermissionIds = permissions
    .filter((item) => ['dashboard.view'].includes(item.code))
    .map((item) => item.id);

  const adminRole = await prisma.role.create({
    data: {
      code: 'super-admin',
      name: '超级管理员',
      description: '拥有系统所有权限。',
      isSystem: true,
      permissions: {
        create: allPermissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  });

  const managerRole = await prisma.role.create({
    data: {
      code: 'ops-manager',
      name: '运营经理',
      description: '可管理用户、角色并查看权限来源。',
      isSystem: true,
      permissions: {
        create: managerPermissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  });

  const userRole = await prisma.role.create({
    data: {
      code: 'member',
      name: '普通成员',
      description: '可登录并查看自己的权限信息。',
      isSystem: true,
      permissions: {
        create: memberPermissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  });

  const passwordHashes = {
    admin: await bcrypt.hash('Admin123!', 10),
    manager: await bcrypt.hash('Manager123!', 10),
    user: await bcrypt.hash('User123!', 10),
  };

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      nickname: '系统管理员',
      passwordHash: passwordHashes.admin,
      roles: { create: [{ roleId: adminRole.id }] },
    },
  });

  const manager = await prisma.user.create({
    data: {
      username: 'manager',
      email: 'manager@example.com',
      nickname: '运营经理',
      passwordHash: passwordHashes.manager,
      roles: { create: [{ roleId: managerRole.id }] },
    },
  });

  const member = await prisma.user.create({
    data: {
      username: 'user',
      email: 'user@example.com',
      nickname: '普通用户',
      passwordHash: passwordHashes.user,
      roles: { create: [{ roleId: userRole.id }] },
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      { senderId: admin.id, content: '欢迎来到 RBAC 协同频道。' },
      { senderId: manager.id, content: '角色调整后，前端会实时收到权限更新提醒。' },
      { senderId: member.id, content: '移动端也可以复用共享的 API 封装。' },
    ],
  });
}
