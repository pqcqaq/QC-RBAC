import { Router } from 'express';
import type { MenuNodeFormPayload } from '@rbac/api-common';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import {
  createMenuNode,
  deleteMenuNode,
  getCurrentUserMenuTree,
  getMenuNodeOrThrow,
  getMenuTree,
  updateMenuNode,
} from '../services/menu-tree';
import { ok, asyncHandler } from '../utils/http';
import { badRequest } from '../utils/errors';
import { findAllUserIds } from '../utils/rbac';
import { publishRbacMutation } from '../utils/rbac-mutation';
import { toPermissionSummary } from '../utils/rbac-records';

const menuPayloadSchema = z.object({
  code: z.string().min(2).max(48),
  type: z.enum(['DIRECTORY', 'PAGE', 'ACTION']),
  title: z.string().min(1).max(48),
  caption: z.string().max(120).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  icon: z.string().max(96).optional().nullable(),
  path: z.string().max(120).optional().nullable(),
  viewKey: z.string().max(64).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999),
  parentId: z.string().optional().nullable(),
  permissionId: z.string().optional().nullable(),
});

const samePermissionAssignment = (left?: string | null, right?: string | null) => (left ?? null) === (right ?? null);

const menusRouter = Router();

menusRouter.use(authMiddleware);

menusRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    return ok(res, await getCurrentUserMenuTree(req.auth?.permissions ?? []), 'Current menu tree');
  }),
);

menusRouter.get(
  '/options/permissions',
  requireAnyPermission('menu.read', 'menu.create', 'menu.update', 'menu.assign-permission'),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
    });

    return ok(res, permissions.map(toPermissionSummary), 'Menu permission options');
  }),
);

menusRouter.get(
  '/',
  requirePermission('menu.read'),
  asyncHandler(async (_req, res) => {
    return ok(res, await getMenuTree(), 'Menu tree');
  }),
);

menusRouter.post(
  '/',
  requirePermission('menu.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = menuPayloadSchema.parse(req.body) satisfies MenuNodeFormPayload;

    if (payload.permissionId && !actor.permissions.includes('menu.assign-permission')) {
      throw badRequest('Missing permission: menu.assign-permission');
    }

    const created = await createMenuNode(payload);
    const affectedUserIds = await findAllUserIds();

    await publishRbacMutation({
      actor,
      action: 'menu.create',
      target: created.title,
      detail: {
        code: created.code,
        type: created.type,
        path: created.path,
        permissionCode: created.permission?.code,
      },
      affectedUserIds,
      reason: `Menu created: ${created.title}`,
    });

    return ok(res, created, 'Menu node created');
  }),
);

menusRouter.put(
  '/:id',
  requirePermission('menu.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const menuId = String(req.params.id);
    const payload = menuPayloadSchema.parse(req.body) satisfies MenuNodeFormPayload;
    const current = await getMenuNodeOrThrow(menuId);

    if (!samePermissionAssignment(current.permissionId, payload.permissionId) && !actor.permissions.includes('menu.assign-permission')) {
      throw badRequest('Missing permission: menu.assign-permission');
    }

    const updated = await updateMenuNode(menuId, payload);
    const affectedUserIds = await findAllUserIds();

    await publishRbacMutation({
      actor,
      action: 'menu.update',
      target: updated.title,
      detail: {
        code: updated.code,
        type: updated.type,
        path: updated.path,
        permissionCode: updated.permission?.code,
      },
      affectedUserIds,
      reason: `Menu updated: ${updated.title}`,
    });

    return ok(res, updated, 'Menu node updated');
  }),
);

menusRouter.delete(
  '/:id',
  requirePermission('menu.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const menuId = String(req.params.id);
    const current = await getMenuNodeOrThrow(menuId);
    const removedIds = await deleteMenuNode(menuId);
    const affectedUserIds = await findAllUserIds();

    await publishRbacMutation({
      actor,
      action: 'menu.delete',
      target: current.title,
      detail: {
        removedNodeIds: removedIds,
      },
      affectedUserIds,
      reason: `Menu removed: ${current.title}`,
    });

    return ok(res, { ok: true }, 'Menu node deleted');
  }),
);

export { menusRouter };
