import type {
  AuthClientRecord,
  PermissionRecord,
  PermissionSummary,
  RoleRecord,
  RoleSummary,
  UserRecord,
} from '@rbac/api-common';
import { AuthClientType } from '@rbac/api-common';
import type { AuthClient, Permission, Prisma, Role } from '@prisma/client';
import { parseAuthClientConfig } from '../config/auth-clients';

export const userRoleSummaryInclude = {
  roles: {
    where: {
      deleteAt: null,
    },
    include: {
      role: true,
    },
  },
} satisfies Prisma.UserInclude;

export const roleWithPermissionSummaryInclude = {
  permissions: {
    where: {
      deleteAt: null,
    },
    include: { permission: true },
  },
  users: {
    where: {
      deleteAt: null,
    },
    select: {
      id: true,
    },
  },
} satisfies Prisma.RoleInclude;

type PermissionSummaryInput = Pick<
  Permission,
  'id' | 'code' | 'name' | 'module' | 'action' | 'description'
>;

type PermissionRecordInput = PermissionSummaryInput & Pick<Permission, 'createdAt' | 'updatedAt'>;
type RoleSummaryInput = Pick<Role, 'id' | 'code' | 'name' | 'description'>;
type AuthClientRecordInput = Pick<
  AuthClient,
  'id' | 'code' | 'name' | 'description' | 'type' | 'config' | 'enabled' | 'createdAt' | 'updatedAt'
>;

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

export const toAuthClientRecord = (client: AuthClientRecordInput): AuthClientRecord => {
  if (client.type === AuthClientType.WEB) {
    return {
      id: client.id,
      code: client.code,
      name: client.name,
      description: client.description ?? undefined,
      type: AuthClientType.WEB,
      enabled: client.enabled,
      config: parseAuthClientConfig(AuthClientType.WEB, client.config) as Extract<AuthClientRecord, { type: AuthClientType.WEB }>['config'],
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    };
  }

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return {
      id: client.id,
      code: client.code,
      name: client.name,
      description: client.description ?? undefined,
      type: AuthClientType.UNI_WECHAT_MINIAPP,
      enabled: client.enabled,
      config: parseAuthClientConfig(
        AuthClientType.UNI_WECHAT_MINIAPP,
        client.config,
      ) as Extract<AuthClientRecord, { type: AuthClientType.UNI_WECHAT_MINIAPP }>['config'],
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    };
  }

  return {
    id: client.id,
    code: client.code,
    name: client.name,
    description: client.description ?? undefined,
    type: AuthClientType.APP,
    enabled: client.enabled,
    config: parseAuthClientConfig(AuthClientType.APP, client.config) as Extract<AuthClientRecord, { type: AuthClientType.APP }>['config'],
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
};

export const toRoleRecord = (role: RoleWithPermissionSummaryRelations): RoleRecord => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  userCount: role.users.length,
  permissionCount: role.permissions.length,
  permissions: role.permissions.map(({ permission }) => toPermissionSummary(permission)),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});
