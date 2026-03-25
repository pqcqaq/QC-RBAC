import { Prisma } from './prisma-generated';
import {
  BackendRuntimeContext,
  getBackendRuntimeContext,
  runWithBackendRuntimeContext,
} from './backend-runtime-context';
import {
  createManagedPrismaClient,
  createRawPrismaClient,
  getRootPrismaClient,
  getRootPrismaRawClient,
  getRootPrismaRawContextClient,
} from './prisma';

const defaultTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
};

const flushPostCommitTasks = async (context: BackendRuntimeContext) => {
  const tasks = context.drainPostCommitTasks();
  for (const task of tasks) {
    try {
      await task();
    } catch (error) {
      console.error('[backend] post-commit task failed', error);
    }
  }
};

const resolveBaseRuntimeContext = () => {
  const current = getBackendRuntimeContext();
  if (current) {
    return current;
  }

  return new BackendRuntimeContext({
    actorId: null,
    db: getRootPrismaClient(),
    dbRaw: getRootPrismaRawContextClient(),
    dbRawDriver: getRootPrismaRawClient(),
    requestId: 'runtime-without-request',
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
  const result = await getRootPrismaRawClient().$transaction(async (tx) => {
    const transactionContext = baseContext.fork({
      db: createManagedPrismaClient(tx),
      dbRaw: createRawPrismaClient(tx),
      dbRawDriver: tx,
      inTransaction: true,
    });

    return runWithBackendRuntimeContext(transactionContext, () => callback(transactionContext));
  }, defaultTransactionOptions);

  await flushPostCommitTasks(baseContext);
  return result;
};
