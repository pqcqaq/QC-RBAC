import {
  AUTH_CLIENT_APP_ID_HEADER,
  AUTH_CLIENT_CODE_HEADER,
  AUTH_CLIENT_PACKAGE_NAME_HEADER,
  AUTH_CLIENT_PLATFORM_HEADER,
  AUTH_CLIENT_SECRET_HEADER,
  AuthClientType,
  type AppAuthClientConfig,
  isSameAuthClientIdentity,
  type ManagedWechatMiniappAuthClientConfig,
  type AuthClientIdentity,
  type AuthClientSummary,
  type WebAuthClientConfig,
} from '@rbac/api-common';
import type { Prisma } from '@prisma/client';
import type { IncomingHttpHeaders } from 'node:http';
import {
  buildAuthClientSummary,
  parseAuthClientConfig,
} from '../config/auth-clients';
import { clientOrigins } from '../config/env';
import { prisma } from '../lib/prisma';
import { unauthorized } from '../utils/errors';
import { compareSecret } from '../utils/password';

type PersistedAuthClientBase = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  secretHash?: string;
  salt?: string;
};

type PersistedAuthClient =
  | (PersistedAuthClientBase & {
      type: AuthClientType.WEB;
      config: WebAuthClientConfig;
    })
  | (PersistedAuthClientBase & {
      type: AuthClientType.UNI_WECHAT_MINIAPP;
      config: ManagedWechatMiniappAuthClientConfig;
    })
  | (PersistedAuthClientBase & {
      type: AuthClientType.APP;
      config: AppAuthClientConfig;
    });

const authClientSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  type: true,
  enabled: true,
  config: true,
  secretHash: true,
  salt: true,
} satisfies Prisma.AuthClientSelect;

const authClientIdentitySelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  type: true,
  enabled: true,
  config: true,
} satisfies Prisma.AuthClientSelect;

const readSingleHeader = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
};

const normalizeProtocol = (value: string) => value.replace(/:$/, '').toLowerCase();

const normalizePort = (protocol: string, port?: string | number | null) => {
  if (port !== undefined && port !== null && String(port).trim()) {
    return String(port);
  }

  return normalizeProtocol(protocol) === 'https' ? '443' : '80';
};

const readForwardedValue = (value?: string | string[]) => {
  const normalized = readSingleHeader(value);
  return normalized.split(',')[0]?.trim() ?? '';
};

const parseOriginUrl = (headers: IncomingHttpHeaders) => {
  const origin = readSingleHeader(headers.origin);
  const referer = readSingleHeader(headers.referer);
  const forwardedProto = readForwardedValue(headers['x-forwarded-proto']);
  const forwardedHost = readForwardedValue(headers['x-forwarded-host']);
  const host = readSingleHeader(headers.host);
  const source = origin || referer || ((forwardedProto || host) ? `${forwardedProto || 'http'}://${forwardedHost || host}` : '');

  if (!source) {
    return null;
  }

  try {
    return new URL(source);
  } catch {
    throw unauthorized('Invalid client origin');
  }
};

const matchesWebOrigin = (url: URL, config: WebAuthClientConfig) => {
  const actualProtocol = normalizeProtocol(url.protocol);
  const expectedProtocol = normalizeProtocol(config.protocol);
  const actualPort = normalizePort(actualProtocol, url.port);
  const expectedPort = normalizePort(expectedProtocol, config.port);

  return (
    actualProtocol === expectedProtocol
    && url.hostname.toLowerCase() === config.host.toLowerCase()
    && actualPort === expectedPort
  );
};

const isAllowedWebOrigin = (url: URL) =>
  clientOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return matchesWebOrigin(url, {
        protocol: normalizeProtocol(parsed.protocol) === 'https' ? 'https' : 'http',
        host: parsed.hostname,
        ...(parsed.port ? { port: Number(parsed.port) } : {}),
      });
    } catch {
      return false;
    }
  });

const parsePersistedAuthClient = <
  TClient extends {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    type: string;
    enabled: boolean;
    config: Prisma.JsonValue;
    secretHash?: string;
    salt?: string;
  },
>(client: TClient): PersistedAuthClient => {
  const base = {
    id: client.id,
    code: client.code,
    name: client.name,
    description: client.description ?? null,
    enabled: client.enabled,
    ...(client.secretHash ? { secretHash: client.secretHash } : {}),
    ...(client.salt ? { salt: client.salt } : {}),
  };

  if (client.type === AuthClientType.WEB) {
    return {
      ...base,
      type: AuthClientType.WEB,
      config: parseAuthClientConfig(AuthClientType.WEB, client.config) as WebAuthClientConfig,
    };
  }

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return {
      ...base,
      type: AuthClientType.UNI_WECHAT_MINIAPP,
      config: parseAuthClientConfig(
        AuthClientType.UNI_WECHAT_MINIAPP,
        client.config,
      ) as ManagedWechatMiniappAuthClientConfig,
    };
  }

  return {
    ...base,
    type: AuthClientType.APP,
    config: parseAuthClientConfig(AuthClientType.APP, client.config) as AppAuthClientConfig,
  };
};

const validateWebClient = (
  headers: IncomingHttpHeaders,
  client: PersistedAuthClient & { type: AuthClientType.WEB },
) => {
  const url = parseOriginUrl(headers);
  if (!url) {
    throw unauthorized('Missing client origin');
  }

  if (!matchesWebOrigin(url, client.config) && !isAllowedWebOrigin(url)) {
    throw unauthorized('Invalid client origin');
  }
};

