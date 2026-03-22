import type { ClientOptions, DownloadRequestConfig } from '../client/core.js';
import { createRequestClient } from '../client/core.js';
import type {
  AuthStrategyCollection,
  AuthSession,
  CurrentUser,
  LoginPayload,
  PermissionSummary,
  RegisterPayload,
  RoleSummary,
  SendVerificationCodePayload,
  UserPreferences,
  VerificationCodeSendResult,
  VerificationCodeVerifyResult,
  VerifyVerificationCodePayload,
} from '../types/auth.js';
import type {
  UploadCallbackPayload,
  UploadCallbackResult,
  UploadPreparePayload,
  UploadPrepareResult,
} from '../types/files.js';
import type {
  ActivityLogRecord,
  AuthClientFormPayload,
  AuthClientRecord,
  DashboardSummary,
  LiveMessage,
  MenuNodeFormPayload,
  MenuNodeRecord,
  PaginatedAuditLogs,
  PaginatedAuthClients,
  PaginatedLiveMessages,
  PaginatedPermissions,
  PaginatedRoles,
  PermissionFormPayload,
  PermissionRecord,
  RoleFormPayload,
  RoleRecord,
  UserFormPayload,
  UserPermissionSource,
  UserRecord,
} from '../types/rbac.js';
import type { PaginatedResult, QueryParams } from '../types/common.js';

type CrudResourceOptions = {
  resource: string;
  exportResource?: string;
  exportFileName?: string;
};

const createDownloadEndpoint = <TParams extends QueryParams | undefined = QueryParams | undefined>(
  resource: string,
  fileName?: string,
) =>
  (params?: TParams): DownloadRequestConfig => ({
    url: resource,
    method: 'GET',
    params,
    ...(fileName ? { fileName } : {}),
  });

const createCrudEndpoints = <
  TRecord,
  TForm,
  TListResult = TRecord[],
  TListParams extends QueryParams | undefined = QueryParams | undefined,
>(
  client: ReturnType<typeof createRequestClient>,
  { resource, exportResource, exportFileName }: CrudResourceOptions,
) => ({
  list: (params?: TListParams) => client.request<TListResult>({ url: resource, params }),
  detail: (id: string) => client.request<TRecord>({ url: `${resource}/${id}` }),
  create: (payload: TForm) => client.request<TRecord>({ url: resource, method: 'POST', data: payload }),
  update: (id: string, payload: TForm) => client.request<TRecord>({ url: `${resource}/${id}`, method: 'PUT', data: payload }),
  remove: (id: string) => client.request<{ ok: true }>({ url: `${resource}/${id}`, method: 'DELETE' }),
  export: createDownloadEndpoint<TListParams>(exportResource ?? `${resource}/export`, exportFileName),
});

export const createApiFactory = (options: ClientOptions) => {
  const client = createRequestClient(options);
  const userCrud = createCrudEndpoints<
    UserRecord,
    UserFormPayload,
    PaginatedResult<UserRecord>
  >(client, { resource: '/users', exportFileName: 'users.xlsx' });
  const roleCrud = createCrudEndpoints<RoleRecord, RoleFormPayload, PaginatedRoles>(client, {
    resource: '/roles',
    exportFileName: 'roles.xlsx',
  });
  const permissionCrud = createCrudEndpoints<PermissionRecord, PermissionFormPayload, PaginatedPermissions>(client, {
    resource: '/permissions',
    exportFileName: 'permissions.xlsx',
  });
  const clientCrud = createCrudEndpoints<AuthClientRecord, AuthClientFormPayload, PaginatedAuthClients>(client, {
    resource: '/clients',
    exportFileName: 'clients.xlsx',
  });
  const menuCrud = createCrudEndpoints<MenuNodeRecord, MenuNodeFormPayload>(client, { resource: '/menus' });

  return {
    auth: {
      strategies: () => client.request<AuthStrategyCollection>({ url: '/auth/strategies' }),
      sendVerificationCode: (payload: SendVerificationCodePayload) =>
        client.request<VerificationCodeSendResult>({ url: '/auth/verification-codes/send', method: 'POST', data: payload }),
      verifyVerificationCode: (payload: VerifyVerificationCodePayload) =>
        client.request<VerificationCodeVerifyResult>({ url: '/auth/verification-codes/verify', method: 'POST', data: payload }),
      login: (payload: LoginPayload) => client.request<AuthSession>({ url: '/auth/login', method: 'POST', data: payload }),
      register: (payload: RegisterPayload) => client.request<AuthSession>({ url: '/auth/register', method: 'POST', data: payload }),
      me: () => client.request<CurrentUser>({ url: '/auth/me' }),
      updatePreferences: (payload: UserPreferences) =>
        client.request<UserPreferences>({ url: '/auth/preferences', method: 'PUT', data: payload }),
      refresh: (refreshToken: string) => client.request<AuthSession>({ url: '/auth/refresh', method: 'POST', data: { refreshToken } }),
      logout: (refreshToken: string) => client.request<{ ok: true }>({ url: '/auth/logout', method: 'POST', data: { refreshToken } }),
    },
    dashboard: {
      summary: () => client.request<DashboardSummary>({ url: '/dashboard/summary' }),
    },
    audit: {
      list: (params?: Record<string, string | number | boolean | undefined>) =>
        client.request<PaginatedAuditLogs>({ url: '/audit-logs', params }),
      export: createDownloadEndpoint('/audit-logs/export', 'audit-logs.xlsx'),
    },
    users: {
      ...userCrud,
      permissionSources: (id: string) => client.request<UserPermissionSource>({ url: `/users/${id}/permission-sources` }),
      roles: () => client.request<RoleSummary[]>({ url: '/users/options/roles' }),
    },
    roles: {
      ...roleCrud,
      permissions: () => client.request<PermissionSummary[]>({ url: '/roles/options/permissions' }),
    },
    permissions: {
      ...permissionCrud,
      modules: () => client.request<string[]>({ url: '/permissions/options/modules' }),
    },
    clients: {
      ...clientCrud,
    },
    menus: {
      ...menuCrud,
      current: () => client.request<MenuNodeRecord[]>({ url: '/menus/current' }),
      tree: menuCrud.list,
      permissions: () => client.request<PermissionSummary[]>({ url: '/menus/options/permissions' }),
    },
    files: {
      prepareUpload: (payload: UploadPreparePayload) =>
        client.request<UploadPrepareResult>({ url: '/files/presign', method: 'POST', data: payload }),
      completeUpload: (payload: UploadCallbackPayload) =>
        client.request<UploadCallbackResult>({ url: '/files/callback', method: 'POST', data: payload }),
    },
    live: {
      history: (params?: Record<string, string | number | boolean | undefined>) =>
        client.request<PaginatedLiveMessages>({ url: '/realtime/messages', params }),
      exportHistory: createDownloadEndpoint('/realtime/messages/export', 'live-messages.xlsx'),
      post: (content: string) => client.request<LiveMessage>({ url: '/realtime/messages', method: 'POST', data: { content } }),
    },
  };
};
