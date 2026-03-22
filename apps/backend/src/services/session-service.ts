import type { AuthClientSummary } from '@rbac/api-common';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { cacheDel, cacheSet } from '../lib/redis.js';
import { withSnowflakeId } from '../utils/persistence.js';
import { buildCurrentUser } from '../utils/rbac.js';
import {
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token.js';

export const issueUserSession = async (userId: string, client: AuthClientSummary) => {
  const jti = randomUUID();
  const tokenClient = {
    id: client.id,
    code: client.code,
    type: client.type,
  };
  const accessToken = signAccessToken(userId, tokenClient);
  const refresh = signRefreshToken(userId, jti, tokenClient);

  await prisma.refreshToken.create({
    data: withSnowflakeId({
      token: refresh.token,
      userId,
      clientId: client.id,
      expiresAt: refresh.expiresAt,
    }),
  });
  await cacheSet(`refresh:${jti}`, userId, refreshTokenTtlSeconds);

  return {
    tokens: {
      accessToken,
      refreshToken: refresh.token,
    },
    user: await buildCurrentUser(userId),
    client,
  };
};

export const revokeUserRefreshToken = async (refreshToken: string) => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    await cacheDel(`refresh:${payload.jti}`);
  } catch {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
};