const validateMiniappClient = (
  headers: IncomingHttpHeaders,
  client: PersistedAuthClient & { type: AuthClientType.UNI_WECHAT_MINIAPP },
) => {
  const appId = readSingleHeader(headers[AUTH_CLIENT_APP_ID_HEADER.toLowerCase()]);
  if (!appId || appId !== client.config.appId) {
    throw unauthorized('Invalid miniapp client appId');
  }
};

const validateAppClient = (
  headers: IncomingHttpHeaders,
  client: PersistedAuthClient & { type: AuthClientType.APP },
) => {
  const packageName = readSingleHeader(headers[AUTH_CLIENT_PACKAGE_NAME_HEADER.toLowerCase()]);
  if (!packageName || packageName !== client.config.packageName) {
    throw unauthorized('Invalid app client package name');
  }

  const expectedPlatform = client.config.platform?.trim();
  if (!expectedPlatform) {
    return;
  }

  const actualPlatform = readSingleHeader(headers[AUTH_CLIENT_PLATFORM_HEADER.toLowerCase()]);
  if (!actualPlatform || actualPlatform !== expectedPlatform) {
    throw unauthorized('Invalid app client platform');
  }
};

const validateClientRequestContext = (headers: IncomingHttpHeaders, client: PersistedAuthClient) => {
  if (client.type === AuthClientType.WEB) {
    validateWebClient(headers, client);
    return;
  }

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    validateMiniappClient(headers, client);
    return;
  }

  validateAppClient(headers, client);
};

const toAuthClientIdentity = (client: { id: string; code: string; type: AuthClientType }): AuthClientIdentity => ({
  id: client.id,
  code: client.code,
  type: client.type,
});

const toAuthClientSummary = (client: PersistedAuthClient): AuthClientSummary => buildAuthClientSummary({
  id: client.id,
  code: client.code,
  name: client.name,
  type: client.type,
  ...(client.description === undefined ? {} : { description: client.description }),
  config: client.config,
});

const toWebClientOrigin = (config: WebAuthClientConfig) => {
  const port = config.port ? `:${config.port}` : '';
  return `${config.protocol}://${config.host}${port}`;
};

const loadPersistedAuthClientByCode = async (code: string) => {
  const client = await prisma.authClient.findUnique({
    where: { code },
    select: authClientSelect,
  });

  if (!client || !client.enabled) {
    throw unauthorized('Invalid client credentials');
  }

  return parsePersistedAuthClient(client);
};

const loadPersistedAuthClientByIdentity = async (identity: AuthClientIdentity) => {
  const client = await prisma.authClient.findUnique({
    where: { id: identity.id },
    select: authClientIdentitySelect,
  });

  if (!client || !client.enabled) {
    throw unauthorized('Invalid client identity');
  }

  const parsed = parsePersistedAuthClient(client);
  const persistedIdentity = toAuthClientIdentity(parsed);
  if (!isSameAuthClientIdentity(persistedIdentity, identity)) {
    throw unauthorized('Client identity mismatch');
  }

  return parsed;
};

export const readOptionalAuthClientCredentials = (headers: IncomingHttpHeaders) => {
  const code = readSingleHeader(headers[AUTH_CLIENT_CODE_HEADER.toLowerCase()]);
  const secret = readSingleHeader(headers[AUTH_CLIENT_SECRET_HEADER.toLowerCase()]);

  if (!code && !secret) {
    return null;
  }

  if (!code || !secret) {
    throw unauthorized('Incomplete client credentials');
  }

  return { code, secret };
};

export const readAuthClientCredentials = (headers: IncomingHttpHeaders) => {
  const credentials = readOptionalAuthClientCredentials(headers);
  if (!credentials) {
    throw unauthorized('Missing client credentials');
  }

  return credentials;
};

export const authenticateAuthClient = async (input: {
  code: string;
  secret: string;
  headers: IncomingHttpHeaders;
}): Promise<AuthClientSummary> => {
  const client = await loadPersistedAuthClientByCode(input.code);

  if (!client.secretHash || !client.salt) {
    throw unauthorized('Invalid client credentials');
  }

  const matched = await compareSecret(input.secret, client.secretHash, client.salt);
  if (!matched) {
    throw unauthorized('Invalid client credentials');
  }

  validateClientRequestContext(input.headers, client);
  return toAuthClientSummary(client);
};

export const authenticateHeadersClient = async (headers: IncomingHttpHeaders) =>
  authenticateAuthClient({
    ...readAuthClientCredentials(headers),
    headers,
  });

export const authenticateOptionalHeadersClient = async (headers: IncomingHttpHeaders) => {
  const credentials = readOptionalAuthClientCredentials(headers);
  if (!credentials) {
    return null;
  }

  return authenticateAuthClient({
    ...credentials,
    headers,
  });
};

export const resolveAuthClientContext = async (identity: AuthClientIdentity) => {
  const client = await loadPersistedAuthClientByIdentity(identity);

  return {
    client: toAuthClientSummary(client),
    definition: client,
  };
};

export const resolveAuthClientSummary = async (identity: AuthClientIdentity) =>
  (await resolveAuthClientContext(identity)).client;

export const resolveAuthClientSummaryByCode = async (code: string) =>
  toAuthClientSummary(await loadPersistedAuthClientByCode(code));

export const resolveWebAuthClientOrigin = async (code: string) => {
  const client = await loadPersistedAuthClientByCode(code);
  if (client.type !== AuthClientType.WEB) {
    throw unauthorized('Client is not a web client');
  }

  return toWebClientOrigin(client.config);
};
