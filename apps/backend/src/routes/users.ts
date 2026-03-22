import { Router, type Request } from 'express';
import type { Prisma } from '../lib/prisma-generated';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import { badRequest, notFound } from '../utils/errors';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { getPermissionSource } from '../utils/rbac';
import { publishRbacMutation } from '../utils/rbac-mutation';
import { toRoleSummary, toUserRecord, userRoleSummaryInclude } from '../utils/rbac-records';
import { withSnowflakeId } from '../utils/persistence';
import { authService } from '../services/auth-service';
import { softDeleteUser, syncUserRoles } from '../services/rbac-write';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';

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

type UserListQuery = {
  q: string;
  status: '' | 'ACTIVE' | 'DISABLED';
  roleId: string;
};

const parseUserListQuery = (query: Request['query']): UserListQuery => ({
  q: String(query.q ?? '').trim(),
  status: ['ACTIVE', 'DISABLED'].includes(String(query.status ?? '').trim())
    ? (String(query.status ?? '').trim() as UserListQuery['status'])
    : '',
  roleId: String(query.roleId ?? '').trim(),
});

const buildUserWhere = ({ q, status, roleId }: UserListQuery): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { username: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { nickname: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (roleId) {
    where.roles = { some: { roleId, deleteAt: null } };
  }

  return where;
};

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
    const where = buildUserWhere(parseUserListQuery(req.query));

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
  '/export',
  requirePermission('user.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('users'),
    sheetName: 'Users',
    parseQuery: parseUserListQuery,
    queryRows: async (query) =>
      prisma.user.findMany({
        where: buildUserWhere(query),
        orderBy: { createdAt: 'desc' },
        include: userWithRolesInclude,
      }),
    columns: [
      { header: '用户名', width: 20, value: (row) => row.username },
      { header: '昵称', width: 18, value: (row) => row.nickname },
      { header: '邮箱', width: 28, value: (row) => row.email ?? '' },
      { header: '状态', width: 12, value: (row) => row.status === 'ACTIVE' ? '启用' : '禁用' },
      { header: '角色', width: 32, value: (row) => row.roles.map(({ role }) => role.name).join(' / ') },
      { header: '创建时间', width: 22, value: (row) => row.createdAt },
      { header: '更新时间', width: 22, value: (row) => row.updatedAt },
    ],
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
