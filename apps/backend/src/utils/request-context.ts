import type { Request, Response } from 'express';
import {
  BackendRuntimeContext,
  getBackendRuntimeContext,
  runWithBackendRuntimeContext,
} from '../lib/backend-runtime-context';
import {
  getRootPrismaClient,
  getRootPrismaRawClient,
  getRootPrismaRawContextClient,
} from '../lib/prisma';
import { summarizeRuntimeError } from '../lib/request-audit';
import { generateSnowflakeId } from './snowflake';

type RequestContext = {
  actorId: string | null;
  requestId?: string;
  startedAt?: Date;
  request?: Request | null;
  response?: Response | null;
};

export const runWithRequestContext = <T>(
  context: RequestContext,
  callback: () => T,
) =>
  runWithBackendRuntimeContext(
    new BackendRuntimeContext({
      actorId: context.actorId,
      db: getRootPrismaClient(),
      dbRaw: getRootPrismaRawContextClient(),
      dbRawDriver: getRootPrismaRawClient(),
      requestId: context.requestId ?? generateSnowflakeId(),
      startedAt: context.startedAt,
      inTransaction: false,
      request: context.request ?? null,
      response: context.response ?? null,
    }),
    callback,
  );

export const getRequestContext = () => getBackendRuntimeContext();

export const getRequestActorId = () => getBackendRuntimeContext()?.getActorId() ?? null;

export const setRequestActorId = (actorId: string | null) => {
  const context = getBackendRuntimeContext();
  if (context) {
    context.setActorId(actorId);
  }
};

export const getRequestId = () => getBackendRuntimeContext()?.requestId ?? null;

export const markRequestFailure = (error: unknown) => {
  const context = getBackendRuntimeContext();
  if (!context) {
    return;
  }

  context.setRequestFailure(summarizeRuntimeError(error));
};
