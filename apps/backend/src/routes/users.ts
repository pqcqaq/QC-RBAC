import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';
import { getPermissionSource } from '../utils/rbac.js';
import { publishRbacMutation } from '../utils/rbac-mutation.js';
import { toRoleSummary, toUserRecord, userRoleSummaryInclude } from '../utils/rbac-records.js';
import { withSnowflakeId } from '../utils/persistence.js';
import { authService } from '../services/auth-service.js';
import { softDeleteUser, syncUserRoles } from '../services/rbac-write.js';

const userPayloadSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email(),
  nickname: z.string().min(2).max(24),
  password: z.string().min(8).max(32).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  roleIds: z.array(z.string()).min(1),
});

const userWithRolesInclude = userRoleSummaryInclude;

const sameStringSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every(item => rightSet.has(item));
};

const usersRouter = Router();

const resolveUserTarget = (user: { username: string; email?: string | null }) => user.email ?? user.username;

usersRouter.use(authMiddleware);

usersRouter.get(
  '/options/roles',
  requireAnyPermission('user.read', 'user.create', 'user.update', 'user.assign-role'),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, description: true },
    });
    return ok(res, roles.map(toRoleSummary), 'Role options');
  }),
);

usersRouter.get(
  '/',
  requirePermission('user.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const roleId = String(req.query.roleId ?? '').trim();

    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status === 'ACTIVE' || status === 'DISABLED') {
      where.status = status;
    }
    if (roleId) {
      where.roles = { some: { roleId, deleteAt: null } };
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: userWithRolesInclude,
      }),
    ]);

    return ok(
      res,
      {
        items: users.map(toUserRecord),
        meta: { page, pageSize, total },
      },
      'User list',
    );
  }),
);

usersRouter.get(
  '/:id',
  requirePermission('user.read'),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw notFound('User not found');
    }

    return ok(res, toUserRecord(user), 'User detail');
  }),
);

usersRouter.post(
  '/',
  requirePermission('user.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = userPayloadSchema.parse(req.body);

    if (!actor.permissions.includes('user.assign-role')) {
      throw badRequest('Missing permission: user.assign-role');
    }

    const existed = await prisma.user.findFirst({
      where: {
        OR: [{ username: payload.username }, { email: payload.email }],
      },
      select: { id: true },
    });
    if (existed) {
      throw badRequest('Username or email already exists');
    }
    if (!payload.password) {
      throw badRequest('Password is required');
    }

    const nextRoleIds = [...new Set(payload.roleIds)];
    const user = await prisma.user.create({
      data: withSnowflakeId({
        username: payload.username,
        email: payload.email,
        nickname: payload.nickname,
        status: payload.status,
      }),
    });
    await syncUserRoles(user.id, nextRoleIds);
    await authService.syncManagedUserAuthentications({
      userId: user.id,
      username: user.username,
      email: user.email,
      password: payload.password,
    });
    const hydratedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: userWithRolesInclude,
    });
    if (!hydratedUser) {
      throw notFound('User not found');
    }

    await publishRbacMutation({
      actor,
      action: 'user.create',
      target: resolveUserTarget(user),
      detail: { roleIds: nextRoleIds },
      affectedUserIds: [user.id],
      reason: 'User created',
    });

    return ok(res, toUserRecord(hydratedUser), 'User created');
  }),
);

usersRouter.put(
  '/:id',
  requirePermission('user.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = userPayloadSchema.parse(req.body);
    const userId = String(req.params.id);

    const existed = await prisma.user.findUnique({ where: { id: userId } });
    if (!existed) {
      throw notFound('User not found');
    }

    const currentRoleIds = await prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const nextRoleIds = [...new Set(payload.roleIds)];
    if (!sameStringSet(currentRoleIds.map(item => item.roleId), nextRoleIds) && !actor.permissions.includes('user.assign-role')) {
      throw badRequest('Missing permission: user.assign-role');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username: payload.username,
        email: payload.email,
        nickname: payload.nickname,
        status: payload.status,
      },
    });
    await syncUserRoles(userId, nextRoleIds);
    await authService.syncManagedUserAuthentications({
      userId: user.id,
      username: user.username,
      email: user.email,
      password: payload.password,
    });
    const hydratedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });
    if (!hydratedUser) {
      throw notFound('User not found');
    }

    await publishRbacMutation({
      actor,
      action: 'user.update',
      target: resolveUserTarget(user),
      detail: { roleIds: nextRoleIds },
      affectedUserIds: [user.id],
      reason: 'User profile updated',
    });

    return ok(res, toUserRecord(hydratedUser), 'User updated');
  }),
);

usersRouter.delete(
  '/:id',
  requirePermission('user.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const userId = String(req.params.id);
    if (actor.id === userId) {
      throw badRequest('Cannot delete current account');
    }

    const existed = await prisma.user.findUnique({ where: { id: userId } });
    if (!existed) {
      throw notFound('User not found');
    }

    await softDeleteUser(userId);
    await publishRbacMutation({
      actor,
      action: 'user.delete',
      target: resolveUserTarget(existed),
      affectedUserIds: [userId],
      reason: 'User deleted',
    });

    return ok(res, { ok: true }, 'User deleted');
  }),
);

usersRouter.get(
  '/:id/permission-sources',
  requirePermission('rbac.explorer'),
  asyncHandler(async (req, res) => {
    return ok(res, await getPermissionSource(String(req.params.id)), 'Permission source');
  }),
);

export { usersRouter };
