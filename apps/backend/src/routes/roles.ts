import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitAuditEvent, emitRbacUpdated } from '../lib/socket.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';
import { findAffectedUserIdsByRoleIds, invalidatePermissionCache } from '../utils/rbac.js';

const rolePayloadSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(24),
  description: z.string().min(2).max(120),
  isSystem: z.boolean().optional(),
  permissionIds: z.array(z.string()),
});

const toRoleRecord = (role: any) => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  userCount: role._count?.users ?? 0,
  permissionCount: role._count?.permissions ?? role.permissions?.length ?? 0,
  permissions: (role.permissions ?? []).map(({ permission }: any) => ({
    id: permission.id,
    code: permission.code,
    name: permission.name,
    module: permission.module,
    action: permission.action,
    description: permission.description ?? undefined,
  })),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});

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
    return ok(
      res,
      permissions.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        module: item.module,
        action: item.action,
        description: item.description ?? undefined,
      })),
      'Permission options',
    );
  }),
);

rolesRouter.get(
  '/',
  requirePermission('role.read'),
  asyncHandler(async (_req, res) => {
    const roles: any[] = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });
    return ok(res, roles.map(toRoleRecord), 'Role list');
  }),
);

rolesRouter.get(
  '/:id',
  requirePermission('role.read'),
  asyncHandler(async (req, res) => {
    const roleId = String(req.params.id);
    const role: any = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
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

    const role: any = await prisma.role.create({
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isSystem: payload.isSystem ?? false,
        permissions: {
          create: payload.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'role.create',
      target: role.name,
      detail: { permissionIds: payload.permissionIds },
    });
    emitAuditEvent({ action: 'role.create', actor: actor.nickname, target: role.name });

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
    const role: any = await prisma.role.update({
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
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });

    await invalidatePermissionCache(affectedUserIds);
    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'role.update',
      target: role.name,
      detail: { permissionIds: payload.permissionIds },
    });
    emitAuditEvent({ action: 'role.update', actor: actor.nickname, target: role.name });
    emitRbacUpdated(affectedUserIds, `Role changed: ${role.name}`);

    return ok(res, toRoleRecord(role), 'Role updated');
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('role.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const roleId = String(req.params.id);
    const role: any = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: { select: { users: true } },
      },
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
    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'role.delete',
      target: role.name,
    });
    emitAuditEvent({ action: 'role.delete', actor: actor.nickname, target: role.name });

    return ok(res, { ok: true }, 'Role deleted');
  }),
);

export { rolesRouter };
