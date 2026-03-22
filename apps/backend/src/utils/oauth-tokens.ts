import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { oidcKeySet } from './oidc-keys';
import { parseExpiryToSeconds } from './token';

const oauthIssuer = env.OAUTH_ISSUER.replace(/\/$/, '');
const oauthResourceAudience = 'rbac-api';

export const oauthAccessTokenTtlSeconds = parseExpiryToSeconds(env.OAUTH_ACCESS_TOKEN_EXPIRES_IN);

export type OAuthAccessPayload = {
  iss: string;
  aud: string[];
  sub: string;
  azp: string;
  client_id: string;
  jti: string;
  scope: string;
  permissions: string[];
  type: 'oauth_access';
};

export type OidcIdTokenPayload = {
  iss: string;
  aud: string;
  sub: string;
  azp: string;
  jti: string;
  nonce?: string;
  type: 'oidc_id';
  preferred_username?: string;
  name?: string;
  nickname?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
};

export const signOAuthAccessToken = (input: {
  subject: string;
  applicationClientId: string;
  tokenId: string;
  scopes: string[];
  permissions: string[];
}) =>
  jwt.sign(
    {
      iss: oauthIssuer,
      aud: [oauthResourceAudience, input.applicationClientId],
      sub: input.subject,
      azp: input.applicationClientId,
      client_id: input.applicationClientId,
      jti: input.tokenId,
      scope: input.scopes.join(' '),
      permissions: input.permissions,
      type: 'oauth_access',
    } satisfies OAuthAccessPayload,
    oidcKeySet.privateKeyPem,
    {
      algorithm: 'RS256',
      keyid: oidcKeySet.kid,
      expiresIn: oauthAccessTokenTtlSeconds,
    },
  );

export const signOidcIdToken = (input: {
  subject: string;
  applicationClientId: string;
  tokenId: string;
  scopes: string[];
  nonce?: string;
  username?: string;
  nickname?: string;
  avatarUrl?: string | null;
  email?: string | null;
}) => {
  const claims: OidcIdTokenPayload = {
    iss: oauthIssuer,
    aud: input.applicationClientId,
    sub: input.subject,
    azp: input.applicationClientId,
    jti: input.tokenId,
    type: 'oidc_id',
  };

  if (input.nonce) {
    claims.nonce = input.nonce;
  }

  if (input.scopes.includes('profile')) {
    claims.preferred_username = input.username;
    claims.name = input.nickname ?? input.username;
    claims.nickname = input.nickname;
    claims.picture = input.avatarUrl ?? undefined;
  }

  if (input.scopes.includes('email') && input.email) {
    claims.email = input.email;
    claims.email_verified = true;
  }

  return jwt.sign(claims, oidcKeySet.privateKeyPem, {
    algorithm: 'RS256',
    keyid: oidcKeySet.kid,
    expiresIn: oauthAccessTokenTtlSeconds,
  });
};

export const verifyOAuthAccessToken = (token: string) =>
  jwt.verify(token, oidcKeySet.publicKeyPem, {
    algorithms: ['RS256'],
    issuer: oauthIssuer,
  }) as OAuthAccessPayload;
