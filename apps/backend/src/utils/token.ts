import jwt from 'jsonwebtoken';
import type { AuthClientIdentity } from '@rbac/api-common';
import { addSeconds } from './time';
import { env } from '../config/env';

export type AccessPayload = {
  sub: string;
  client: AuthClientIdentity;
  type: 'access';
};

export type RefreshPayload = {
  sub: string;
  jti: string;
  client: AuthClientIdentity;
  type: 'refresh';
};

export const parseExpiryToSeconds = (value: string) => {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    return 60 * 60 * 2;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  return amount * 60 * 60 * 24;
};

export const accessTokenTtlSeconds = parseExpiryToSeconds(env.ACCESS_TOKEN_EXPIRES_IN);
export const refreshTokenTtlSeconds = parseExpiryToSeconds(env.REFRESH_TOKEN_EXPIRES_IN);

export const signAccessToken = (userId: string, client: AuthClientIdentity) =>
  jwt.sign({ sub: userId, client, type: 'access' } satisfies AccessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: accessTokenTtlSeconds,
  });

export const signRefreshToken = (userId: string, jti: string, client: AuthClientIdentity) => {
  const token = jwt.sign(
    { sub: userId, jti, client, type: 'refresh' } satisfies RefreshPayload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: refreshTokenTtlSeconds,
    },
  );

  return {
    token,
    expiresAt: addSeconds(new Date(), refreshTokenTtlSeconds),
  };
};

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;

