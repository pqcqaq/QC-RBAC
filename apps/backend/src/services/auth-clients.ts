import type { AuthClientSummary } from '@rbac/api-common';
import { AUTH_CLIENT_CODE_HEADER, AUTH_CLIENT_SECRET_HEADER } from '@rbac/api-common';
import type { IncomingHttpHeaders } from 'node:http';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../utils/errors.js';
import { compareSecret } from '../utils/password.js';

const readSingleHeader = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return value?.trim() ?? '';
};

const toAuthClientSummary = (client: {
  id: string;
  code: string;
  name: string;
  type: 'WEB' | 'UNI_WECHAT_MINIAPP';
}): AuthClientSummary => ({
  id: client.id,
  code: client.code,
  name: client.name,
  type: client.type,
});

export const readAuthClientCredentials = (headers: IncomingHttpHeaders) => {
  const code = readSingleHeader(headers[AUTH_CLIENT_CODE_HEADER.toLowerCase()]);
  const secret = readSingleHeader(headers[AUTH_CLIENT_SECRET_HEADER.toLowerCase()]);

  if (!code || !secret) {
    throw unauthorized('Missing client credentials');
  }

  return { code, secret };
};

export const authenticateAuthClient = async (input: { code: string; secret: string }): Promise<AuthClientSummary> => {
  const client = await prisma.authClient.findUnique({
    where: { code: input.code },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      enabled: true,
      secretHash: true,
      salt: true,
    },
  });

  if (!client || !client.enabled) {
    throw unauthorized('Invalid client credentials');
  }

  const matched = await compareSecret(input.secret, client.secretHash, client.salt);
  if (!matched) {
    throw unauthorized('Invalid client credentials');
  }

  return toAuthClientSummary(client);
};

export const authenticateHeadersClient = async (headers: IncomingHttpHeaders) => {
  return authenticateAuthClient(readAuthClientCredentials(headers));
};
