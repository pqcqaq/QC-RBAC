import { Router } from 'express';
import { permissionCatalog } from '@rbac/api-common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';
import { findAffectedUserIdsByRoleIds } from '../utils/rbac.js';
import { publishRbacMutation } from '../utils/rbac-mutation.js';
import { withSnowflakeId } from '../utils/persistence.js';
import { toPermissionRecord } from '../utils/rbac-records.js';
import { softDeletePermission } from '../services/rbac-write.js';

const permissionPayloadSchema = z.object({
  code: z.string().min(3).max(48),
  name: z.string().min(2).max(32),
  module: z.string().min(2).max(32),
  action: z.string().min(2).max(24),
  description: z.string().max(120).optional(),
});

const permissionWithRolesInclude = {
  roles: true,
} satisfies Prisma.PermissionInclude;

type PermissionWithRoles = Prisma.PermissionGetPayload<{
  include: typeof permissionWithRolesInclude;
}>;

const permissionsRouter = Router();

permissionsRouter.use(authMiddleware);

permissionsRouter.get(
  '/options/modules',
  requirePermission('permission.read'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.permission.findMany({
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });
    return ok(res, rows.map((item) => item.module), 'Permission modules');
  }),
);

permissionsRouter.get(
  '/',
  requirePermission('permission.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const q = String(req.query.q ?? '').trim();
    const module = String(req.query.module ?? '').trim();
    const sourceType = String(req.query.sourceType ?? '').trim();
    const seedCodes = permissionCatalog.map((item) => item.code);

    const where: Prisma.PermissionWhereInput = {};
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (module) {
      where.module = module;
    }
    if (sourceType === 'seed') {
      where.code = { in: seedCodes };
    }
    if (sourceType === 'custom') {
      where.code = { notIn: seedCodes };
    }

    const [total, permissions] = await prisma.$transaction([
      prisma.permission.count({ where }),
      prisma.permission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
      }),
    ]);

    return ok(
      res,
      {
        items: permissions.map(toPermissionRecord),
        meta: { page, pageSize, total },
      },
      'Permission list',
    );
  }),
);

permissionsRouter.post(
  '/',
  requirePermission('permission.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = permissionPayloadSchema.parse(req.body);
    const permission = await prisma.permission.create({ data: withSnowflakeId(payload) });

    await publishRbacMutation({
      actor,
      action: 'permission.create',
      target: permission.code,
    });

    return ok(res, toPermissionRecord(permission), 'Permission created');
  }),
);

permissionsRouter.get(
  '/:id',
  requirePermission('permission.read'),
  asyncHandler(async (req, res) => {
    const permissionId = String(req.params.id);
    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) {
      throw notFound('Permission not found');
    }

    return ok(res, toPermissionRecord(permission), 'Permission detail');
  }),
);

permissionsRouter.put(
  '/:id',
  requirePermission('permission.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = permissionPayloadSchema.parse(req.body);
    const permissionId = String(req.params.id);

    const current: PermissionWithRoles | null = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: permissionWithRolesInclude,
    });
    if (!current) {
      throw notFound('Permission not found');
    }
    const isSeedPermission = permissionCatalog.some((item) => item.code === current.code);
    if (isSeedPermission) {
      const coreChanged =
        current.code !== payload.code ||
        current.module !== payload.module ||
        current.action !== payload.action;
      if (coreChanged) {
        throw badRequest('Seed permission code/module/action cannot be changed');
      }
    }

    const affectedUserIds = await findAffectedUserIdsByRoleIds(current.roles.map((item) => item.roleId));
    const permission = await prisma.permission.update({ where: { id: permissionId }, data: payload });
    await publishRbacMutation({
      actor,
      action: 'permission.update',
      target: permission.code,
      affectedUserIds,
      reason: `Permission changed: ${permission.code}`,
    });

    return ok(res, toPermissionRecord(permission), 'Permission updated');
  }),
);

permissionsRouter.delete(
  '/:id',
  requirePermission('permission.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const permissionId = String(req.params.id);
    const permission: PermissionWithRoles | null = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: permissionWithRolesInclude,
    });
    if (!permission) {
      throw notFound('Permission not found');
    }
    if (permissionCatalog.some((item) => item.code === permission.code)) {
      throw badRequest('Seed permission cannot be deleted');
    }

    const affectedUserIds = await findAffectedUserIdsByRoleIds(permission.roles.map((item) => item.roleId));
    await softDeletePermission(permissionId);
    await publishRbacMutation({
      actor,
      action: 'permission.delete',
      target: permission.code,
      affectedUserIds,
      reason: `Permission removed: ${permission.code}`,
    });

    return ok(res, { ok: true }, 'Permission deleted');
  }),
);

export { permissionsRouter };
