import type {
  OAuthApplicationFormPayload,
  OAuthProviderFormPayload,
  OAuthProviderPublicSummary,
} from '@rbac/api-common';
import type { Prisma } from '../lib/prisma-generated';
import { AuthClientType, type OAuthApplicationClientType } from '@rbac/api-common';
import { prisma } from '../lib/prisma';
import { badRequest, notFound, unauthorized } from '../utils/errors';
import { encryptOAuthSecret } from '../utils/oauth-security';
import {
  defaultOAuthClaimMapping,
  toOAuthApplicationRecord,
  toOAuthProviderPublicSummary,
  toOAuthProviderRecord,
} from '../utils/oauth-records';
import { hashSecret, compareSecret } from '../utils/password';
import { withSnowflakeId } from '../utils/persistence';

const oauthProviderInclude = {
  id: true,
  code: true,
  name: true,
  description: true,
  logoUrl: true,
  protocol: true,
  issuer: true,
  discoveryUrl: true,
  authorizationEndpoint: true,
  tokenEndpoint: true,
  userinfoEndpoint: true,
  jwksUri: true,
  clientId: true,
  defaultScopes: true,
  enabled: true,
  allowLogin: true,
  autoRegister: true,
  autoLinkByEmail: true,
  usePkce: true,
  clientAuthMethod: true,
  claimMapping: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OAuthProviderSelect;

const oauthApplicationInclude = {
  permissions: {
    where: {
      deleteAt: null,
    },
    include: {
      permission: true,
    },
  },
} satisfies Prisma.OAuthApplicationInclude;

const normalizeStringArray = (values: string[]) =>
  [...new Set(values.map(item => item.trim()).filter(Boolean))];

const loadProviderDiscovery = async (payload: OAuthProviderFormPayload) => {
  if (!payload.discoveryUrl || payload.protocol !== 'OIDC') {
    return payload;
  }

  const response = await fetch(payload.discoveryUrl);
  if (!response.ok) {
    throw badRequest('无法读取 OAuth Provider discovery 配置');
  }

  const discovery = await response.json() as {
    issuer?: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
    jwks_uri?: string;
  };

  return {
    ...payload,
    issuer: discovery.issuer ?? payload.issuer ?? null,
    authorizationEndpoint: discovery.authorization_endpoint ?? payload.authorizationEndpoint,
    tokenEndpoint: discovery.token_endpoint ?? payload.tokenEndpoint,
    userinfoEndpoint: discovery.userinfo_endpoint ?? payload.userinfoEndpoint ?? null,
    jwksUri: discovery.jwks_uri ?? payload.jwksUri ?? null,
  };
};

const buildOAuthProviderCreateInput = async (
  payload: OAuthProviderFormPayload,
  current?: { clientSecretEncrypted?: string | null },
): Promise<Prisma.OAuthProviderCreateInput | Prisma.OAuthProviderUpdateInput> => {
  const hydrated = await loadProviderDiscovery(payload);

  const nextInput: Prisma.OAuthProviderCreateInput | Prisma.OAuthProviderUpdateInput = {
    code: hydrated.code,
    name: hydrated.name,
    description: hydrated.description ?? null,
    logoUrl: hydrated.logoUrl ?? null,
    protocol: hydrated.protocol,
    issuer: hydrated.issuer ?? null,
    discoveryUrl: hydrated.discoveryUrl ?? null,
    authorizationEndpoint: hydrated.authorizationEndpoint,
    tokenEndpoint: hydrated.tokenEndpoint,
    userinfoEndpoint: hydrated.userinfoEndpoint ?? null,
    jwksUri: hydrated.jwksUri ?? null,
    clientId: hydrated.clientId,
    defaultScopes: normalizeStringArray(hydrated.defaultScopes),
    enabled: hydrated.enabled,
    allowLogin: hydrated.allowLogin,
    autoRegister: hydrated.autoRegister,
    autoLinkByEmail: hydrated.autoLinkByEmail,
    usePkce: hydrated.usePkce,
    clientAuthMethod: hydrated.clientAuthMethod,
    claimMapping: (hydrated.claimMapping ?? defaultOAuthClaimMapping) as unknown as Prisma.InputJsonValue,
  };

  if (payload.clientSecret) {
    nextInput.clientSecretEncrypted = encryptOAuthSecret(payload.clientSecret);
  } else if (!current?.clientSecretEncrypted) {
    throw badRequest('OAuth Provider client secret 不能为空');
  }

  return nextInput;
};

const buildOAuthApplicationInput = async (
  payload: OAuthApplicationFormPayload,
  current?: { clientSecretHash?: string | null; salt?: string | null },
): Promise<Prisma.OAuthApplicationCreateInput | Prisma.OAuthApplicationUpdateInput> => {
  const redirectUris = normalizeStringArray(payload.redirectUris);
  if (!redirectUris.length) {
    throw badRequest('至少需要一个 redirect uri');
  }

  const permissionIds = normalizeStringArray(payload.permissionIds);

  const nextInput: Prisma.OAuthApplicationCreateInput | Prisma.OAuthApplicationUpdateInput = {
    code: payload.code,
    name: payload.name,
    description: payload.description ?? null,
    logoUrl: payload.logoUrl ?? null,
    homepageUrl: payload.homepageUrl ?? null,
    clientId: payload.clientId,
    clientType: payload.clientType as OAuthApplicationClientType,
    redirectUris,
    postLogoutRedirectUris: normalizeStringArray(payload.postLogoutRedirectUris),
    defaultScopes: normalizeStringArray(payload.defaultScopes),
    enabled: payload.enabled,
    skipConsent: payload.skipConsent,
    requirePkce: payload.requirePkce,
    allowAuthorizationCode: payload.allowAuthorizationCode,
    allowRefreshToken: payload.allowRefreshToken,
    permissions: {
      create: permissionIds.map(permissionId =>
        withSnowflakeId({
          permission: {
            connect: { id: permissionId },
          },
        })),
    },
  };

  if (payload.clientType === 'CONFIDENTIAL') {
    if (payload.clientSecret) {
      const secret = await hashSecret(payload.clientSecret);
      nextInput.clientSecretHash = secret.hash;
      nextInput.salt = secret.salt;
    } else if (!current?.clientSecretHash || !current?.salt) {
      throw badRequest('Confidential application 必须配置 client secret');
    }
  } else {
    nextInput.clientSecretHash = null;
    nextInput.salt = null;
  }

  return nextInput;
};

export const listOAuthProviders = async (query: { q?: string; enabled?: string }) => {
  const q = query.q?.trim();
  const enabled = query.enabled?.trim();
  const where: Prisma.OAuthProviderWhereInput = {};

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (enabled === 'enabled') {
    where.enabled = true;
  }
  if (enabled === 'disabled') {
    where.enabled = false;
  }

  const rows = await prisma.oAuthProvider.findMany({
    where,
    orderBy: [{ allowLogin: 'desc' }, { updatedAt: 'desc' }],
    select: oauthProviderInclude,
  });

  return rows.map(toOAuthProviderRecord);
};

export const getOAuthProviderById = async (id: string) => {
  const provider = await prisma.oAuthProvider.findUnique({
    where: { id },
    select: oauthProviderInclude,
  });

  if (!provider) {
    throw notFound('OAuth provider not found');
  }

  return toOAuthProviderRecord(provider);
};

export const createOAuthProvider = async (payload: OAuthProviderFormPayload) => {
  const provider = await prisma.oAuthProvider.create({
    data: withSnowflakeId(
      await buildOAuthProviderCreateInput(payload) as Prisma.OAuthProviderCreateInput,
    ),
    select: oauthProviderInclude,
  });

  return toOAuthProviderRecord(provider);
};

export const updateOAuthProvider = async (id: string, payload: OAuthProviderFormPayload) => {
  const current = await prisma.oAuthProvider.findUnique({
    where: { id },
    select: { id: true, clientSecretEncrypted: true },
  });

  if (!current) {
    throw notFound('OAuth provider not found');
  }

  const provider = await prisma.oAuthProvider.update({
    where: { id },
    data: await buildOAuthProviderCreateInput(payload, current),
    select: oauthProviderInclude,
  });

  return toOAuthProviderRecord(provider);
};

export const removeOAuthProvider = async (id: string) => {
  const provider = await prisma.oAuthProvider.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!provider) {
    throw notFound('OAuth provider not found');
  }

  await prisma.oAuthProvider.delete({ where: { id } });
  return { ok: true };
};

