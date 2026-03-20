import type { PermissionRecord, RoleRecord, UserPermissionSource, UserRecord } from '@rbac/api-common';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheDel, cacheGet, cacheSet } from '../lib/redis.js';
import { notFound } from './errors.js';

const userInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const mapPermission = (
  permission: Prisma.PermissionGetPayload<Record<string, never>>,
): PermissionRecord => ({
  id: permission.id,
  code: permission.code,
  name: permission.name,
  module: permission.module,
  action: permission.action,
  description: permission.description ?? undefined,
  createdAt: permission.createdAt.toISOString(),
  updatedAt: permission.updatedAt.toISOString(),
});

const dedupePermissions = (user: UserWithRelations) => {
  const map = new Map<string, PermissionRecord>();
  user.roles.forEach(({ role }) => {
    role.permissions.forEach(({ permission }) => {
      map.set(permission.id, mapPermission(permission));
    });
  });
  return [...map.values()];
};

export const mapUserRecord = (user: UserWithRelations): UserRecord => ({
  id: user.id,
  username: user.username,
  email: user.email,
  nickname: user.nickname,
  avatar: user.avatar,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  roles: user.roles.map(({ role }) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
  })),
});

export const mapRoleRecord = (
  role: Prisma.RoleGetPayload<{
    include: {
      permissions: { include: { permission: true } };
      _count: { select: { users: true; permissions: true } };
    };
  }>,
): RoleRecord => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  userCount: role._count.users,
  permissionCount: role._count.permissions,
  permissions: role.permissions.map(({ permission }) => mapPermission(permission)),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});

export const getUserWithRelations = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });

  if (!user) {
    throw notFound('User not found');
  }

  return user;
};

export const getUserPermissionCodes = async (userId: string) => {
  const cacheKey = `permission-codes:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return JSON.parse(cached) as string[];
  }

  const user = await getUserWithRelations(userId);
  const permissionCodes = dedupePermissions(user).map((item) => item.code);
  await cacheSet(cacheKey, JSON.stringify(permissionCodes), 300);
  return permissionCodes;
};

export const invalidatePermissionCache = async (userIds: string[]) => {
  const keys = userIds.map((userId) => `permission-codes:${userId}`);
  await cacheDel(...keys);
};

export const buildCurrentUser = async (userId: string) => {
  const user = await getUserWithRelations(userId);
  return {
    ...mapUserRecord(user),
    permissions: await getUserPermissionCodes(userId),
  };
};

export const getPermissionSource = async (userId: string): Promise<UserPermissionSource> => {
  const user = await getUserWithRelations(userId);
  return {
    user: mapUserRecord(user),
    groups: user.roles.map(({ role }) => ({
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
      },
      permissions: role.permissions.map(({ permission }) => mapPermission(permission)),
    })),
    effectivePermissions: dedupePermissions(user),
  };
};

export const findAffectedUserIdsByRoleIds = async (roleIds: string[]) => {
  if (!roleIds.length) {
    return [];
  }

  const rows = await prisma.userRole.findMany({
    where: {
      roleId: {
        in: roleIds,
      },
    },
    select: {
      userId: true,
    },
  });

  return [...new Set(rows.map((item) => item.userId))];
};
