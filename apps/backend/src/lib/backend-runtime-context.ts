import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response } from 'express';
import type { Prisma, PrismaClient } from './prisma-generated';

export type BackendRuntimeRawDbClient = PrismaClient | Prisma.TransactionClient;

type BackendRuntimeContextInput = {
  actorId?: string | null;
  db: PrismaClient;
  dbRaw: BackendRuntimeRawDbClient;
  inTransaction?: boolean;
  request?: Request | null;
  response?: Response | null;
};

export class BackendRuntimeContext {
  readonly db: PrismaClient;
  readonly dbRaw: BackendRuntimeRawDbClient;
  readonly inTransaction: boolean;
  readonly request: Request | null;
  readonly response: Response | null;
  private actorId: string | null;

  constructor(input: BackendRuntimeContextInput) {
    this.actorId = input.actorId ?? null;
    this.db = input.db;
    this.dbRaw = input.dbRaw;
    this.inTransaction = input.inTransaction ?? false;
    this.request = input.request ?? null;
    this.response = input.response ?? null;
  }

  getActorId() {
    return this.actorId;
  }

  setActorId(actorId: string | null) {
    this.actorId = actorId;
  }

  getAuth() {
    return this.request?.auth ?? null;
  }

  getAuthClient() {
    return this.request?.authClient ?? null;
  }

  getAuthMode() {
    return this.request?.authMode ?? null;
  }

  getOAuthApplication() {
    return this.request?.oauthApplication ?? null;
  }

  fork(overrides: Partial<BackendRuntimeContextInput>) {
    return new BackendRuntimeContext({
      actorId: Object.prototype.hasOwnProperty.call(overrides, 'actorId')
        ? overrides.actorId ?? null
        : this.actorId,
      db: overrides.db ?? this.db,
      dbRaw: overrides.dbRaw ?? this.dbRaw,
      inTransaction: overrides.inTransaction ?? this.inTransaction,
      request: Object.prototype.hasOwnProperty.call(overrides, 'request')
        ? overrides.request ?? null
        : this.request,
      response: Object.prototype.hasOwnProperty.call(overrides, 'response')
        ? overrides.response ?? null
        : this.response,
    });
  }
}

const backendRuntimeStorage = new AsyncLocalStorage<BackendRuntimeContext>();

export const runWithBackendRuntimeContext = <T>(
  context: BackendRuntimeContext,
  callback: () => T,
) => backendRuntimeStorage.run(context, callback);

export const getBackendRuntimeContext = () => backendRuntimeStorage.getStore() ?? null;

export const requireBackendRuntimeContext = () => {
  const context = getBackendRuntimeContext();
  if (!context) {
    throw new Error('BackendRuntimeContext is not available');
  }

  return context;
};
