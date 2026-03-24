import type { Request, Response } from 'express';
import {
  BackendRuntimeContext,
  getBackendRuntimeContext,
  runWithBackendRuntimeContext,
} from '../lib/backend-runtime-context';
import { getRootPrismaClient, getRootPrismaRawClient } from '../lib/prisma';

type RequestContext = {
  actorId: string | null;
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
      dbRaw: getRootPrismaRawClient(),
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
