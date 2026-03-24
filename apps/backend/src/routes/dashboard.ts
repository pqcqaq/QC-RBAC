import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { ok, asyncHandler } from '../utils/http';
import { toUserRecord, userRoleSummaryInclude } from '../utils/rbac-records';

const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get(
  '/summary',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const permissionCount = await prisma.permission.count();
    const liveMessageCount = await prisma.chatMessage.count();
    const roles = await prisma.role.findMany({
      include: {
        users: {
          where: {
            deleteAt: null,
          },
          select: { id: true },
        },
      },
    });
    const permissions = await prisma.permission.findMany();
    const latestUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: userRoleSummaryInclude,
    });
    const logs = await prisma.activityLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
    });

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
        latestUsers: latestUsers.map(toUserRecord),
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
