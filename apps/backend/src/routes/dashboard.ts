import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { ok, asyncHandler } from '../utils/http.js';

const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get(
  '/summary',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const [userCount, roleCount, permissionCount, liveMessageCount, roles, permissions, latestUsers, logs] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.role.count(),
        prisma.permission.count(),
        prisma.chatMessage.count(),
        prisma.role.findMany({
          include: {
            users: {
              where: {
                deleteAt: null,
              },
              select: { id: true },
            },
          },
        }),
        prisma.permission.findMany(),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            roles: {
              where: {
                deleteAt: null,
              },
              include: { role: true },
            },
          },
        }),
        prisma.activityLog.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const moduleCoverage = Object.entries(
      permissions.reduce<Record<string, number>>((acc, permission) => {
        acc[permission.module] = (acc[permission.module] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([module, count]) => ({ module, count }));

    return ok(
      res,
      {
        metrics: [
          { label: '用户总量', value: userCount, trend: '稳定增长' },
          { label: '角色总量', value: roleCount, trend: '权限模型已固化' },
          { label: '权限节点', value: permissionCount, trend: '覆盖全链路管理' },
          { label: '实时消息', value: liveMessageCount, trend: '协同频道在线' },
        ],
        roleDistribution: roles.map((role) => ({ roleName: role.name, count: role.users.length })),
        moduleCoverage,
        latestUsers: latestUsers.map((user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          roles: user.roles.map(({ role }) => ({
            id: role.id,
            code: role.code,
            name: role.name,
            description: role.description,
          })),
        })),
        auditFeed: logs.map((item) => ({
          id: item.id,
          actor: item.actorName,
          action: item.action,
          target: item.target,
          createdAt: item.createdAt.toISOString(),
        })),
      },
      'Dashboard summary',
    );
  }),
);

export { dashboardRouter };
