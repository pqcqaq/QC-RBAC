import type { ClientOptions } from '../client/core.js';
import { createRequestClient } from '../client/core.js';
import type {
  AuthSession,
  CurrentUser,
  LoginPayload,
  PermissionSummary,
  RegisterPayload,
  RoleSummary,
} from '../types/auth.js';
import type {
  ActivityLogRecord,
  DashboardSummary,
  LiveMessage,
  PaginatedAuditLogs,
  PermissionFormPayload,
  PermissionRecord,
  RoleFormPayload,
  RoleRecord,
  UserFormPayload,
  UserPermissionSource,
  UserRecord,
} from '../types/rbac.js';

export const createApiFactory = (options: ClientOptions) => {
  const client = createRequestClient(options);

  return {
    auth: {
      login: (payload: LoginPayload) => client.request<AuthSession>({ url: '/auth/login', method: 'POST', data: payload }),
      register: (payload: RegisterPayload) => client.request<AuthSession>({ url: '/auth/register', method: 'POST', data: payload }),
      me: () => client.request<CurrentUser>({ url: '/auth/me' }),
      refresh: (refreshToken: string) => client.request<AuthSession>({ url: '/auth/refresh', method: 'POST', data: { refreshToken } }),
      logout: (refreshToken: string) => client.request<{ ok: true }>({ url: '/auth/logout', method: 'POST', data: { refreshToken } }),
    },
    dashboard: {
      summary: () => client.request<DashboardSummary>({ url: '/dashboard/summary' }),
    },
    audit: {
      list: (params?: Record<string, string | number | boolean | undefined>) =>
        client.request<PaginatedAuditLogs>({ url: '/audit-logs', params }),
    },
    users: {
      list: (params?: Record<string, string | number | boolean | undefined>) => client.request<{ items: UserRecord[]; meta: { page: number; pageSize: number; total: number } }>({ url: '/users', params }),
      detail: (id: string) => client.request<UserRecord>({ url: `/users/${id}` }),
      create: (payload: UserFormPayload) => client.request<UserRecord>({ url: '/users', method: 'POST', data: payload }),
      update: (id: string, payload: UserFormPayload) => client.request<UserRecord>({ url: `/users/${id}`, method: 'PUT', data: payload }),
      remove: (id: string) => client.request<{ ok: true }>({ url: `/users/${id}`, method: 'DELETE' }),
      permissionSources: (id: string) => client.request<UserPermissionSource>({ url: `/users/${id}/permission-sources` }),
      roles: () => client.request<RoleSummary[]>({ url: '/users/options/roles' }),
    },
    roles: {
      list: () => client.request<RoleRecord[]>({ url: '/roles' }),
      detail: (id: string) => client.request<RoleRecord>({ url: `/roles/${id}` }),
      create: (payload: RoleFormPayload) => client.request<RoleRecord>({ url: '/roles', method: 'POST', data: payload }),
      update: (id: string, payload: RoleFormPayload) => client.request<RoleRecord>({ url: `/roles/${id}`, method: 'PUT', data: payload }),
      remove: (id: string) => client.request<{ ok: true }>({ url: `/roles/${id}`, method: 'DELETE' }),
      permissions: () => client.request<PermissionSummary[]>({ url: '/roles/options/permissions' }),
    },
    permissions: {
      list: () => client.request<PermissionRecord[]>({ url: '/permissions' }),
      detail: (id: string) => client.request<PermissionRecord>({ url: `/permissions/${id}` }),
      create: (payload: PermissionFormPayload) => client.request<PermissionRecord>({ url: '/permissions', method: 'POST', data: payload }),
      update: (id: string, payload: PermissionFormPayload) => client.request<PermissionRecord>({ url: `/permissions/${id}`, method: 'PUT', data: payload }),
      remove: (id: string) => client.request<{ ok: true }>({ url: `/permissions/${id}`, method: 'DELETE' }),
    },
    files: {
      uploadAvatar: (payload: FormData) =>
        client.request<{ url: string }>({ url: '/files/avatar', method: 'POST', data: payload }),
    },
    live: {
      history: () => client.request<LiveMessage[]>({ url: '/realtime/messages' }),
      post: (content: string) => client.request<LiveMessage>({ url: '/realtime/messages', method: 'POST', data: { content } }),
    },
  };
};
