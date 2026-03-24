import type { RequestHandler } from 'express';
import { getBackendRuntimeContext } from '../lib/backend-runtime-context';
import { runWithRequestContext } from '../utils/request-context';
import { flushRequestAuditRecord } from '../services/request-audit';
import { generateSnowflakeId } from '../utils/snowflake';

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(requestIdHeader)
    ? requestIdHeader[0]
    : requestIdHeader)?.trim() || generateSnowflakeId();
  const startedAt = new Date();
  res.setHeader('x-request-id', requestId);

  runWithRequestContext({
    actorId: null,
    request: req,
    requestId,
    response: res,
    startedAt,
  }, () => {
    const context = getBackendRuntimeContext();
    let flushed = false;
    const flushAudit = () => {
      if (flushed) {
        return;
      }

      flushed = true;
      if (!context) {
        return;
      }

      setImmediate(() => {
        void flushRequestAuditRecord(context);
      });
    };

    req.on('close', () => undefined);
    res.once('finish', flushAudit);
    res.once('close', () => {
      if (!res.writableFinished) {
        flushAudit();
      }
    });
    next();
  });
};
