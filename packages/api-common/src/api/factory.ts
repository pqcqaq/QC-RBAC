import type { ClientOptions, DownloadRequestConfig } from '../client/core';
import { createRequestClient } from '../client/core';
import type {
  AuthStrategyCollection,
  AuthSession,
  CurrentUserProfilePayload,
  CurrentUser,
  LoginPayload,
  PaginatedPermissionSummaries,
  PaginatedRoleSummaries,
  RegisterPayload,
  SendVerificationCodePayload,
  UserPreferences,
  VerificationCodeSendResult,
  VerificationCodeVerifyResult,
  VerifyVerificationCodePayload,
} from '../types/auth';
import type {
  OAuthApplicationFormPayload,
  OAuthApplicationRecord,
  OAuthAuthorizeUrlResult,
  OAuthProviderFormPayload,
  OAuthProviderRecord,
} from '../types/oauth';
import type {
  MediaAssetListQuery,
  MediaAssetRecord,
  MediaAssetUpdatePayload,
  PaginatedMediaAssets,
  UploadCallbackPayload,
  UploadCallbackResult,
  UploadPreparePayload,
  UploadPrepareResult,
} from '../types/files';
import type {
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
  PaginatedRealtimeTopics,
  PaginatedRoles,
  PermissionFormPayload,
  PermissionRecord,
  RealtimeTopicFormPayload,
  RealtimeTopicRecord,
  RoleFormPayload,
  RoleRecord,
  UserFormPayload,
  UserPermissionSource,
  UserRecord,
} from '../types/rbac';
import type {
  OptionEndpoint,
  OptionResolvePayload,
  OptionSearchPayload,
  PaginatedResult,
  QueryParams,
} from '../types/common';

type CrudResourceOptions = {
  resource: string;
  exportResource?: string;
  exportFileName?: string;
};

const createDownloadEndpoint =
  <TParams extends QueryParams | undefined = QueryParams | undefined>(
    resource: string,
    fileName?: string,
  ) =>
  (params?: TParams): DownloadRequestConfig => ({
    url: resource,
    method: 'GET',
    params,
    ...(fileName ? { fileName } : {}),
  });

const createOptionEndpoint =
  (client: ReturnType<typeof createRequestClient>) =>
  <
    TItem,
    TResult extends PaginatedResult<TItem>,
    TPayload extends OptionSearchPayload = OptionSearchPayload,
  >(
    resource: string,
  ): OptionEndpoint<TItem, TResult, TPayload> => {
    const endpoint = ((payload?: TPayload) =>
      client.request<TResult>({
        url: resource,
        method: 'POST',
        data: payload ?? {},
      })) as OptionEndpoint<TItem, TResult, TPayload>;

    endpoint.resolve = async (ids: string[]) => {
      const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
      if (!normalizedIds.length) {
        return [];
      }

      const payload: OptionResolvePayload = { ids: normalizedIds };
      return client.request<TItem[]>({
        url: `${resource}/resolve`,
        method: 'POST',
        data: payload,
      });
    };

    return endpoint;
  };

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
  create: (payload: TForm) =>
    client.request<TRecord>({ url: resource, method: 'POST', data: payload }),
  update: (id: string, payload: TForm) =>
    client.request<TRecord>({ url: `${resource}/${id}`, method: 'PUT', data: payload }),
  remove: (id: string) =>
    client.request<{ ok: true }>({ url: `${resource}/${id}`, method: 'DELETE' }),
  export: createDownloadEndpoint<TListParams>(
    exportResource ?? `${resource}/export`,
    exportFileName,
  ),
});

