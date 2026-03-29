import type { PermissionSummary } from './auth';

export type OAuthProviderProtocol = 'OIDC' | 'OAUTH2';
export type OAuthProviderClientAuthMethod = 'CLIENT_SECRET_BASIC' | 'CLIENT_SECRET_POST';
export type OAuthApplicationClientType = 'PUBLIC' | 'CONFIDENTIAL';

export interface OAuthClaimMapping {
  subject: string;
  email?: string;
  username?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface OAuthProviderPublicSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface OAuthProviderRecord extends OAuthProviderPublicSummary {
  protocol: OAuthProviderProtocol;
  issuer?: string | null;
  discoveryUrl?: string | null;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string | null;
  jwksUri?: string | null;
  clientId: string;
  defaultScopes: string[];
  enabled: boolean;
  allowLogin: boolean;
  autoRegister: boolean;
  autoLinkByEmail: boolean;
  usePkce: boolean;
  clientAuthMethod: OAuthProviderClientAuthMethod;
  claimMapping: OAuthClaimMapping;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthProviderFormPayload {
  code: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  protocol: OAuthProviderProtocol;
  issuer?: string | null;
  discoveryUrl?: string | null;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string | null;
  jwksUri?: string | null;
  clientId: string;
  clientSecret?: string;
  defaultScopes: string[];
  enabled: boolean;
  allowLogin: boolean;
  autoRegister: boolean;
  autoLinkByEmail: boolean;
  usePkce: boolean;
  clientAuthMethod: OAuthProviderClientAuthMethod;
  claimMapping: OAuthClaimMapping;
}

export interface OAuthApplicationRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  homepageUrl?: string | null;
  clientId: string;
  clientType: OAuthApplicationClientType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  defaultScopes: string[];
  enabled: boolean;
  skipConsent: boolean;
  requirePkce: boolean;
  allowAuthorizationCode: boolean;
  allowRefreshToken: boolean;
  permissions: PermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface OAuthApplicationFormPayload {
  code: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  homepageUrl?: string | null;
  clientId: string;
  clientSecret?: string;
  clientType: OAuthApplicationClientType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  defaultScopes: string[];
  enabled: boolean;
  skipConsent: boolean;
  requirePkce: boolean;
  allowAuthorizationCode: boolean;
  allowRefreshToken: boolean;
  permissionIds: string[];
}

export interface OAuthAuthorizeUrlResult {
  redirectUrl: string;
}

export interface OAuthTicketExchangePayload {
  ticket: string;
}

export interface OAuthAuthorizeScopeView {
  code: string;
  name: string;
  description: string;
}

export interface OAuthAuthorizeSessionView {
  sessionState: string;
  expiresAt: string;
  application: {
    id: string;
    code: string;
    clientId: string;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    homepageUrl?: string | null;
  };
  user: {
    id: string;
    username: string;
    nickname: string;
  };
  scopes: OAuthAuthorizeScopeView[];
}

export type OAuthAuthorizeDecision = 'approve' | 'deny';

export interface OAuthAuthorizeDecisionPayload {
  decision: OAuthAuthorizeDecision;
}

export interface OAuthAuthorizeDecisionResult {
  redirectUrl: string;
}
