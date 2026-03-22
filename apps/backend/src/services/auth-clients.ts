import {
  AUTH_CLIENT_APP_ID_HEADER,
  AUTH_CLIENT_CODE_HEADER,
  AUTH_CLIENT_PACKAGE_NAME_HEADER,
  AUTH_CLIENT_PLATFORM_HEADER,
  AUTH_CLIENT_SECRET_HEADER,
  AuthClientType,
  isSameAuthClientIdentity,
  type AuthClientIdentity,
  type AuthClientSummary,
} from '@rbac/api-common';
import type { IncomingHttpHeaders } from 'node:http';
import {
  buildAuthClientSummary,
  getAuthClientDefinition,
  getAuthClientDefinitionByIdentity,
  type BackendAuthClientDefinition,
} from '../config/auth-clients.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../utils/errors.js';
import { compareSecret } from '../utils/password.js';

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

const parseOriginUrl = (headers: IncomingHttpHeaders) => {
  const origin = readSingleHeader(headers.origin);
  const referer = readSingleHeader(headers.referer);
  const source = origin || referer;

  if (!source) {
    return null;
  }

  try {
    return new URL(source);
  } catch {
    throw unauthorized('Invalid client origin');
  }
};

const validateWebClient = (
  headers: IncomingHttpHeaders,
  client: Extract<BackendAuthClientDefinition, { type: AuthClientType.WEB }>,
) => {
  const url = parseOriginUrl(headers);
  if (!url) {
    throw unauthorized('Missing client origin');
  }

  const actualProtocol = normalizeProtocol(url.protocol);
  const expectedProtocol = normalizeProtocol(client.config.protocol);
  const actualPort = normalizePort(actualProtocol, url.port);
  const expectedPort = normalizePort(expectedProtocol, client.config.port);

  if (
    actualProtocol !== expectedProtocol
    || url.hostname.toLowerCase() !== client.config.host.toLowerCase()
    || actualPort !== expectedPort
  ) {
    throw unauthorized('Invalid client origin');
  }
};

const validateMiniappClient = (
  headers: IncomingHttpHeaders,
  client: Extract<BackendAuthClientDefinition, { type: AuthClientType.UNI_WECHAT_MINIAPP }>,
) => {
  const appId = readSingleHeader(headers[AUTH_CLIENT_APP_ID_HEADER.toLowerCase()]);
  if (!appId || appId !== client.config.appId) {
    throw unauthorized('Invalid miniapp client appId');
  }
};

const validateAppClient = (
  headers: IncomingHttpHeaders,
  client: Extract<BackendAuthClientDefinition, { type: AuthClientType.APP }>,
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

const validateClientRequestContext = (headers: IncomingHttpHeaders, client: BackendAuthClientDefinition) => {
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

const toAuthClientIdentity = (client: { id: string; code: string; type: string }): AuthClientIdentity => ({
  id: client.id,
  code: client.code,
  type: client.type as AuthClientType,
});

const loadPersistedAuthClientByCode = async (code: string) => {
  const client = await prisma.authClient.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      description: true,
      enabled: true,
      secretHash: true,
      salt: true,
    },
  });

  if (!client || !client.enabled) {
    throw unauthorized('Invalid client credentials');
  }

  return client;
};

const loadPersistedAuthClientByIdentity = async (identity: AuthClientIdentity) => {
  const client = await prisma.authClient.findUnique({
    where: { id: identity.id },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      description: true,
      enabled: true,
    },
  });

  if (!client || !client.enabled) {
    throw unauthorized('Invalid client identity');
  }

  const persistedIdentity = toAuthClientIdentity(client);
  if (!isSameAuthClientIdentity(persistedIdentity, identity)) {
    throw unauthorized('Client identity mismatch');
  }

  return client;
};

const mergeClientSummary = (
  client: {
    id: string;
    code: string;
    name: string;
    type: string;
    description?: string | null;
  },
  definition: BackendAuthClientDefinition,
): AuthClientSummary => buildAuthClientSummary({
  id: client.id,
  code: client.code,
  name: client.name,
  type: client.type as AuthClientType,
  ...(client.description === undefined ? {} : { description: client.description }),
  config: definition.config,
});

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
  const [client, definition] = await Promise.all([
    loadPersistedAuthClientByCode(input.code),
    Promise.resolve(getAuthClientDefinition(input.code)),
  ]);

  if (!definition) {
    throw unauthorized('Unknown client');
  }

  if ((client.type as AuthClientType) !== definition.type) {
    throw unauthorized('Client type mismatch');
  }

  const matched = await compareSecret(input.secret, client.secretHash, client.salt);
  if (!matched) {
    throw unauthorized('Invalid client credentials');
  }

  validateClientRequestContext(input.headers, definition);
  return mergeClientSummary(client, definition);
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
  const [client, definition] = await Promise.all([
    loadPersistedAuthClientByIdentity(identity),
    Promise.resolve(getAuthClientDefinitionByIdentity(identity)),
  ]);

  if (!definition) {
    throw unauthorized('Unknown client');
  }

  return {
    client: mergeClientSummary(client, definition),
    definition,
  };
};

export const resolveAuthClientSummary = async (identity: AuthClientIdentity) =>
  (await resolveAuthClientContext(identity)).client;
