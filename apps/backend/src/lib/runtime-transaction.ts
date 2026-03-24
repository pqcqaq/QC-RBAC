import { Prisma } from './prisma-generated';
import {
  BackendRuntimeContext,
  getBackendRuntimeContext,
  runWithBackendRuntimeContext,
} from './backend-runtime-context';
import {
  createManagedPrismaClient,
  getRootPrismaClient,
  getRootPrismaRawClient,
} from './prisma';

const defaultTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
};

const resolveBaseRuntimeContext = () => {
  const current = getBackendRuntimeContext();
  if (current) {
    return current;
  }

  return new BackendRuntimeContext({
    actorId: null,
    db: getRootPrismaClient(),
    dbRaw: getRootPrismaRawClient(),
    inTransaction: false,
    request: null,
    response: null,
  });
};

export const runInBackendRuntimeTransaction = async <T>(
  callback: (context: BackendRuntimeContext) => Promise<T>,
) => {
  const current = getBackendRuntimeContext();
  if (current?.inTransaction) {
    return callback(current);
  }

  const baseContext = resolveBaseRuntimeContext();

  return getRootPrismaRawClient().$transaction(async (tx) => {
    const transactionContext = baseContext.fork({
      db: createManagedPrismaClient(tx),
      dbRaw: tx,
      inTransaction: true,
    });

    return runWithBackendRuntimeContext(transactionContext, () => callback(transactionContext));
  }, defaultTransactionOptions);
};
