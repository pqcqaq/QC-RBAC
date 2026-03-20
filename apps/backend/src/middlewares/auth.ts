import type { RequestHandler } from 'express';
import { buildCurrentUser } from '../utils/rbac.js';
import { unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/token.js';

export type AuthContext = Awaited<ReturnType<typeof buildCurrentUser>>;

const extractToken = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (value.startsWith('Bearer ')) {
    return value.slice(7);
  }

  return value;
};

export const authMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw unauthorized('Missing access token');
    }

    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      throw unauthorized('Invalid access token');
    }

    const auth = await buildCurrentUser(payload.sub);
    if (auth.status !== 'ACTIVE') {
      throw unauthorized('Account disabled');
    }

    req.auth = auth;
    next();
  } catch (error) {
    next(unauthorized('Invalid or expired token'));
  }
};
