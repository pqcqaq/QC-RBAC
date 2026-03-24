import { Router, type Request } from 'express';
import type { Prisma } from '../lib/prisma-generated';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { badRequest, notFound } from '../utils/errors';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { findAffectedUserIdsByRoleIds } from '../utils/rbac';
import { publishRbacMutation } from '../utils/rbac-mutation';
import { withSnowflakeId } from '../utils/persistence';
import { toPermissionRecord } from '../utils/rbac-records';
import { softDeletePermission } from '../services/rbac-write';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';

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

type PermissionListQuery = {
  q: string;
  module: string;
  sourceType: '' | 'seed' | 'custom';
};

const parsePermissionListQuery = (query: Request['query']): PermissionListQuery => {
  const sourceType = String(query.sourceType ?? '').trim();

  return {
    q: String(query.q ?? '').trim(),
    module: String(query.module ?? '').trim(),
    sourceType: sourceType === 'seed' || sourceType === 'custom' ? sourceType : '',
  };
};

const buildPermissionWhere = (
  { q, module, sourceType }: PermissionListQuery,
): Prisma.PermissionWhereInput => {
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
    where.isSystem = true;
  }
  if (sourceType === 'custom') {
    where.isSystem = false;
  }

  return where;
};

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
    const query = parsePermissionListQuery(req.query);
    const where = buildPermissionWhere(query);

    const total = await prisma.permission.count({ where });
    const permissions = await prisma.permission.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
    });

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

permissionsRouter.get(
  '/export',
  requirePermission('permission.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('permissions'),
    sheetName: 'Permissions',
    parseQuery: parsePermissionListQuery,
    queryRows: async (query) => {
      return prisma.permission.findMany({
        where: buildPermissionWhere(query),
        orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
      });
    },
    columns: [
      { header: '权限码', width: 28, value: (row) => row.code },
      { header: '名称', width: 18, value: (row) => row.name },
      { header: '模块', width: 16, value: (row) => row.module },
      { header: '动作', width: 16, value: (row) => row.action },
      { header: '来源', width: 12, value: (row) => row.isSystem ? '系统种子' : '自定义' },
      { header: '描述', width: 36, value: (row) => row.description ?? '' },
      { header: '创建时间', width: 22, value: (row) => row.createdAt },
      { header: '更新时间', width: 22, value: (row) => row.updatedAt },
    ],
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
    if (current.isSystem) {
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
      syncTargets: ['user', 'menus'],
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
    if (permission.isSystem) {
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
      syncTargets: ['user', 'menus'],
    });

    return ok(res, { ok: true }, 'Permission deleted');
  }),
);

export { permissionsRouter };
