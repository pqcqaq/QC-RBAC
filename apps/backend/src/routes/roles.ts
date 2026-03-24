import { Router, type Request } from 'express';
import type { Prisma } from '../lib/prisma-generated';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import { badRequest, notFound } from '../utils/errors';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { findAffectedUserIdsByRoleIds } from '../utils/rbac';
import { publishRbacMutation } from '../utils/rbac-mutation';
import { roleWithPermissionSummaryInclude, toRoleRecord } from '../utils/rbac-records';
import { withSnowflakeId } from '../utils/persistence';
import {
  listPermissionSummaries,
  parseOptionResolvePayload,
  parsePermissionSummarySearchPayload,
  resolvePermissionSummariesByIds,
} from '../services/rbac-options';
import { softDeleteRole, syncRolePermissions } from '../services/rbac-write';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';

const rolePayloadSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(24),
  description: z.string().min(2).max(120),
  isSystem: z.boolean().optional(),
  permissionIds: z.array(z.string()),
});

const roleWithRelationsInclude = roleWithPermissionSummaryInclude;

const sameStringSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

const rolesRouter = Router();

type RoleListQuery = {
  q: string;
  permissionId: string;
  roleType: '' | 'system' | 'custom';
};

const parseRoleListQuery = (query: Request['query']): RoleListQuery => {
  const roleType = String(query.roleType ?? '').trim();

  return {
    q: String(query.q ?? '').trim(),
    permissionId: String(query.permissionId ?? '').trim(),
    roleType: roleType === 'system' || roleType === 'custom' ? roleType : '',
  };
};

const buildRoleWhere = ({ q, permissionId, roleType }: RoleListQuery): Prisma.RoleWhereInput => {
  const where: Prisma.RoleWhereInput = {};

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (permissionId) {
    where.permissions = { some: { permissionId, deleteAt: null } };
  }
  if (roleType === 'system') {
    where.isSystem = true;
  }
  if (roleType === 'custom') {
    where.isSystem = false;
  }

  return where;
};

rolesRouter.use(authMiddleware);

const handlePermissionOptions = asyncHandler(async (req, res) => {
  return ok(
    res,
    await listPermissionSummaries(parsePermissionSummarySearchPayload(req)),
    'Permission options',
  );
});

const handlePermissionOptionResolve = asyncHandler(async (req, res) => {
  return ok(
    res,
    await resolvePermissionSummariesByIds(parseOptionResolvePayload(req).ids),
    'Resolved permission options',
  );
});

rolesRouter.get(
  '/options/permissions',
  requireAnyPermission('role.read', 'role.create', 'role.update', 'role.assign-permission'),
  handlePermissionOptions,
);

rolesRouter.post(
  '/options/permissions',
  requireAnyPermission('role.read', 'role.create', 'role.update', 'role.assign-permission'),
  handlePermissionOptions,
);

rolesRouter.post(
  '/options/permissions/resolve',
  requireAnyPermission('role.read', 'role.create', 'role.update', 'role.assign-permission'),
  handlePermissionOptionResolve,
);

rolesRouter.get(
  '/',
  requirePermission('role.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildRoleWhere(parseRoleListQuery(req.query));

    const total = await prisma.role.count({ where });
    const roles = await prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: roleWithRelationsInclude,
    });

    return ok(
      res,
      {
        items: roles.map(toRoleRecord),
        meta: { page, pageSize, total },
      },
      'Role list',
    );
  }),
);

rolesRouter.get(
  '/export',
  requirePermission('role.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('roles'),
    sheetName: 'Roles',
    parseQuery: parseRoleListQuery,
    queryRows: async (query) =>
      prisma.role.findMany({
        where: buildRoleWhere(query),
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        include: roleWithRelationsInclude,
      }),
    columns: [
      { header: '角色编码', width: 22, value: (row) => row.code },
      { header: '角色名称', width: 20, value: (row) => row.name },
      { header: '角色描述', width: 34, value: (row) => row.description },
      { header: '角色类型', width: 12, value: (row) => (row.isSystem ? '系统角色' : '自定义角色') },
      { header: '成员数', width: 12, value: (row) => row.users.length },
      { header: '权限数', width: 12, value: (row) => row.permissions.length },
      {
        header: '权限清单',
        width: 40,
        value: (row) => row.permissions.map(({ permission }) => permission.code).join(' / '),
      },
      { header: '创建时间', width: 22, value: (row) => row.createdAt },
      { header: '更新时间', width: 22, value: (row) => row.updatedAt },
    ],
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

    const nextPermissionIds = [...new Set(payload.permissionIds)];
    const role = await prisma.role.create({
      data: withSnowflakeId({
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isSystem: payload.isSystem ?? false,
      }),
    });
    await syncRolePermissions(role.id, nextPermissionIds);
    const hydratedRole = await prisma.role.findUnique({
      where: { id: role.id },
      include: roleWithRelationsInclude,
    });
    if (!hydratedRole) {
      throw notFound('Role not found');
    }

    await publishRbacMutation({
      actor,
      action: 'role.create',
      target: role.name,
      detail: { permissionIds: nextPermissionIds },
    });

    return ok(res, toRoleRecord(hydratedRole), 'Role created');
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
    const permissionChanged = !sameStringSet(
      currentPermissionIds.map((item) => item.permissionId),
      nextPermissionIds,
    );
    if (
      permissionChanged &&
      !actor.permissions.includes('role.assign-permission')
    ) {
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
      },
    });
    await syncRolePermissions(roleId, nextPermissionIds);
    const hydratedRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: roleWithRelationsInclude,
    });
    if (!hydratedRole) {
      throw notFound('Role not found');
    }

    await publishRbacMutation({
      actor,
      action: 'role.update',
      target: role.name,
      detail: { permissionIds: nextPermissionIds },
      affectedUserIds,
      reason: `Role changed: ${role.name}`,
      syncTargets: permissionChanged ? ['user', 'menus'] : ['user'],
    });

    return ok(res, toRoleRecord(hydratedRole), 'Role updated');
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('role.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const roleId = String(req.params.id);
    const role = await prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw notFound('Role not found');
    }
    if (role.isSystem) {
      throw badRequest('System role cannot be deleted');
    }

    const affectedUserIds = await findAffectedUserIdsByRoleIds([roleId]);
    await softDeleteRole(roleId);
    await publishRbacMutation({
      actor,
      action: 'role.delete',
      target: role.name,
      affectedUserIds,
      reason: `Role removed: ${role.name}`,
      syncTargets: ['user', 'menus'],
    });

    return ok(res, { ok: true }, 'Role deleted');
  }),
);

export { rolesRouter };
