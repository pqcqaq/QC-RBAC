import type {
  OAuthApplicationRecord,
  OAuthClaimMapping,
  OAuthProviderPublicSummary,
  OAuthProviderRecord,
} from '@rbac/api-common';
import type { OAuthApplication, OAuthApplicationPermission, OAuthProvider, Permission, Prisma } from '@prisma/client';
import { toPermissionSummary } from './rbac-records';

export const defaultOAuthClaimMapping: OAuthClaimMapping = {
  subject: 'sub',
  email: 'email',
  username: 'preferred_username',
  nickname: 'name',
  avatarUrl: 'picture',
};

export const parseOAuthClaimMapping = (value: Prisma.JsonValue | null | undefined): OAuthClaimMapping => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultOAuthClaimMapping;
  }

  return {
    subject: typeof value.subject === 'string' ? value.subject : defaultOAuthClaimMapping.subject,
    email: typeof value.email === 'string' ? value.email : defaultOAuthClaimMapping.email,
    username: typeof value.username === 'string' ? value.username : defaultOAuthClaimMapping.username,
    nickname: typeof value.nickname === 'string' ? value.nickname : defaultOAuthClaimMapping.nickname,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : defaultOAuthClaimMapping.avatarUrl,
  };
};

type OAuthProviderRecordInput = Pick<
  OAuthProvider,
  | 'id'
  | 'code'
  | 'name'
  | 'description'
  | 'logoUrl'
  | 'protocol'
  | 'issuer'
  | 'discoveryUrl'
  | 'authorizationEndpoint'
  | 'tokenEndpoint'
  | 'userinfoEndpoint'
  | 'jwksUri'
  | 'clientId'
  | 'defaultScopes'
  | 'enabled'
  | 'allowLogin'
  | 'autoRegister'
  | 'autoLinkByEmail'
  | 'usePkce'
  | 'clientAuthMethod'
  | 'claimMapping'
  | 'createdAt'
  | 'updatedAt'
>;

type OAuthApplicationRecordInput = Pick<
  OAuthApplication,
  | 'id'
  | 'code'
  | 'name'
  | 'description'
  | 'logoUrl'
  | 'homepageUrl'
  | 'clientId'
  | 'clientType'
  | 'redirectUris'
  | 'postLogoutRedirectUris'
  | 'defaultScopes'
  | 'enabled'
  | 'skipConsent'
  | 'requirePkce'
  | 'allowAuthorizationCode'
  | 'allowRefreshToken'
  | 'createdAt'
  | 'updatedAt'
> & {
  permissions: Array<OAuthApplicationPermission & { permission: Permission }>;
};

export const toOAuthProviderPublicSummary = (
  provider: Pick<OAuthProvider, 'id' | 'code' | 'name' | 'description' | 'logoUrl'>,
): OAuthProviderPublicSummary => ({
  id: provider.id,
  code: provider.code,
  name: provider.name,
  description: provider.description ?? undefined,
  logoUrl: provider.logoUrl ?? undefined,
});

export const toOAuthProviderRecord = (provider: OAuthProviderRecordInput): OAuthProviderRecord => ({
  ...toOAuthProviderPublicSummary(provider),
  protocol: provider.protocol,
  issuer: provider.issuer ?? undefined,
  discoveryUrl: provider.discoveryUrl ?? undefined,
  authorizationEndpoint: provider.authorizationEndpoint,
  tokenEndpoint: provider.tokenEndpoint,
  userinfoEndpoint: provider.userinfoEndpoint ?? undefined,
  jwksUri: provider.jwksUri ?? undefined,
  clientId: provider.clientId,
  defaultScopes: provider.defaultScopes,
  enabled: provider.enabled,
  allowLogin: provider.allowLogin,
  autoRegister: provider.autoRegister,
  autoLinkByEmail: provider.autoLinkByEmail,
  usePkce: provider.usePkce,
  clientAuthMethod: provider.clientAuthMethod,
  claimMapping: parseOAuthClaimMapping(provider.claimMapping),
  createdAt: provider.createdAt.toISOString(),
  updatedAt: provider.updatedAt.toISOString(),
});

export const toOAuthApplicationRecord = (
  application: OAuthApplicationRecordInput,
): OAuthApplicationRecord => ({
  id: application.id,
  code: application.code,
  name: application.name,
  description: application.description ?? undefined,
  logoUrl: application.logoUrl ?? undefined,
  homepageUrl: application.homepageUrl ?? undefined,
  clientId: application.clientId,
  clientType: application.clientType,
  redirectUris: application.redirectUris,
  postLogoutRedirectUris: application.postLogoutRedirectUris,
  defaultScopes: application.defaultScopes,
  enabled: application.enabled,
  skipConsent: application.skipConsent,
  requirePkce: application.requirePkce,
  allowAuthorizationCode: application.allowAuthorizationCode,
  allowRefreshToken: application.allowRefreshToken,
  permissions: application.permissions.map(({ permission }) => toPermissionSummary(permission)),
  createdAt: application.createdAt.toISOString(),
  updatedAt: application.updatedAt.toISOString(),
});
