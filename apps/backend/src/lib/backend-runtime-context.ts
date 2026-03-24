import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response } from 'express';
import type { Prisma, PrismaClient } from './prisma-generated';
import type {
  RuntimeOperationCapture,
  RuntimeRequestFailure,
} from './request-audit';

export type BackendRuntimeRawDbClient = PrismaClient | Prisma.TransactionClient;

type BackendRuntimeAuditState = {
  actorId: string | null;
  requestId: string;
  startedAt: Date;
  failure: RuntimeRequestFailure | null;
  operations: RuntimeOperationCapture[];
  auditFlushInProgress: boolean;
  auditFlushed: boolean;
};

type BackendRuntimeContextInput = {
  actorId?: string | null;
  db: PrismaClient;
  dbRaw: BackendRuntimeRawDbClient;
  dbRawDriver: BackendRuntimeRawDbClient;
  requestId: string;
  startedAt?: Date;
  inTransaction?: boolean;
  request?: Request | null;
  response?: Response | null;
  auditState?: BackendRuntimeAuditState;
};

export class BackendRuntimeContext {
  readonly db: PrismaClient;
  readonly dbRaw: BackendRuntimeRawDbClient;
  readonly dbRawDriver: BackendRuntimeRawDbClient;
  readonly inTransaction: boolean;
  readonly request: Request | null;
  readonly response: Response | null;
  readonly requestId: string;
  private readonly auditState: BackendRuntimeAuditState;

  constructor(input: BackendRuntimeContextInput) {
    this.db = input.db;
    this.dbRaw = input.dbRaw;
    this.dbRawDriver = input.dbRawDriver;
    this.inTransaction = input.inTransaction ?? false;
    this.request = input.request ?? null;
    this.response = input.response ?? null;
    this.requestId = input.requestId;
    this.auditState = input.auditState ?? {
      actorId: input.actorId ?? null,
      requestId: input.requestId,
      startedAt: input.startedAt ?? new Date(),
      failure: null,
      operations: [],
      auditFlushInProgress: false,
      auditFlushed: false,
    };

    if (input.auditState && Object.prototype.hasOwnProperty.call(input, 'actorId')) {
      this.auditState.actorId = input.actorId ?? null;
    }
  }

  getActorId() {
    return this.auditState.actorId;
  }

  setActorId(actorId: string | null) {
    this.auditState.actorId = actorId;
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

  getRequestStartedAt() {
    return this.auditState.startedAt;
  }

  getRequestFailure() {
    return this.auditState.failure;
  }

  setRequestFailure(failure: RuntimeRequestFailure | null) {
    this.auditState.failure = failure;
  }

  addOperation(operation: RuntimeOperationCapture) {
    this.auditState.operations.push(operation);
  }

  getOperations() {
    return [...this.auditState.operations];
  }

  beginAuditFlush() {
    if (this.auditState.auditFlushInProgress || this.auditState.auditFlushed) {
      return false;
    }

    this.auditState.auditFlushInProgress = true;
    return true;
  }

  completeAuditFlush() {
    this.auditState.auditFlushInProgress = false;
    this.auditState.auditFlushed = true;
  }

  failAuditFlush() {
    this.auditState.auditFlushInProgress = false;
  }

  fork(overrides: Partial<BackendRuntimeContextInput>) {
    return new BackendRuntimeContext({
      actorId: Object.prototype.hasOwnProperty.call(overrides, 'actorId')
        ? overrides.actorId ?? null
        : this.auditState.actorId,
      db: overrides.db ?? this.db,
      dbRaw: overrides.dbRaw ?? this.dbRaw,
      dbRawDriver: overrides.dbRawDriver ?? this.dbRawDriver,
      requestId: overrides.requestId ?? this.requestId,
      startedAt: overrides.startedAt ?? this.auditState.startedAt,
      inTransaction: overrides.inTransaction ?? this.inTransaction,
      request: Object.prototype.hasOwnProperty.call(overrides, 'request')
        ? overrides.request ?? null
        : this.request,
      response: Object.prototype.hasOwnProperty.call(overrides, 'response')
        ? overrides.response ?? null
        : this.response,
      auditState: overrides.auditState ?? this.auditState,
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
