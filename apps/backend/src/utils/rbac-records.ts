import type {
  PermissionRecord,
  PermissionSummary,
  RoleRecord,
  RoleSummary,
  UserRecord,
} from '@rbac/api-common';
import type { Permission, Prisma, Role } from '@prisma/client';

export const userRoleSummaryInclude = {
  roles: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.UserInclude;

export const roleWithPermissionSummaryInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true, permissions: true } },
} satisfies Prisma.RoleInclude;

type PermissionSummaryInput = Pick<
  Permission,
  'id' | 'code' | 'name' | 'module' | 'action' | 'description'
>;

type PermissionRecordInput = PermissionSummaryInput & Pick<Permission, 'createdAt' | 'updatedAt'>;
type RoleSummaryInput = Pick<Role, 'id' | 'code' | 'name' | 'description'>;

type UserWithRoleSummaryRelations = Prisma.UserGetPayload<{
  include: typeof userRoleSummaryInclude;
}>;

type RoleWithPermissionSummaryRelations = Prisma.RoleGetPayload<{
  include: typeof roleWithPermissionSummaryInclude;
}>;

export const toPermissionSummary = (permission: PermissionSummaryInput): PermissionSummary => ({
  id: permission.id,
  code: permission.code,
  name: permission.name,
  module: permission.module,
  action: permission.action,
  description: permission.description ?? undefined,
});

export const toPermissionRecord = (permission: PermissionRecordInput): PermissionRecord => ({
  ...toPermissionSummary(permission),
  createdAt: permission.createdAt.toISOString(),
  updatedAt: permission.updatedAt.toISOString(),
});

export const toRoleSummary = (role: RoleSummaryInput): RoleSummary => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
});

export const toUserRecord = (user: UserWithRoleSummaryRelations): UserRecord => ({
  id: user.id,
  username: user.username,
  email: user.email,
  nickname: user.nickname,
  avatar: user.avatar,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  roles: user.roles.map(({ role }) => toRoleSummary(role)),
});

export const toRoleRecord = (role: RoleWithPermissionSummaryRelations): RoleRecord => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  userCount: role._count.users,
  permissionCount: role._count.permissions,
  permissions: role.permissions.map(({ permission }) => toPermissionSummary(permission)),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});
