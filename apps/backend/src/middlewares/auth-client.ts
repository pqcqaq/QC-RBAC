import type { RequestHandler } from 'express';
import { authenticateHeadersClient } from '../services/auth-clients.js';
import { HttpError, unauthorized } from '../utils/errors.js';

export const authClientMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    req.authClient = await authenticateHeadersClient(req.headers);
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(error);
      next(unauthorized('Invalid client credentials'));
      return;
    }

    next(error);
  }
};
