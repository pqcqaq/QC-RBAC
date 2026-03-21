import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { findAffectedUserIdsByRoleIds, invalidatePermissionCache } from '../utils/rbac.js';
import { publishRbacMutation } from '../utils/rbac-mutation.js';
import { roleWithPermissionSummaryInclude, toPermissionSummary, toRoleRecord } from '../utils/rbac-records.js';

const rolePayloadSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(24),
  description: z.string().min(2).max(120),
  isSystem: z.boolean().optional(),
  permissionIds: z.array(z.string()),
});

const roleWithRelationsInclude = roleWithPermissionSummaryInclude;

const roleWithUserCountInclude = {
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleWithUserCount = Prisma.RoleGetPayload<{
  include: typeof roleWithUserCountInclude;
}>;

const sameStringSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every(item => rightSet.has(item));
};

const rolesRouter = Router();

rolesRouter.use(authMiddleware);

rolesRouter.get(
  '/options/permissions',
  requireAnyPermission('role.read', 'role.create', 'role.update', 'role.assign-permission'),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    return ok(res, permissions.map(toPermissionSummary), 'Permission options');
  }),
);

rolesRouter.get(
  '/',
  requirePermission('role.read'),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: roleWithRelationsInclude,
    });
    return ok(res, roles.map(toRoleRecord), 'Role list');
  }),
);

rolesRouter.get(
  '/:id',
  requirePermission('role.read'),
  asyncHandler(async (req, res) => {
    const roleId = String(req.params.id);
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: roleWithRelationsInclude,
    });
    if (!role) {
      throw notFound('Role not found');
    }
    return ok(res, toRoleRecord(role), 'Role detail');
  }),
);

rolesRouter.post(
  '/',
  requirePermission('role.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = rolePayloadSchema.parse(req.body);

    if (payload.permissionIds.length && !actor.permissions.includes('role.assign-permission')) {
      throw badRequest('Missing permission: role.assign-permission');
    }

    const role = await prisma.role.create({
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isSystem: payload.isSystem ?? false,
        permissions: {
          create: payload.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleWithRelationsInclude,
    });

    await publishRbacMutation({
      actor,
      action: 'role.create',
      target: role.name,
      detail: { permissionIds: payload.permissionIds },
    });

    return ok(res, toRoleRecord(role), 'Role created');
  }),
);

rolesRouter.put(
  '/:id',
  requirePermission('role.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = rolePayloadSchema.parse(req.body);
    const roleId = String(req.params.id);

    const current = await prisma.role.findUnique({ where: { id: roleId } });
    if (!current) {
      throw notFound('Role not found');
    }
    if (current.isSystem && current.code !== payload.code) {
      throw badRequest('System role code cannot be changed');
    }
    const currentPermissionIds = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    const nextPermissionIds = [...new Set(payload.permissionIds)];
    if (!sameStringSet(currentPermissionIds.map(item => item.permissionId), nextPermissionIds) && !actor.permissions.includes('role.assign-permission')) {
      throw badRequest('Missing permission: role.assign-permission');
    }

    const affectedUserIds = await findAffectedUserIdsByRoleIds([roleId]);
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isSystem: current.isSystem,
        permissions: {
          deleteMany: {},
          create: payload.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleWithRelationsInclude,
    });

    await publishRbacMutation({
      actor,
      action: 'role.update',
      target: role.name,
      detail: { permissionIds: payload.permissionIds },
      affectedUserIds,
      reason: `Role changed: ${role.name}`,
    });

    return ok(res, toRoleRecord(role), 'Role updated');
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('role.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const roleId = String(req.params.id);
    const role: RoleWithUserCount | null = await prisma.role.findUnique({
      where: { id: roleId },
      include: roleWithUserCountInclude,
    });

    if (!role) {
      throw notFound('Role not found');
    }
    if (role.isSystem) {
      throw badRequest('System role cannot be deleted');
    }
    if (role._count.users > 0) {
      throw badRequest('Role is assigned to users and cannot be deleted');
    }

    await prisma.role.delete({ where: { id: roleId } });
    await publishRbacMutation({
      actor,
      action: 'role.delete',
      target: role.name,
    });

    return ok(res, { ok: true }, 'Role deleted');
  }),
);

export { rolesRouter };
