import type { PermissionRecord, UserPermissionSource } from '@rbac/api-common';
import type { Prisma } from '../lib/prisma-generated';
import { prisma } from '../lib/prisma';
import { cacheDel, cacheGet, cacheSet } from '../lib/redis';
import { notFound } from './errors';
import { toPermissionRecord, toRoleSummary, toUserRecord } from './rbac-records';
import { normalizeUserPreferences } from './user-preferences';

const userInclude = {
  roles: {
    where: {
      deleteAt: null,
    },
    include: {
      role: {
        include: {
          permissions: {
            where: {
              deleteAt: null,
            },
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

const dedupePermissions = (user: UserWithRelations) => {
  const map = new Map<string, PermissionRecord>();
  user.roles.forEach(({ role }) => {
    role.permissions.forEach(({ permission }) => {
      map.set(permission.id, toPermissionRecord(permission));
    });
  });
  return [...map.values()];
};

export const mapUserRecord = toUserRecord;

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
    ...toUserRecord(user),
    permissions: await getUserPermissionCodes(userId),
    preferences: normalizeUserPreferences(user.preferences),
  };
};

export const getPermissionSource = async (userId: string): Promise<UserPermissionSource> => {
  const user = await getUserWithRelations(userId);
  return {
    user: toUserRecord(user),
    groups: user.roles.map(({ role }) => ({
      role: toRoleSummary(role),
      permissions: role.permissions.map(({ permission }) => toPermissionRecord(permission)),
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

export const findAllUserIds = async () => {
  const rows = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  return rows.map((item) => item.id);
};
