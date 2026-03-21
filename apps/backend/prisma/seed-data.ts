import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { bootstrapSystemRbac } from '../src/services/system-rbac.js';

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.menuNode.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  const { roleByCode } = await bootstrapSystemRbac(prisma);
  const adminRole = roleByCode.get('super-admin');
  const managerRole = roleByCode.get('ops-manager');
  const userRole = roleByCode.get('member');

  if (!adminRole || !managerRole || !userRole) {
    throw new Error('System roles bootstrap failed');
  }

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
