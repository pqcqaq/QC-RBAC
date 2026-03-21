import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitAuditEvent, emitRbacUpdated } from '../lib/socket.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';
import { hashPassword } from '../utils/password.js';
import { getPermissionSource, invalidatePermissionCache } from '../utils/rbac.js';

const userPayloadSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email(),
  nickname: z.string().min(2).max(24),
  password: z.string().min(8).max(32).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  roleIds: z.array(z.string()).min(1),
});

const userWithRolesInclude = {
  roles: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userWithRolesInclude;
}>;

const toUserRecord = (user: UserWithRoles) => ({
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
});

const sameStringSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every(item => rightSet.has(item));
};

const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get(
  '/options/roles',
  requireAnyPermission('user.read', 'user.create', 'user.update', 'user.assign-role'),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, description: true },
    });
    return ok(res, roles, 'Role options');
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
      where.roles = { some: { roleId } };
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

    const user = await prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        nickname: payload.nickname,
        status: payload.status,
        passwordHash: await hashPassword(payload.password),
        roles: {
          create: payload.roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: userWithRolesInclude,
    });

    await invalidatePermissionCache([user.id]);
    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'user.create',
      target: user.email,
      detail: { roleIds: payload.roleIds },
    });
    emitAuditEvent({ action: 'user.create', actor: actor.nickname, target: user.email });
    emitRbacUpdated([user.id], 'User created');

    return ok(res, toUserRecord(user), 'User created');
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
        ...(payload.password ? { passwordHash: await hashPassword(payload.password) } : {}),
        roles: {
          deleteMany: {},
          create: payload.roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: userWithRolesInclude,
    });

    await invalidatePermissionCache([user.id]);
    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'user.update',
      target: user.email,
      detail: { roleIds: payload.roleIds },
    });
    emitAuditEvent({ action: 'user.update', actor: actor.nickname, target: user.email });
    emitRbacUpdated([user.id], 'User profile updated');

    return ok(res, toUserRecord(user), 'User updated');
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

    await prisma.user.delete({ where: { id: userId } });
    await invalidatePermissionCache([userId]);
    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'user.delete',
      target: existed.email,
    });
    emitAuditEvent({ action: 'user.delete', actor: actor.nickname, target: existed.email });
    emitRbacUpdated([userId], 'User deleted');

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
