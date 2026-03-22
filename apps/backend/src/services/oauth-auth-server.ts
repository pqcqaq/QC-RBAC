import type { AuthClientSummary } from '@rbac/api-common';
import { AuthClientType } from '@rbac/api-common';
import type { Prisma } from '../lib/prisma-generated';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { addSeconds } from '../utils/time';
import { badRequest, notFound, unauthorized } from '../utils/errors';
import { randomBase64Url, hashOpaqueToken, decryptOAuthSecret, encryptOAuthSecret } from '../utils/oauth-security';
import { oidcKeySet } from '../utils/oidc-keys';
import {
  oauthAccessTokenTtlSeconds,
  signOAuthAccessToken,
  signOidcIdToken,
  verifyOAuthAccessToken,
  type OAuthAccessPayload,
} from '../utils/oauth-tokens';
import { buildCurrentUser, getUserPermissionCodes } from '../utils/rbac';
import { withSnowflakeId } from '../utils/persistence';
import {
  authenticateOAuthApplication,
  getEnabledOAuthProviderByCode,
  resolveOAuthApplicationByClientId,
} from './oauth-admin';
import { issueUserSession } from './session-service';
import { syncUserRoles } from './rbac-write';
import { resolveAuthClientSummaryByCode, resolveWebAuthClientOrigin } from './auth-clients';
import { parseOAuthClaimMapping } from '../utils/oauth-records';
import { verifyAccessToken } from '../utils/token';

const issuer = env.OAUTH_ISSUER.replace(/\/$/, '');
const standardScopes = new Set(['openid', 'profile', 'email', 'offline_access']);
const upstreamRefreshLeadSeconds = 60 * 5;

type AuthorizeRequestInput = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'PLAIN';
  nonce?: string;
  currentUrl: string;
  userId?: string | null;
};

type AuthorizationSessionPayload = {
  clientState?: string;
  scopes: string[];
  permissionScopes: string[];
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'PLAIN';
  nonce?: string;
};

type ExternalLoginStatePayload = {
  returnTo?: string | null;
  nonce?: string;
};

type LoginTicketPayload = {
  returnTo?: string | null;
  providerCode?: string;
};

type UpstreamTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  id_token?: string;
};

type OAuthAccessContext = {
  payload: OAuthAccessPayload;
  user: Awaited<ReturnType<typeof buildCurrentUser>>;
  application: Awaited<ReturnType<typeof resolveOAuthApplicationByClientId>>;
  token: Awaited<ReturnType<typeof readOAuthAccessTokenById>>;
  scopes: string[];
  permissionScopes: string[];
};

const normalizeScopeList = (value?: string) =>
  [...new Set((value ?? '').split(/\s+/).map(item => item.trim()).filter(Boolean))];

const isPkceMethod = (value?: string): value is 'S256' | 'PLAIN' =>
  value === 'S256' || value === 'PLAIN';

const assertRedirectUriAllowed = (redirectUri: string, allowedRedirectUris: string[]) => {
  if (!allowedRedirectUris.includes(redirectUri)) {
    throw badRequest('redirect_uri is not allowed');
  }
};

const buildRedirectUrl = (baseUrl: string, params: Record<string, string | undefined>) => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const resolveScopeSet = (
  requestedScope: string | undefined,
  application: Awaited<ReturnType<typeof resolveOAuthApplicationByClientId>>,
) => {
  const scopes = normalizeScopeList(requestedScope);
  const finalScopes = scopes.length ? scopes : application.defaultScopes;

  if ((finalScopes.includes('profile') || finalScopes.includes('email')) && !finalScopes.includes('openid')) {
    throw badRequest('profile/email scopes require openid');
  }

  const allowedPermissionCodes = new Set(application.permissions.map(({ permission }) => permission.code));
  const permissionScopes = finalScopes.filter(scope => !standardScopes.has(scope));
  permissionScopes.forEach((scope) => {
    if (!allowedPermissionCodes.has(scope)) {
      throw badRequest(`invalid scope: ${scope}`);
    }
  });

  return {
    scopes: finalScopes,
    permissionScopes,
  };
};

const describeScopes = (
  application: Awaited<ReturnType<typeof resolveOAuthApplicationByClientId>>,
  scopes: string[],
) =>
  scopes.map((scope) => {
    if (scope === 'openid') {
      return { code: scope, name: 'OpenID 身份', description: '允许客户端识别当前登录用户。' };
    }
    if (scope === 'profile') {
      return { code: scope, name: '基础资料', description: '允许客户端读取昵称、用户名与头像等资料。' };
    }
    if (scope === 'email') {
      return { code: scope, name: '邮箱资料', description: '允许客户端读取当前账号邮箱。' };
    }
    if (scope === 'offline_access') {
      return { code: scope, name: '离线访问', description: '允许客户端在用户离线后继续刷新访问令牌。' };
    }

    const permission = application.permissions.find(({ permission }) => permission.code === scope)?.permission;
    return {
      code: scope,
      name: permission?.name ?? scope,
      description: permission?.description ?? `${permission?.module ?? 'api'} / ${permission?.action ?? 'access'}`,
    };
  });

