import type { Request } from 'express';
import type {
  PaginatedPermissionSummaries,
  PaginatedRoleSummaries,
  PermissionSummary,
  RoleSummary,
} from '@rbac/api-common';
import { z } from 'zod';
import type { Prisma } from '../lib/prisma-generated';
import { prisma } from '../lib/prisma';
import { parsePaginationInput } from '../utils/http';
import { toPermissionSummary, toRoleSummary } from '../utils/rbac-records';

const trimText = (value: string | undefined) => value?.trim() ?? '';

const roleSummaryFilterSchema = z.object({
  q: z.string().optional().transform(trimText),
  code: z.string().optional().transform(trimText),
  name: z.string().optional().transform(trimText),
  description: z.string().optional().transform(trimText),
});

const permissionSummaryFilterSchema = z.object({
  q: z.string().optional().transform(trimText),
  code: z.string().optional().transform(trimText),
  name: z.string().optional().transform(trimText),
  module: z.string().optional().transform(trimText),
  action: z.string().optional().transform(trimText),
  description: z.string().optional().transform(trimText),
});

const optionResolvePayloadSchema = z.object({
  ids: z.union([z.array(z.string()), z.string()]).optional(),
});

type OptionSearchRequest = Pick<Request, 'method' | 'body' | 'query'>;

type RoleSummarySearchPayload = ReturnType<typeof parseRoleSummarySearchPayload>;
type PermissionSummarySearchPayload = ReturnType<typeof parsePermissionSummarySearchPayload>;

const resolveOptionSearchSource = (req: OptionSearchRequest) => {
  const source = req.method === 'GET' ? req.query : req.body;
  return source && typeof source === 'object' ? source : {};
};

const orderResolvedItems = <TItem extends { id: string }>(ids: string[], items: TItem[]) => {
  const itemMap = new Map(items.map((item) => [item.id, item] as const));
  return ids.map((id) => itemMap.get(id)).filter((item): item is TItem => Boolean(item));
};

const buildRoleSummarySearchWhere = ({
  q,
  code,
  name,
  description,
}: z.infer<typeof roleSummaryFilterSchema>): Prisma.RoleWhereInput => {
  const andFilters: Prisma.RoleWhereInput[] = [];

  if (q) {
    andFilters.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (code) {
    andFilters.push({ code: { contains: code, mode: 'insensitive' } });
  }
  if (name) {
    andFilters.push({ name: { contains: name, mode: 'insensitive' } });
  }
  if (description) {
    andFilters.push({
      description: { contains: description, mode: 'insensitive' },
    });
  }

  return andFilters.length ? { AND: andFilters } : {};
};

const buildPermissionSummarySearchWhere = ({
  q,
  code,
  name,
  module,
  action,
  description,
}: z.infer<typeof permissionSummaryFilterSchema>): Prisma.PermissionWhereInput => {
  const andFilters: Prisma.PermissionWhereInput[] = [];

  if (q) {
    andFilters.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { module: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (code) {
    andFilters.push({ code: { contains: code, mode: 'insensitive' } });
  }
  if (name) {
    andFilters.push({ name: { contains: name, mode: 'insensitive' } });
  }
  if (module) {
    andFilters.push({ module: { contains: module, mode: 'insensitive' } });
  }
  if (action) {
    andFilters.push({ action: { contains: action, mode: 'insensitive' } });
  }
  if (description) {
    andFilters.push({
      description: { contains: description, mode: 'insensitive' },
    });
  }

  return andFilters.length ? { AND: andFilters } : {};
};

export const parseRoleSummarySearchPayload = (req: OptionSearchRequest) => {
  const input = resolveOptionSearchSource(req);

  return {
    ...parsePaginationInput(input),
    ...roleSummaryFilterSchema.parse(input),
  };
};

export const parsePermissionSummarySearchPayload = (req: OptionSearchRequest) => {
  const input = resolveOptionSearchSource(req);

  return {
    ...parsePaginationInput(input),
    ...permissionSummaryFilterSchema.parse(input),
  };
};

export const parseOptionResolvePayload = (req: OptionSearchRequest) => {
  const input = optionResolvePayloadSchema.parse(resolveOptionSearchSource(req));
  const rawIds = Array.isArray(input.ids)
    ? input.ids
    : typeof input.ids === 'string'
      ? input.ids.split(',')
      : [];

  return {
    ids: [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))],
  };
};

export const listRoleSummaries = async ({
  page,
  pageSize,
  skip,
  ...filters
}: RoleSummarySearchPayload): Promise<PaginatedRoleSummaries> => {
  const where = buildRoleSummarySearchWhere(filters);
  const [total, roles] = await prisma.$transaction([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, description: true },
    }),
  ]);

  return {
    items: roles.map(toRoleSummary),
    meta: { page, pageSize, total },
  };
};

export const listPermissionSummaries = async ({
  page,
  pageSize,
  skip,
  ...filters
}: PermissionSummarySearchPayload): Promise<PaginatedPermissionSummaries> => {
  const where = buildPermissionSummarySearchWhere(filters);
  const [total, permissions] = await prisma.$transaction([
    prisma.permission.count({ where }),
    prisma.permission.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
    }),
  ]);

  return {
    items: permissions.map(toPermissionSummary),
    meta: { page, pageSize, total },
  };
};

export const resolveRoleSummariesByIds = async (ids: string[]): Promise<RoleSummary[]> => {
  if (!ids.length) {
    return [];
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true, description: true },
  });

  return orderResolvedItems(ids, roles).map(toRoleSummary);
};

export const resolvePermissionSummariesByIds = async (
  ids: string[],
): Promise<PermissionSummary[]> => {
  if (!ids.length) {
    return [];
  }

  const permissions = await prisma.permission.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      name: true,
      module: true,
      action: true,
      description: true,
      isSystem: true,
    },
  });

  return orderResolvedItems(ids, permissions).map(toPermissionSummary);
};
