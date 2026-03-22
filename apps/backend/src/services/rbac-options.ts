import type { Request } from 'express';
import type { PaginatedPermissionSummaries, PaginatedRoleSummaries } from '@rbac/api-common';
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

type OptionSearchRequest = Pick<Request, 'method' | 'body' | 'query'>;

type RoleSummarySearchPayload = ReturnType<typeof parseRoleSummarySearchPayload>;
type PermissionSummarySearchPayload = ReturnType<typeof parsePermissionSummarySearchPayload>;

const resolveOptionSearchSource = (req: OptionSearchRequest) => {
  const source = req.method === 'GET' ? req.query : req.body;
  return source && typeof source === 'object' ? source : {};
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