const buildPkceChallenge = (codeVerifier: string, method: 'S256' | 'PLAIN') => {
  if (method === 'PLAIN') {
    return codeVerifier;
  }

  return createHash('sha256').update(codeVerifier).digest('base64url');
};

const now = () => new Date();

const subtractSeconds = (date: Date, seconds: number) =>
  new Date(date.getTime() - seconds * 1000);

const toSafeRefreshAt = (expiresAt: Date) => {
  const refreshAt = subtractSeconds(expiresAt, upstreamRefreshLeadSeconds);
  return refreshAt.getTime() <= Date.now() ? now() : refreshAt;
};

const loadActiveState = async (
  state: string,
  kind: 'AUTHORIZE_SESSION' | 'EXTERNAL_LOGIN' | 'LOGIN_TICKET',
) => {
  const record = await prisma.oAuthState.findFirst({
    where: {
      state,
      kind,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      application: {
        include: {
          permissions: {
            where: { deleteAt: null },
            include: { permission: true },
          },
        },
      },
      provider: true,
      authClient: true,
      user: true,
    },
  });

  if (!record) {
    throw badRequest('OAuth state is invalid or expired');
  }

  return record;
};

const consumeState = async (id: string) => {
  await prisma.oAuthState.update({
    where: { id },
    data: {
      consumedAt: new Date(),
    },
  });
};

const issueAuthorizationCode = async (input: {
  application: Awaited<ReturnType<typeof resolveOAuthApplicationByClientId>>;
  userId: string;
  scopes: string[];
  permissionScopes: string[];
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'PLAIN';
  nonce?: string;
}) => {
  const currentPermissions = await getUserPermissionCodes(input.userId);
  const unavailableScopes = input.permissionScopes.filter(scope => !currentPermissions.includes(scope));
  if (unavailableScopes.length > 0) {
    throw unauthorized(`requested scopes are not granted for current user: ${unavailableScopes.join(', ')}`);
  }

  const code = randomBase64Url(32);
  const sessionId = randomUUID();

  await prisma.oAuthToken.create({
    data: withSnowflakeId({
      kind: 'AUTHORIZATION_CODE',
      tokenId: randomUUID(),
      tokenHash: hashOpaqueToken(code),
      applicationId: input.application.id,
      userId: input.userId,
      sessionId,
      redirectUri: input.redirectUri,
      scope: input.scopes,
      audience: [input.application.clientId],
      codeChallenge: input.codeChallenge ?? null,
      codeChallengeMethod: input.codeChallengeMethod ?? null,
      nonce: input.nonce ?? null,
      expiresAt: addSeconds(now(), env.OAUTH_AUTHORIZATION_CODE_EXPIRES_IN_SECONDS),
    }),
  });

  return code;
};

const issueOauthTokenSet = async (input: {
  application: Awaited<ReturnType<typeof resolveOAuthApplicationByClientId>>;
  userId: string;
  scopes: string[];
  nonce?: string | null;
  sessionId?: string | null;
}) => {
  const user = await buildCurrentUser(input.userId);
  const grantedPermissions = input.scopes.filter(scope => !standardScopes.has(scope));
  const accessTokenId = randomUUID();
  const sessionId = input.sessionId ?? randomUUID();

  await prisma.oAuthToken.create({
    data: withSnowflakeId({
      kind: 'ACCESS_TOKEN',
      tokenId: accessTokenId,
      applicationId: input.application.id,
      userId: input.userId,
      sessionId,
      scope: input.scopes,
      audience: ['rbac-api', input.application.clientId],
      expiresAt: addSeconds(now(), oauthAccessTokenTtlSeconds),
    }),
  });

  const accessToken = signOAuthAccessToken({
    subject: input.userId,
    applicationClientId: input.application.clientId,
    tokenId: accessTokenId,
    scopes: input.scopes,
    permissions: grantedPermissions,
  });

  let refreshToken: string | undefined;
  if (input.scopes.includes('offline_access') && input.application.allowRefreshToken) {
    refreshToken = randomBase64Url(48);
    await prisma.oAuthToken.create({
      data: withSnowflakeId({
        kind: 'REFRESH_TOKEN',
        tokenId: randomUUID(),
        tokenHash: hashOpaqueToken(refreshToken),
        applicationId: input.application.id,
        userId: input.userId,
        sessionId,
        scope: input.scopes,
        audience: [input.application.clientId],
        expiresAt: addSeconds(now(), env.OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS),
      }),
    });
  }

  const idToken = input.scopes.includes('openid')
    ? signOidcIdToken({
        subject: input.userId,
        applicationClientId: input.application.clientId,
        tokenId: randomUUID(),
        scopes: input.scopes,
        nonce: input.nonce ?? undefined,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatar,
        email: user.email,
      })
    : undefined;

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: oauthAccessTokenTtlSeconds,
    scope: input.scopes.join(' '),
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(idToken ? { id_token: idToken } : {}),
  };
};

const parseClientBasicAuth = (authorization?: string) => {
  if (!authorization?.startsWith('Basic ')) {
    return null;
  }

  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const [clientId, clientSecret] = decoded.split(':');
  if (!clientId) {
    return null;
  }

  return {
    clientId,
    clientSecret: clientSecret ?? '',
  };
};