export const listEnabledOAuthLoginProviders = async (): Promise<OAuthProviderPublicSummary[]> => {
  const providers = await prisma.oAuthProvider.findMany({
    where: {
      enabled: true,
      allowLogin: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      logoUrl: true,
    },
  });

  return providers.map(toOAuthProviderPublicSummary);
};

export const getEnabledOAuthProviderByCode = async (code: string) => {
  const provider = await prisma.oAuthProvider.findUnique({
    where: { code },
  });

  if (!provider || !provider.enabled || !provider.allowLogin) {
    throw notFound('OAuth provider not found');
  }

  return provider;
};

export const listOAuthApplications = async (query: { q?: string; enabled?: string }) => {
  const q = query.q?.trim();
  const enabled = query.enabled?.trim();
  const where: Prisma.OAuthApplicationWhereInput = {};

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { clientId: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (enabled === 'enabled') {
    where.enabled = true;
  }
  if (enabled === 'disabled') {
    where.enabled = false;
  }

  const rows = await prisma.oAuthApplication.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
    include: oauthApplicationInclude,
  });

  return rows.map(toOAuthApplicationRecord);
};

export const getOAuthApplicationById = async (id: string) => {
  const application = await prisma.oAuthApplication.findUnique({
    where: { id },
    include: oauthApplicationInclude,
  });

  if (!application) {
    throw notFound('OAuth application not found');
  }

  return toOAuthApplicationRecord(application);
};

