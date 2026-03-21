import jwt from 'jsonwebtoken';
import { addSeconds } from './time.js';
import { env } from '../config/env.js';

type AccessPayload = {
  sub: string;
  clientCode: string;
  type: 'access';
};

type RefreshPayload = {
  sub: string;
  jti: string;
  clientCode: string;
  type: 'refresh';
};

const parseExpiryToSeconds = (value: string) => {
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

export const signAccessToken = (userId: string, clientCode: string) =>
  jwt.sign({ sub: userId, clientCode, type: 'access' } satisfies AccessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: accessTokenTtlSeconds,
  });

export const signRefreshToken = (userId: string, jti: string, clientCode: string) => {
  const token = jwt.sign(
    { sub: userId, jti, clientCode, type: 'refresh' } satisfies RefreshPayload,
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