const readTokenByRefreshToken = async (refreshToken: string) =>
  prisma.oAuthToken.findFirst({
    where: {
      kind: 'REFRESH_TOKEN',
      tokenHash: hashOpaqueToken(refreshToken),
      consumedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      application: {
        include: {
          permissions: {
            where: { deleteAt: null },
            include: { permission: true },
          },
        },
      },
    },
  });

const readTokenByCode = async (code: string) =>
  prisma.oAuthToken.findFirst({
    where: {
      kind: 'AUTHORIZATION_CODE',
      tokenHash: hashOpaqueToken(code),
      consumedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      application: {
        include: {
          permissions: {
            where: { deleteAt: null },
            include: { permission: true },
          },
        },
      },
    },
  });

const readOAuthAccessTokenById = async (tokenId: string) =>
  prisma.oAuthToken.findFirst({
    where: {
      kind: 'ACCESS_TOKEN',
      tokenId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      application: {
        include: {
          permissions: {
            where: { deleteAt: null },
            include: { permission: true },
          },
        },
      },
      user: true,
    },
  });

const resolveActiveBrowserUserId = (accessToken?: string | null) => {
  if (!accessToken) {
    return null;
  }

  try {
    const payload = verifyAccessToken(accessToken);
    if (payload.type !== 'access') {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
};

const toAllowedReturnOrigins = (authClient?: AuthClientSummary | null) => {
  const origins = new Set<string>([issuer]);
  if (authClient?.type === AuthClientType.WEB) {
    const webConfig = authClient.config as { protocol: string; host: string; port?: number | null };
    const port = webConfig.port ? `:${webConfig.port}` : '';
    origins.add(`${webConfig.protocol}://${webConfig.host}${port}`);
  }
  return origins;
};

const sanitizeReturnTo = (value: string | null | undefined, authClient?: AuthClientSummary | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const allowedOrigins = toAllowedReturnOrigins(authClient);
    const url = new URL(trimmed);
    if (allowedOrigins.has(url.origin)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
};

const buildProviderCallbackUrl = (providerCode: string) =>
  `${issuer}/api/auth/oauth/providers/${providerCode}/callback`;

const readJsonBody = async <T>(response: Response) => {
  const payload = await response.json().catch(() => null) as T | { error?: string; error_description?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? (payload as { error_description?: string; error?: string }).error_description
        ?? (payload as { error?: string }).error
        ?? 'OAuth provider request failed'
      : 'OAuth provider request failed';
    throw badRequest(message);
  }

  if (!payload) {
    throw badRequest('OAuth provider returned an empty response');
  }

  return payload as T;
};

const readNestedClaim = (payload: Record<string, unknown>, path: string | undefined) => {
  if (!path) {
    return undefined;
  }

  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return Reflect.get(current, segment);
    }
    return undefined;
  }, payload);
};

const decodeJwtPayload = (token?: string) => {
  if (!token) {
    return null;
  }

  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return null;
  }

  return decoded as Record<string, unknown>;
};

const resolveProviderProfile = async (
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>,
  accessToken: string,
  idToken?: string,
) => {
  if (provider.userinfoEndpoint) {
    const response = await fetch(provider.userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    return readJsonBody<Record<string, unknown>>(response);
  }

  const decoded = decodeJwtPayload(idToken);
  if (decoded) {
    return decoded;
  }

  throw badRequest('OAuth provider userinfo endpoint is not configured');
};

const createUniqueUsername = async (candidateValues: Array<string | null | undefined>) => {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/@.*/, '')
      .replace(/[^a-z0-9_]+/g, '')
      .slice(0, 18);

  const seed = candidateValues
    .map(value => value?.trim())
    .find((value): value is string => Boolean(value))
    ?? 'oauthuser';

  const base = normalize(seed) || 'oauthuser';

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? '' : String(index + 1);
    const username = `${base}${suffix}`.slice(0, 24);
    if (username.length < 3) {
      continue;
    }

    const existed = await prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });
    if (!existed) {
      return username;
    }
  }

  return `oauth${randomBase64Url(8).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18)}`;
};

const ensureMemberRoleId = async () => {
  const role = await prisma.role.findFirst({
    where: { code: 'member' },
    select: { id: true },
  });

  if (!role) {
    throw badRequest('Default member role not initialized');
  }

  return role.id;
};

