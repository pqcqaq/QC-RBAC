import { Router } from 'express';
import { permissionCatalog } from '@rbac/api-common';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitAuditEvent, emitRbacUpdated } from '../lib/socket.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';
import { findAffectedUserIdsByRoleIds, invalidatePermissionCache } from '../utils/rbac.js';

const permissionPayloadSchema = z.object({
  code: z.string().min(3).max(48),
  name: z.string().min(2).max(32),
  module: z.string().min(2).max(32),
  action: z.string().min(2).max(24),
  description: z.string().max(120).optional(),
});

const toPermissionRecord = (permission: any) => ({
  id: permission.id,
  code: permission.code,
  name: permission.name,
  module: permission.module,
  action: permission.action,
  description: permission.description ?? undefined,
  createdAt: permission.createdAt.toISOString(),
  updatedAt: permission.updatedAt.toISOString(),
});

const permissionsRouter = Router();

permissionsRouter.use(authMiddleware);

permissionsRouter.get(
  '/',
  requirePermission('permission.read'),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
    });
    return ok(res, permissions.map(toPermissionRecord), 'Permission list');
  }),
);

permissionsRouter.post(
  '/',
  requirePermission('permission.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = permissionPayloadSchema.parse(req.body);
    const permission = await prisma.permission.create({ data: payload });

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'permission.create',
      target: permission.code,
    });
    emitAuditEvent({ action: 'permission.create', actor: actor.nickname, target: permission.code });

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

    const current: any = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: { roles: true },
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

    const affectedUserIds = await findAffectedUserIdsByRoleIds((current.roles ?? []).map((item: any) => item.roleId));
    const permission = await prisma.permission.update({ where: { id: permissionId }, data: payload });
    await invalidatePermissionCache(affectedUserIds);

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'permission.update',
      target: permission.code,
    });
    emitAuditEvent({ action: 'permission.update', actor: actor.nickname, target: permission.code });
    emitRbacUpdated(affectedUserIds, `Permission changed: ${permission.code}`);

    return ok(res, toPermissionRecord(permission), 'Permission updated');
  }),
);

permissionsRouter.delete(
  '/:id',
  requirePermission('permission.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const permissionId = String(req.params.id);
    const permission: any = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: { roles: true },
    });
    if (!permission) {
      throw notFound('Permission not found');
    }
    if (permissionCatalog.some((item) => item.code === permission.code)) {
      throw badRequest('Seed permission cannot be deleted');
    }

    const affectedUserIds = await findAffectedUserIdsByRoleIds((permission.roles ?? []).map((item: any) => item.roleId));
    await prisma.permission.delete({ where: { id: permissionId } });
    await invalidatePermissionCache(affectedUserIds);

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'permission.delete',
      target: permission.code,
    });
    emitAuditEvent({ action: 'permission.delete', actor: actor.nickname, target: permission.code });
    emitRbacUpdated(affectedUserIds, `Permission removed: ${permission.code}`);

    return ok(res, { ok: true }, 'Permission deleted');
  }),
);

export { permissionsRouter };
