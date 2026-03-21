import type { RequestHandler } from 'express';
import { buildCurrentUser } from '../utils/rbac.js';
import { HttpError, unauthorized } from '../utils/errors.js';
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
    const requestClient = req.authClient;
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw unauthorized('Missing access token');
    }

    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      throw unauthorized('Invalid access token');
    }
    if (requestClient && payload.clientCode !== requestClient.code) {
      throw unauthorized('Access token client mismatch');
    }

    const auth = await buildCurrentUser(payload.sub);
    if (auth.status !== 'ACTIVE') {
      throw unauthorized('Account disabled');
    }

    req.auth = auth;
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(unauthorized('Invalid or expired token'));
      return;
    }

    next(error);
  }
};