export const createApiFactory = (options: ClientOptions) => {
  const client = createRequestClient(options);
  const createOptionSearch = createOptionEndpoint(client);
  const userCrud = createCrudEndpoints<UserRecord, UserFormPayload, PaginatedResult<UserRecord>>(
    client,
    { resource: '/users', exportFileName: 'users.xlsx' },
  );
  const roleCrud = createCrudEndpoints<RoleRecord, RoleFormPayload, PaginatedRoles>(client, {
    resource: '/roles',
    exportFileName: 'roles.xlsx',
  });
  const permissionCrud = createCrudEndpoints<
    PermissionRecord,
    PermissionFormPayload,
    PaginatedPermissions
  >(client, {
    resource: '/permissions',
    exportFileName: 'permissions.xlsx',
  });
  const realtimeTopicCrud = createCrudEndpoints<
    RealtimeTopicRecord,
    RealtimeTopicFormPayload,
    PaginatedRealtimeTopics
  >(client, {
    resource: '/realtime-topics',
    exportFileName: 'realtime-topics.xlsx',
  });
  const clientCrud = createCrudEndpoints<
    AuthClientRecord,
    AuthClientFormPayload,
    PaginatedAuthClients
  >(client, {
    resource: '/clients',
    exportFileName: 'clients.xlsx',
  });
  const menuCrud = createCrudEndpoints<MenuNodeRecord, MenuNodeFormPayload>(client, {
    resource: '/menus',
  });
  const oauthProviderCrud = createCrudEndpoints<OAuthProviderRecord, OAuthProviderFormPayload>(
    client,
    {
      resource: '/oauth/providers',
    },
  );
  const oauthApplicationCrud = createCrudEndpoints<
    OAuthApplicationRecord,
    OAuthApplicationFormPayload
  >(client, {
    resource: '/oauth/applications',
  });
  const attachmentCrud = createCrudEndpoints<
    MediaAssetRecord,
    MediaAssetUpdatePayload,
    PaginatedMediaAssets,
    MediaAssetListQuery
  >(client, {
    resource: '/attachments',
    exportFileName: 'attachments.xlsx',
  });

  return {
    auth: {
      strategies: () => client.request<AuthStrategyCollection>({ url: '/auth/strategies' }),
      oauthAuthorizeUrl: (providerCode: string, returnTo?: string) =>
        client.request<OAuthAuthorizeUrlResult>({
          url: `/auth/oauth/providers/${providerCode}/authorize-url`,
          params: returnTo ? { returnTo } : undefined,
        }),
      exchangeOauthTicket: (ticket: string) =>
        client.request<AuthSession>({
          url: '/auth/oauth/tickets/exchange',
          method: 'POST',
          data: { ticket },
        }),
      sendVerificationCode: (payload: SendVerificationCodePayload) =>
        client.request<VerificationCodeSendResult>({
          url: '/auth/verification-codes/send',
          method: 'POST',
          data: payload,
        }),
      verifyVerificationCode: (payload: VerifyVerificationCodePayload) =>
        client.request<VerificationCodeVerifyResult>({
          url: '/auth/verification-codes/verify',
          method: 'POST',
          data: payload,
        }),
      login: (payload: LoginPayload) =>
        client.request<AuthSession>({ url: '/auth/login', method: 'POST', data: payload }),
      register: (payload: RegisterPayload) =>
        client.request<AuthSession>({ url: '/auth/register', method: 'POST', data: payload }),
      me: () => client.request<CurrentUser>({ url: '/auth/me' }),
      updateProfile: (payload: CurrentUserProfilePayload) =>
        client.request<CurrentUser>({
          url: '/auth/profile',
          method: 'PUT',
          data: payload,
        }),
      updateAvatar: (avatarFileId: string | null) =>
        client.request<CurrentUser>({
          url: '/auth/avatar',
          method: 'PUT',
          data: { avatarFileId },
        }),
      updatePreferences: (payload: UserPreferences) =>
        client.request<UserPreferences>({ url: '/auth/preferences', method: 'PUT', data: payload }),
      refresh: (refreshToken: string) =>
        client.request<AuthSession>({
          url: '/auth/refresh',
          method: 'POST',
          data: { refreshToken },
        }),
      logout: (refreshToken: string) =>
        client.request<{ ok: true }>({
          url: '/auth/logout',
          method: 'POST',
          data: { refreshToken },
        }),
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
      permissionSources: (id: string) =>
        client.request<UserPermissionSource>({ url: `/users/${id}/permission-sources` }),
      roles: createOptionSearch<
        PaginatedRoleSummaries['items'][number],
        PaginatedRoleSummaries
      >('/users/options/roles'),
    },
    roles: {
      ...roleCrud,
      permissions: createOptionSearch<
        PaginatedPermissionSummaries['items'][number],
        PaginatedPermissionSummaries
      >('/roles/options/permissions'),
    },
    permissions: {
      ...permissionCrud,
      modules: () => client.request<string[]>({ url: '/permissions/options/modules' }),
    },
    realtimeTopics: {
      ...realtimeTopicCrud,
      permissions: createOptionSearch<
        PaginatedPermissionSummaries['items'][number],
        PaginatedPermissionSummaries
      >('/realtime-topics/options/permissions'),
    },
    clients: {
      ...clientCrud,
    },
    oauth: {
      providers: oauthProviderCrud,
      applications: {
        ...oauthApplicationCrud,
        permissions: createOptionSearch<
          PaginatedPermissionSummaries['items'][number],
          PaginatedPermissionSummaries
        >(
          '/oauth/applications/options/permissions',
        ),
      },
    },
    menus: {
      ...menuCrud,
      current: () => client.request<MenuNodeRecord[]>({ url: '/menus/current' }),
      tree: menuCrud.list,
      permissions: createOptionSearch<
        PaginatedPermissionSummaries['items'][number],
        PaginatedPermissionSummaries
      >(
        '/menus/options/permissions',
      ),
    },
    files: {
      prepareUpload: (payload: UploadPreparePayload) =>
        client.request<UploadPrepareResult>({
          url: '/files/presign',
          method: 'POST',
          data: payload,
        }),
      completeUpload: (payload: UploadCallbackPayload) =>
        client.request<UploadCallbackResult>({
          url: '/files/callback',
          method: 'POST',
          data: payload,
        }),
    },
    attachments: {
      ...attachmentCrud,
      images: createOptionSearch<
        MediaAssetRecord,
        PaginatedMediaAssets,
        MediaAssetListQuery
      >('/attachments/options/images'),
    },
    live: {
      history: (params?: Record<string, string | number | boolean | undefined>) =>
        client.request<PaginatedLiveMessages>({ url: '/realtime/messages', params }),
      exportHistory: createDownloadEndpoint('/realtime/messages/export', 'live-messages.xlsx'),
      post: (content: string) =>
        client.request<LiveMessage>({
          url: '/realtime/messages',
          method: 'POST',
          data: { content },
        }),
    },
  };
};

