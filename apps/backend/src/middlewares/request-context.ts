import type { RequestHandler } from 'express';
import { runWithRequestContext } from '../utils/request-context';

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  runWithRequestContext({ actorId: null }, () => {
    req.on('close', () => undefined);
    res.on('close', () => undefined);
    next();
  });
};