export const createOAuthApplication = async (payload: OAuthApplicationFormPayload) => {
  const application = await prisma.oAuthApplication.create({
    data: withSnowflakeId(
      await buildOAuthApplicationInput(payload) as Prisma.OAuthApplicationCreateInput,
    ),
    include: oauthApplicationInclude,
  });

  return toOAuthApplicationRecord(application);
};

export const updateOAuthApplication = async (id: string, payload: OAuthApplicationFormPayload) => {
  const current = await prisma.oAuthApplication.findUnique({
    where: { id },
    select: { id: true, clientSecretHash: true, salt: true },
  });

  if (!current) {
    throw notFound('OAuth application not found');
  }

  await prisma.oAuthApplicationPermission.deleteMany({
    where: { applicationId: id },
  });

  const application = await prisma.oAuthApplication.update({
    where: { id },
    data: await buildOAuthApplicationInput(payload, current),
    include: oauthApplicationInclude,
  });

  return toOAuthApplicationRecord(application);
};

export const removeOAuthApplication = async (id: string) => {
  const application = await prisma.oAuthApplication.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!application) {
    throw notFound('OAuth application not found');
  }

  await prisma.oAuthApplication.delete({ where: { id } });
  return { ok: true };
};

export const resolveOAuthApplicationByClientId = async (clientId: string) => {
  const application = await prisma.oAuthApplication.findUnique({
    where: { clientId },
    include: oauthApplicationInclude,
  });

  if (!application || !application.enabled) {
    throw unauthorized('Invalid oauth client');
  }

  return application;
};

export const authenticateOAuthApplication = async (input: {
  clientId: string;
  clientSecret?: string | null;
}) => {
  const application = await resolveOAuthApplicationByClientId(input.clientId);

  if (application.clientType === 'PUBLIC') {
    return application;
  }

  if (!input.clientSecret || !application.clientSecretHash || !application.salt) {
    throw unauthorized('Invalid oauth client credentials');
  }

  const matched = await compareSecret(input.clientSecret, application.clientSecretHash, application.salt);
  if (!matched) {
    throw unauthorized('Invalid oauth client credentials');
  }

  return application;
};

export const resolveDefaultWebAuthClient = async () => {
  const client = await prisma.authClient.findFirst({
    where: {
      code: 'web-console',
      type: AuthClientType.WEB,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      type: true,
      enabled: true,
      config: true,
    },
  });

  if (!client || !client.enabled) {
    throw notFound('Web auth client not found');
  }

  return client;
};