const resolveOAuthIdentity = async (input: {
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>;
  profile: Record<string, unknown>;
}) => {
  const mapping = parseOAuthClaimMapping(input.provider.claimMapping as Prisma.JsonValue);
  const subject = readNestedClaim(input.profile, mapping.subject);
  if (typeof subject !== 'string' || !subject.trim()) {
    throw badRequest('OAuth provider profile does not contain a valid subject');
  }

  const email = readNestedClaim(input.profile, mapping.email);
  const username = readNestedClaim(input.profile, mapping.username);
  const nickname = readNestedClaim(input.profile, mapping.nickname);
  const avatarUrl = readNestedClaim(input.profile, mapping.avatarUrl);

  let oauthUser = await prisma.oAuthUser.findUnique({
    where: {
      providerId_providerSubject: {
        providerId: input.provider.id,
        providerSubject: subject,
      },
    },
    include: {
      user: true,
    },
  });

  let userId = oauthUser?.userId ?? null;

  if (!userId && input.provider.autoLinkByEmail && typeof email === 'string' && email.trim()) {
    const existedUser = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
      select: { id: true },
    });
    userId = existedUser?.id ?? null;
  }

  if (!userId) {
    if (!input.provider.autoRegister) {
      throw unauthorized('OAuth account is not linked');
    }

    const nicknameValue = typeof nickname === 'string' && nickname.trim()
      ? nickname.trim()
      : typeof username === 'string' && username.trim()
        ? username.trim()
        : '第三方用户';

    const user = await prisma.user.create({
      data: withSnowflakeId({
        username: await createUniqueUsername([
          typeof username === 'string' ? username : null,
          typeof email === 'string' ? email : null,
          subject,
        ]),
        email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
        nickname: nicknameValue.slice(0, 24),
        avatar: typeof avatarUrl === 'string' ? avatarUrl : null,
      }),
    });
    await syncUserRoles(user.id, [await ensureMemberRoleId()]);
    userId = user.id;
  }

  if (!oauthUser) {
    oauthUser = await prisma.oAuthUser.create({
      data: withSnowflakeId({
        providerId: input.provider.id,
        providerSubject: subject,
        userId,
        email: typeof email === 'string' ? email.trim().toLowerCase() : null,
        username: typeof username === 'string' ? username.trim() : null,
        nickname: typeof nickname === 'string' ? nickname.trim() : null,
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
        rawProfile: input.profile as Prisma.InputJsonValue,
        lastLoginAt: new Date(),
        lastSyncedAt: new Date(),
      }),
      include: {
        user: true,
      },
    });
  } else {
    oauthUser = await prisma.oAuthUser.update({
      where: { id: oauthUser.id },
      data: {
        userId,
        email: typeof email === 'string' ? email.trim().toLowerCase() : null,
        username: typeof username === 'string' ? username.trim() : null,
        nickname: typeof nickname === 'string' ? nickname.trim() : null,
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
        rawProfile: input.profile as Prisma.InputJsonValue,
        lastLoginAt: new Date(),
        lastSyncedAt: new Date(),
      },
      include: {
        user: true,
      },
    });
  }

  return {
    userId,
    oauthUser,
    subject,
    profile: {
      email: typeof email === 'string' ? email.trim().toLowerCase() : null,
      username: typeof username === 'string' ? username.trim() : null,
      nickname: typeof nickname === 'string' ? nickname.trim() : null,
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
    },
  };
};

const revokeExternalAccessTokens = async (oauthUserId: string, providerId: string) => {
  await prisma.oAuthToken.updateMany({
    where: {
      oauthUserId,
      providerId,
      kind: 'EXTERNAL_ACCESS_TOKEN',
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

const storeExternalOAuthTokens = async (input: {
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>;
  oauthUserId: string;
  userId: string;
  tokenResponse: UpstreamTokenResponse;
  existingRefreshToken?: Awaited<ReturnType<typeof readExternalRefreshTokenById>> | null;
}) => {
  await revokeExternalAccessTokens(input.oauthUserId, input.provider.id);

  const scopes = normalizeScopeList(input.tokenResponse.scope)
    .length
    ? normalizeScopeList(input.tokenResponse.scope)
    : input.provider.defaultScopes;
  const accessExpiresAt = addSeconds(now(), Math.max(input.tokenResponse.expires_in ?? 3600, 60));
  const sessionId = input.existingRefreshToken?.sessionId ?? randomUUID();

  await prisma.oAuthToken.create({
    data: withSnowflakeId({
      kind: 'EXTERNAL_ACCESS_TOKEN',
      tokenId: randomUUID(),
      tokenHash: hashOpaqueToken(input.tokenResponse.access_token),
      encryptedValue: encryptOAuthSecret(input.tokenResponse.access_token),
      providerId: input.provider.id,
      oauthUserId: input.oauthUserId,
      userId: input.userId,
      sessionId,
      scope: scopes,
      audience: [input.provider.code],
      expiresAt: accessExpiresAt,
      refreshAt: toSafeRefreshAt(accessExpiresAt),
    }),
  });

  const refreshTokenValue = input.tokenResponse.refresh_token;
  if (refreshTokenValue) {
    const refreshTokenHash = hashOpaqueToken(refreshTokenValue);
    if (
      input.existingRefreshToken
      && input.existingRefreshToken.tokenHash === refreshTokenHash
    ) {
      const refreshExpiresAt = addSeconds(
        now(),
        Math.max(
          input.tokenResponse.refresh_token_expires_in ?? env.OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
          upstreamRefreshLeadSeconds * 2,
        ),
      );

      await prisma.oAuthToken.update({
        where: { id: input.existingRefreshToken.id },
        data: {
          encryptedValue: encryptOAuthSecret(refreshTokenValue),
          refreshAt: toSafeRefreshAt(accessExpiresAt),
          expiresAt: refreshExpiresAt,
          scope: scopes,
        },
      });
      return;
    }

    if (input.existingRefreshToken) {
      await prisma.oAuthToken.update({
        where: { id: input.existingRefreshToken.id },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const refreshExpiresAt = addSeconds(
      now(),
      Math.max(
        input.tokenResponse.refresh_token_expires_in ?? env.OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
        upstreamRefreshLeadSeconds * 2,
      ),
    );

    await prisma.oAuthToken.create({
      data: withSnowflakeId({
        kind: 'EXTERNAL_REFRESH_TOKEN',
        tokenId: randomUUID(),
        tokenHash: refreshTokenHash,
        encryptedValue: encryptOAuthSecret(refreshTokenValue),
        providerId: input.provider.id,
        oauthUserId: input.oauthUserId,
        userId: input.userId,
        sessionId,
        scope: scopes,
        audience: [input.provider.code],
        expiresAt: refreshExpiresAt,
        refreshAt: toSafeRefreshAt(accessExpiresAt),
      }),
    });
  } else if (input.existingRefreshToken) {
    await prisma.oAuthToken.update({
      where: { id: input.existingRefreshToken.id },
      data: {
        refreshAt: toSafeRefreshAt(accessExpiresAt),
        scope: scopes,
      },
    });
  }
};

const buildExternalTokenRequestHeaders = (
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>,
  body: URLSearchParams,
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  const clientSecret = provider.clientSecretEncrypted
    ? decryptOAuthSecret(provider.clientSecretEncrypted)
    : '';

  if (provider.clientAuthMethod === 'CLIENT_SECRET_POST') {
    body.set('client_id', provider.clientId);
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }
    return headers;
  }

  headers.Authorization = `Basic ${Buffer.from(`${provider.clientId}:${clientSecret}`).toString('base64')}`;
  return headers;
};

const exchangeExternalCode = async (input: {
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>;
  code: string;
  codeVerifier?: string | null;
}) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: buildProviderCallbackUrl(input.provider.code),
  });

  if (input.codeVerifier) {
    body.set('code_verifier', input.codeVerifier);
  }

  const response = await fetch(input.provider.tokenEndpoint, {
    method: 'POST',
    headers: buildExternalTokenRequestHeaders(input.provider, body),
    body: body.toString(),
  });

  return readJsonBody<UpstreamTokenResponse>(response);
};

const refreshExternalTokenGrant = async (input: {
  provider: Awaited<ReturnType<typeof getEnabledOAuthProviderByCode>>;
  refreshToken: string;
  scope?: string[];
}) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });

  if (input.scope?.length) {
    body.set('scope', input.scope.join(' '));
  }

  const response = await fetch(input.provider.tokenEndpoint, {
    method: 'POST',
    headers: buildExternalTokenRequestHeaders(input.provider, body),
    body: body.toString(),
  });

  return readJsonBody<UpstreamTokenResponse>(response);
};

