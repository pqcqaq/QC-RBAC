import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';
import { bootstrapSystemRbac } from '../src/services/system-rbac';
import { hashPassword, hashSecret } from '../src/utils/password';
import { withSnowflakeId, withSnowflakeIds } from '../src/utils/persistence';
import { syncUserRoles } from '../src/services/rbac-write';

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "VerificationCode",
      "UserAuthentication",
      "AuthStrategy",
      "MenuNode",
      "RolePermission",
      "UserRole",
      "RefreshToken",
      "AuthClient",
      "ActivityLog",
      "ChatMessage",
      "MediaAsset",
      "Permission",
      "Role",
      "User"
    RESTART IDENTITY CASCADE
  `);

  const { roleByCode } = await bootstrapSystemRbac(prisma);
  const adminRole = roleByCode.get('super-admin');
  const managerRole = roleByCode.get('ops-manager');
  const userRole = roleByCode.get('member');

  if (!adminRole || !managerRole || !userRole) {
    throw new Error('System roles bootstrap failed');
  }

  const [webClientSecret, uniMiniappClientSecret] = await Promise.all([
    hashSecret(env.AUTH_WEB_CLIENT_SECRET),
    hashSecret(env.AUTH_UNI_WECHAT_MINIAPP_CLIENT_SECRET),
  ]);

  await prisma.authClient.createMany({
    data: withSnowflakeIds([
      {
        code: 'web-console',
        name: 'Web 管理后台',
        type: 'WEB',
        description: '浏览器端控制台客户端',
        secretHash: webClientSecret.hash,
        salt: webClientSecret.salt,
        enabled: true,
      },
      {
        code: 'uni-wechat-miniapp',
        name: 'Uni 微信小程序',
        type: 'UNI_WECHAT_MINIAPP',
        description: '基于 uni-app 的微信小程序客户端',
        secretHash: uniMiniappClientSecret.hash,
        salt: uniMiniappClientSecret.salt,
        enabled: true,
      },
    ]),
  });

  const [usernamePasswordStrategy, emailCodeStrategy, phoneCodeStrategy] = await Promise.all([
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'username-password',
        name: '用户名密码',
        description: '使用用户名与密码完成登录或注册。',
        identifierType: 'USERNAME',
        credentialType: 'PASSWORD',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: false,
        mockEnabled: true,
        sortOrder: 10,
      }),
    }),
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'email-code',
        name: '邮箱验证码',
        description: '使用邮箱验证码完成登录或注册。',
        identifierType: 'EMAIL',
        credentialType: 'VERIFICATION_CODE',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: true,
        mockEnabled: true,
        mockValue: '123456',
        sortOrder: 20,
      }),
    }),
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'phone-code',
        name: '手机号验证码',
        description: '使用手机号验证码完成登录或注册。',
        identifierType: 'PHONE',
        credentialType: 'VERIFICATION_CODE',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: true,
        mockEnabled: true,
        mockValue: '654321',
        sortOrder: 30,
      }),
    }),
  ]);

  const admin = await prisma.user.create({
    data: withSnowflakeId({
      username: 'admin',
      email: 'admin@example.com',
      nickname: '系统管理员',
    }),
  });
  await syncUserRoles(admin.id, [adminRole.id]);

  const manager = await prisma.user.create({
    data: withSnowflakeId({
      username: 'manager',
      email: 'manager@example.com',
      nickname: '运营经理',
    }),
  });
  await syncUserRoles(manager.id, [managerRole.id]);

  const member = await prisma.user.create({
    data: withSnowflakeId({
      username: 'user',
      email: 'user@example.com',
      nickname: '普通用户',
    }),
  });
  await syncUserRoles(member.id, [userRole.id]);

  const passwordSecrets = await Promise.all([
    hashPassword('Admin123!'),
    hashPassword('Manager123!'),
    hashPassword('User123!'),
  ]);

  await prisma.userAuthentication.createMany({
    data: withSnowflakeIds([
      {
        userId: admin.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'admin',
        credentialHash: passwordSecrets[0].hash,
        salt: passwordSecrets[0].salt,
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'manager',
        credentialHash: passwordSecrets[1].hash,
        salt: passwordSecrets[1].salt,
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'user',
        credentialHash: passwordSecrets[2].hash,
        salt: passwordSecrets[2].salt,
        verifiedAt: new Date(),
      },
      {
        userId: admin.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'admin@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'manager@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'user@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: admin.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000000',
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000001',
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000002',
        verifiedAt: new Date(),
      },
    ]),
  });

  await prisma.chatMessage.createMany({
    data: withSnowflakeIds([
      { senderId: admin.id, content: '欢迎来到 RBAC 协同频道。' },
      { senderId: manager.id, content: '角色调整后，前端会实时收到权限更新提醒。' },
      { senderId: member.id, content: '移动端也可以复用共享的 API 封装。' },
    ]),
  });
}
