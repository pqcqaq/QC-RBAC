import type { PermissionSummary, RoleSummary, UserStatus } from './auth';
import type { AuthClientConfigByType, AuthClientIdentity, AuthClientType } from './auth-client';
import type { PaginatedResult } from './common';
import type { MediaAssetRecord } from './files';

export interface UserRecord {
  id: string;
  username: string;
  email: string | null;
  nickname: string;
  avatarFileId: string | null;
  avatarUrl: string | null;
  avatarFile: MediaAssetRecord | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  roles: RoleSummary[];
}

export interface UserFormPayload {
  username: string;
  email: string;
  nickname: string;
  avatarFileId?: string | null;
  password?: string;
  status: UserStatus;
  roleIds: string[];
}

export interface RoleRecord extends RoleSummary {
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions: PermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleFormPayload {
  code: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissionIds: string[];
}

export interface PermissionRecord extends PermissionSummary {
  createdAt: string;
  updatedAt: string;
}

export interface PermissionFormPayload {
  code: string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

export interface PermissionSourceGroup {
  role: RoleSummary;
  permissions: PermissionSummary[];
}

export type MenuNodeType = 'DIRECTORY' | 'PAGE' | 'ACTION';

export interface MenuNodeRecord {
  id: string;
  code: string;
  type: MenuNodeType;
  title: string;
  caption?: string;
  description?: string;
  icon?: string;
  path?: string;
  viewKey?: string;
  sortOrder: number;
  parentId?: string | null;
  permissionId?: string | null;
  permission?: PermissionSummary;
  children: MenuNodeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuNodeFormPayload {
  code: string;
  type: MenuNodeType;
  title: string;
  caption?: string | null;
  description?: string | null;
  icon?: string | null;
  path?: string | null;
  viewKey?: string | null;
  sortOrder: number;
  parentId?: string | null;
  permissionId?: string | null;
}

type AuthClientRecordBase = AuthClientIdentity & {
  name: string;
  description?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthClientFormPayloadBase = {
  code: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  clientSecret?: string;
};

export type AuthClientRecord =
  | (AuthClientRecordBase & {
      type: AuthClientType.WEB;
      config: AuthClientConfigByType[AuthClientType.WEB];
    })
  | (AuthClientRecordBase & {
      type: AuthClientType.UNI_WECHAT_MINIAPP;
      config: AuthClientConfigByType[AuthClientType.UNI_WECHAT_MINIAPP];
    })
  | (AuthClientRecordBase & {
      type: AuthClientType.APP;
      config: AuthClientConfigByType[AuthClientType.APP];
    });

export type AuthClientFormPayload =
  | (AuthClientFormPayloadBase & {
      type: AuthClientType.WEB;
      config: AuthClientConfigByType[AuthClientType.WEB];
    })
  | (AuthClientFormPayloadBase & {
      type: AuthClientType.UNI_WECHAT_MINIAPP;
      config: AuthClientConfigByType[AuthClientType.UNI_WECHAT_MINIAPP];
    })
  | (AuthClientFormPayloadBase & {
      type: AuthClientType.APP;
      config: AuthClientConfigByType[AuthClientType.APP];
    });

export interface UserPermissionSource {
  user: UserRecord;
  groups: PermissionSourceGroup[];
  effectivePermissions: PermissionSummary[];
}

export interface DashboardSummary {
  metrics: Array<{ label: string; value: number; trend: string }>;
  roleDistribution: Array<{ roleName: string; count: number }>;
  moduleCoverage: Array<{ module: string; count: number }>;
  latestUsers: UserRecord[];
  auditFeed: Array<{ id: string; actor: string; action: string; target: string; createdAt: string }>;
}

export interface ActivityLogRecord {
  id: string;
  actorId?: string | null;
  actorName: string;
  action: string;
  target: string;
  detail?: unknown;
  createdAt: string;
}

export interface LiveMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRoles: string[];
  content: string;
  createdAt: string;
}

export type PaginatedUsers = PaginatedResult<UserRecord>;
export type PaginatedRoles = PaginatedResult<RoleRecord>;
export type PaginatedPermissions = PaginatedResult<PermissionRecord>;
export type PaginatedAuthClients = PaginatedResult<AuthClientRecord>;
export type PaginatedAuditLogs = PaginatedResult<ActivityLogRecord>;
export type PaginatedLiveMessages = PaginatedResult<LiveMessage>;