const readExternalRefreshTokenById = async (id: string) =>
  prisma.oAuthToken.findFirst({
    where: {
      id,
      kind: 'EXTERNAL_REFRESH_TOKEN',
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      provider: true,
      oauthUser: true,
    },
  });

export const getOpenIdConfiguration = async () => {
  const permissionCodes = await prisma.permission.findMany({
    select: { code: true },
    orderBy: { code: 'asc' },
  });

  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/oauth2/userinfo`,
    jwks_uri: `${issuer}/oauth2/jwks`,
    revocation_endpoint: `${issuer}/oauth2/revoke`,
    introspection_endpoint: `${issuer}/oauth2/introspect`,
    end_session_endpoint: `${issuer}/oauth2/logout`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: [
      'openid',
      'profile',
      'email',
      'offline_access',
      ...permissionCodes.map(({ code }) => code),
    ],
    claims_supported: [
      'sub',
      'preferred_username',
      'name',
      'nickname',
      'picture',
      'email',
      'email_verified',
    ],
  };
};

export const getJwksDocument = () => ({
  keys: [oidcKeySet.publicJwk],
});

export const startAuthorizationRequest = async (input: AuthorizeRequestInput) => {
  if (input.responseType !== 'code') {
    throw badRequest('unsupported response_type');
  }

  const application = await resolveOAuthApplicationByClientId(input.clientId);
  if (!application.allowAuthorizationCode) {
    throw unauthorized('authorization_code is disabled for this application');
  }

  assertRedirectUriAllowed(input.redirectUri, application.redirectUris);

  const { scopes, permissionScopes } = resolveScopeSet(input.scope, application);
  if ((application.requirePkce || application.clientType === 'PUBLIC') && !input.codeChallenge) {
    throw badRequest('code_challenge is required');
  }

  if (input.codeChallengeMethod && !isPkceMethod(input.codeChallengeMethod)) {
    throw badRequest('unsupported code_challenge_method');
  }

  if (!input.userId) {
    const webOrigin = await resolveWebAuthClientOrigin('web-console');

    return {
      type: 'login-required' as const,
      loginUrl: `${webOrigin}/login?returnTo=${encodeURIComponent(input.currentUrl)}`,
    };
  }

  const user = await buildCurrentUser(input.userId);
  if (user.status !== 'ACTIVE') {
    throw unauthorized('account disabled');
  }

  if (application.skipConsent) {
    const code = await issueAuthorizationCode({
      application,
      userId: input.userId,
      scopes,
      permissionScopes,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      nonce: input.nonce,
    });

    return {
      type: 'redirect' as const,
      redirectUrl: buildRedirectUrl(input.redirectUri, {
        code,
        state: input.state,
      }),
    };
  }

  const sessionState = randomBase64Url(24);
  await prisma.oAuthState.create({
    data: withSnowflakeId({
      kind: 'AUTHORIZE_SESSION',
      state: sessionState,
      applicationId: application.id,
      userId: input.userId,
      redirectUri: input.redirectUri,
      nonce: input.nonce ?? null,
      payload: {
        clientState: input.state,
        scopes,
        permissionScopes,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        nonce: input.nonce,
      } satisfies AuthorizationSessionPayload,
      expiresAt: addSeconds(now(), env.OAUTH_STATE_EXPIRES_IN_SECONDS),
    }),
  });

  return {
    type: 'consent' as const,
    sessionState,
    application,
    user,
    scopes: describeScopes(application, scopes),
  };
};

export const approveAuthorizationRequest = async (sessionState: string, userId: string) => {
  const session = await loadActiveState(sessionState, 'AUTHORIZE_SESSION');
  if (!session.application) {
    throw notFound('OAuth application not found');
  }
  if (session.userId && session.userId !== userId) {
    throw unauthorized('OAuth session user mismatch');
  }

  const payload = (session.payload ?? {}) as AuthorizationSessionPayload;
  const code = await issueAuthorizationCode({
    application: session.application,
    userId,
    scopes: payload.scopes ?? [],
    permissionScopes: payload.permissionScopes ?? [],
    redirectUri: payload.redirectUri ?? session.redirectUri ?? '',
    codeChallenge: payload.codeChallenge,
    codeChallengeMethod: payload.codeChallengeMethod,
    nonce: payload.nonce,
  });

  await consumeState(session.id);

  return buildRedirectUrl(payload.redirectUri ?? session.redirectUri ?? '', {
    code,
    state: payload.clientState,
  });
};

export const denyAuthorizationRequest = async (sessionState: string) => {
  const session = await loadActiveState(sessionState, 'AUTHORIZE_SESSION');
  const payload = (session.payload ?? {}) as AuthorizationSessionPayload;
  await consumeState(session.id);

  return buildRedirectUrl(payload.redirectUri ?? session.redirectUri ?? '', {
    error: 'access_denied',
    error_description: 'resource owner denied the request',
    state: payload.clientState,
  });
};

export const exchangeOAuthToken = async (input: {
  grantType: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string | null;
  authorization?: string;
}) => {
  const basicCredentials = parseClientBasicAuth(input.authorization);
  const clientId = basicCredentials?.clientId ?? input.clientId ?? '';
  const clientSecret = basicCredentials?.clientSecret ?? input.clientSecret ?? null;
  const application = await authenticateOAuthApplication({ clientId, clientSecret });

  if (input.grantType === 'authorization_code') {
    if (!input.code || !input.redirectUri) {
      throw badRequest('invalid authorization_code request');
    }

    const codeToken = await readTokenByCode(input.code);
    if (!codeToken || !codeToken.application || codeToken.applicationId !== application.id) {
      throw unauthorized('invalid authorization code');
    }

    if (codeToken.redirectUri !== input.redirectUri) {
      throw badRequest('redirect_uri mismatch');
    }

    if (codeToken.codeChallenge) {
      if (!input.codeVerifier) {
        throw badRequest('code_verifier is required');
      }

      const method = (codeToken.codeChallengeMethod ?? 'S256') as 'S256' | 'PLAIN';
      if (buildPkceChallenge(input.codeVerifier, method) !== codeToken.codeChallenge) {
        throw badRequest('invalid code_verifier');
      }
    }

    await prisma.oAuthToken.update({
      where: { id: codeToken.id },
      data: {
        consumedAt: new Date(),
      },
    });

    return issueOauthTokenSet({
      application: codeToken.application,
      userId: codeToken.userId!,
      scopes: codeToken.scope,
      nonce: codeToken.nonce,
      sessionId: codeToken.sessionId,
    });
  }

  if (input.grantType === 'refresh_token') {
    if (!input.refreshToken) {
      throw badRequest('invalid refresh_token request');
    }

    const refreshToken = await readTokenByRefreshToken(input.refreshToken);
    if (!refreshToken || !refreshToken.application || refreshToken.applicationId !== application.id) {
      throw unauthorized('invalid refresh token');
    }

    await prisma.oAuthToken.update({
      where: { id: refreshToken.id },
      data: {
        revokedAt: new Date(),
      },
    });

    return issueOauthTokenSet({
      application: refreshToken.application,
      userId: refreshToken.userId!,
      scopes: refreshToken.scope,
      sessionId: refreshToken.sessionId,
    });
  }

  throw badRequest('unsupported grant_type');
};

export const resolveOAuthAccessContext = async (accessToken: string): Promise<OAuthAccessContext> => {
  const payload = verifyOAuthAccessToken(accessToken);
  if (payload.type !== 'oauth_access') {
    throw unauthorized('invalid oauth access token');
  }

  const token = await readOAuthAccessTokenById(payload.jti);
  if (!token || !token.application || !token.userId) {
    throw unauthorized('invalid oauth access token');
  }

  const user = await buildCurrentUser(token.userId);
  if (user.status !== 'ACTIVE') {
    throw unauthorized('account disabled');
  }

  const scopes = token.scope;
  const permissionScopes = scopes.filter(scope => !standardScopes.has(scope));

  return {
    payload,
    application: token.application,
    token,
    scopes,
    permissionScopes,
    user: {
      ...user,
      permissions: user.permissions.filter(permission => permissionScopes.includes(permission)),
    },
  };
};

export const getOAuthUserInfo = async (accessToken: string) => {
  const context = await resolveOAuthAccessContext(accessToken);
  if (!context.scopes.includes('openid')) {
    throw unauthorized('openid scope is required');
  }

  const userInfo: Record<string, unknown> = {
    sub: context.user.id,
  };

  if (context.scopes.includes('profile')) {
    userInfo.preferred_username = context.user.username;
    userInfo.name = context.user.nickname;
    userInfo.nickname = context.user.nickname;
    userInfo.picture = context.user.avatar ?? undefined;
  }

  if (context.scopes.includes('email')) {
    userInfo.email = context.user.email;
    userInfo.email_verified = Boolean(context.user.email);
  }

  return userInfo;
};

export const introspectOAuthToken = async (input: {
  token: string;
  clientId?: string;
  clientSecret?: string | null;
  authorization?: string;
}) => {
  const basicCredentials = parseClientBasicAuth(input.authorization);
  const clientId = basicCredentials?.clientId ?? input.clientId ?? '';
  const clientSecret = basicCredentials?.clientSecret ?? input.clientSecret ?? null;
  const application = await authenticateOAuthApplication({ clientId, clientSecret });

  try {
    const payload = verifyOAuthAccessToken(input.token);
    const token = await readOAuthAccessTokenById(payload.jti);
    if (!token || token.applicationId !== application.id || !token.userId) {
      return { active: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { username: true },
    });

    return {
      active: true,
      client_id: application.clientId,
      token_type: 'access_token',
      scope: token.scope.join(' '),
      sub: token.userId,
      username: user?.username,
      aud: token.audience,
      iss: issuer,
      jti: token.tokenId,
      iat: Math.floor(token.createdAt.getTime() / 1000),
      exp: Math.floor(token.expiresAt.getTime() / 1000),
    };
  } catch {
    const refreshToken = await readTokenByRefreshToken(input.token);
    if (!refreshToken || refreshToken.applicationId !== application.id || !refreshToken.userId) {
      return { active: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: refreshToken.userId },
      select: { username: true },
    });

    return {
      active: true,
      client_id: application.clientId,
      token_type: 'refresh_token',
      scope: refreshToken.scope.join(' '),
      sub: refreshToken.userId,
      username: user?.username,
      aud: refreshToken.audience,
      iss: issuer,
      jti: refreshToken.tokenId,
      iat: Math.floor(refreshToken.createdAt.getTime() / 1000),
      exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
    };
  }
};

export const revokeOAuthToken = async (input: {
  token: string;
  clientId?: string;
  clientSecret?: string | null;
  authorization?: string;
}) => {
  const basicCredentials = parseClientBasicAuth(input.authorization);
  const clientId = basicCredentials?.clientId ?? input.clientId ?? '';
  const clientSecret = basicCredentials?.clientSecret ?? input.clientSecret ?? null;
  const application = await authenticateOAuthApplication({ clientId, clientSecret });

  try {
    const payload = verifyOAuthAccessToken(input.token);
    const token = await readOAuthAccessTokenById(payload.jti);
    if (token && token.applicationId === application.id) {
    await prisma.oAuthToken.update({
        where: { id: token.id },
        data: {
          revokedAt: new Date(),
        },
      });
    }
    return { ok: true };
  } catch {
    const refreshToken = await readTokenByRefreshToken(input.token);
    if (refreshToken && refreshToken.applicationId === application.id) {
      await prisma.oAuthToken.update({
        where: { id: refreshToken.id },
        data: {
          revokedAt: new Date(),
        },
      });
    }
    return { ok: true };
  }
};

export const buildExternalProviderAuthorizeUrl = async (input: {
  providerCode: string;
  authClient: AuthClientSummary;
  returnTo?: string | null;
}) => {
  if (input.authClient.type !== AuthClientType.WEB) {
    throw badRequest('Only web auth clients support browser OAuth login');
  }

  const provider = await getEnabledOAuthProviderByCode(input.providerCode);
  const state = randomBase64Url(24);
  const nonce = randomBase64Url(16);
  const codeVerifier = provider.usePkce ? randomBase64Url(48) : null;
  const sanitizedReturnTo = sanitizeReturnTo(input.returnTo, input.authClient);

  await prisma.oAuthState.create({
    data: withSnowflakeId({
      kind: 'EXTERNAL_LOGIN',
      state,
      providerId: provider.id,
      authClientId: input.authClient.id,
      codeVerifier,
      payload: {
        returnTo: sanitizedReturnTo,
        nonce,
      } satisfies ExternalLoginStatePayload,
      expiresAt: addSeconds(now(), env.OAUTH_STATE_EXPIRES_IN_SECONDS),
    }),
  });

  const redirectUrl = new URL(provider.authorizationEndpoint);
  redirectUrl.searchParams.set('response_type', 'code');
  redirectUrl.searchParams.set('client_id', provider.clientId);
  redirectUrl.searchParams.set('redirect_uri', buildProviderCallbackUrl(provider.code));
  redirectUrl.searchParams.set('scope', provider.defaultScopes.join(' '));
  redirectUrl.searchParams.set('state', state);

  if (provider.protocol === 'OIDC') {
    redirectUrl.searchParams.set('nonce', nonce);
  }

  if (provider.usePkce && codeVerifier) {
    redirectUrl.searchParams.set('code_challenge', buildPkceChallenge(codeVerifier, 'S256'));
    redirectUrl.searchParams.set('code_challenge_method', 'S256');
  }

  return {
    redirectUrl: redirectUrl.toString(),
  };
};

export const handleExternalProviderCallback = async (input: {
  providerCode: string;
  state: string;
  code: string;
}) => {
  const session = await loadActiveState(input.state, 'EXTERNAL_LOGIN');
  if (!session.provider || session.provider.code !== input.providerCode) {
    throw badRequest('OAuth provider mismatch');
  }
  if (!session.authClient) {
    throw badRequest('OAuth auth client is missing');
  }

  const tokenResponse = await exchangeExternalCode({
    provider: session.provider,
    code: input.code,
    codeVerifier: session.codeVerifier,
  });

  const profile = await resolveProviderProfile(
    session.provider,
    tokenResponse.access_token,
    tokenResponse.id_token,
  );
  const identity = await resolveOAuthIdentity({
    provider: session.provider,
    profile,
  });

  await storeExternalOAuthTokens({
    provider: session.provider,
    oauthUserId: identity.oauthUser.id,
    userId: identity.userId,
    tokenResponse,
  });

  const ticket = randomBase64Url(32);
  const ticketPayload = (session.payload ?? {}) as ExternalLoginStatePayload;
  await prisma.oAuthState.create({
    data: withSnowflakeId({
      kind: 'LOGIN_TICKET',
      state: ticket,
      providerId: session.provider.id,
      userId: identity.userId,
      authClientId: session.authClient.id,
      payload: {
        returnTo: ticketPayload.returnTo ?? null,
        providerCode: session.provider.code,
      } satisfies LoginTicketPayload,
      expiresAt: addSeconds(now(), env.OAUTH_LOGIN_TICKET_EXPIRES_IN_SECONDS),
    }),
  });

  await consumeState(session.id);

  const authClient = await resolveAuthClientSummaryByCode(session.authClient.code);
  if (authClient.type !== AuthClientType.WEB) {
    throw badRequest('OAuth callback target client is not a web client');
  }

  const webConfig = authClient.config as { protocol: string; host: string; port?: number | null };
  const port = webConfig.port ? `:${webConfig.port}` : '';
  const webOrigin = `${webConfig.protocol}://${webConfig.host}${port}`;
  const redirectUrl = new URL('/login', webOrigin);
  redirectUrl.searchParams.set('oauth_ticket', ticket);

  if (ticketPayload.returnTo) {
    redirectUrl.searchParams.set('returnTo', ticketPayload.returnTo);
  }

  return {
    redirectUrl: redirectUrl.toString(),
  };
};

export const exchangeOAuthLoginTicket = async (input: {
  ticket: string;
  authClient: AuthClientSummary;
}) => {
  const ticket = await loadActiveState(input.ticket, 'LOGIN_TICKET');
  if (!ticket.userId) {
    throw unauthorized('OAuth login ticket is invalid');
  }
  if (ticket.authClientId && ticket.authClientId !== input.authClient.id) {
    throw unauthorized('OAuth login ticket client mismatch');
  }

  await consumeState(ticket.id);
  return issueUserSession(ticket.userId, input.authClient);
};

export const refreshExternalOAuthAccessTokens = async () => {
  if (!env.OAUTH_UPSTREAM_REFRESH_ENABLED) {
    return { refreshed: 0, failed: 0 };
  }

  const rows = await prisma.oAuthToken.findMany({
    where: {
      kind: 'EXTERNAL_REFRESH_TOKEN',
      revokedAt: null,
      encryptedValue: {
        not: null,
      },
      refreshAt: {
        lte: new Date(),
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      provider: true,
      oauthUser: true,
    },
    orderBy: [{ refreshAt: 'asc' }, { updatedAt: 'asc' }],
    take: env.OAUTH_UPSTREAM_REFRESH_BATCH_SIZE,
  });

  let refreshed = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.provider || !row.oauthUser || !row.userId || !row.encryptedValue) {
      failed += 1;
      continue;
    }

    try {
      const tokenResponse = await refreshExternalTokenGrant({
        provider: row.provider,
        refreshToken: decryptOAuthSecret(row.encryptedValue),
        scope: row.scope,
      });

      await storeExternalOAuthTokens({
        provider: row.provider,
        oauthUserId: row.oauthUser.id,
        userId: row.userId,
        tokenResponse,
        existingRefreshToken: row,
      });
      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error('[oauth:upstream-refresh] failed', {
        providerCode: row.provider.code,
        oauthUserId: row.oauthUser.id,
        error,
      });
    }
  }

  return { refreshed, failed };
};

export const resolveBrowserSessionUserId = (accessToken?: string | null) =>
  resolveActiveBrowserUserId(accessToken);
