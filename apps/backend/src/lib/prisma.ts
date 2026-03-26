import type { Prisma } from './prisma-generated';
import { PrismaClient } from './prisma-generated';
import {
  assertNoDeleteReferenceBlocks,
  isDeleteGuardedOperation,
} from './delete-reference-checker';
import { getBackendRuntimeContext } from './backend-runtime-context';
import {
  buildReadOperationEffect,
  buildWriteOperationEffect,
  classifyOperationEffectKind,
  extractRecordIds,
  splitOperationAuditArgs,
  summarizeRuntimeError,
  toAuditJson,
  type RuntimeOperationAccessKind,
} from './request-audit';
import { createPrismaClient } from './prisma-client-factory';
import {
  buildBackendTriggerRegistry,
  getTriggersForOperation,
  resolveTriggerAction,
  resolveTriggerDeleteMode,
} from '../triggers';
import { generateSnowflakeId } from '../utils/snowflake';

const auditedModelNames = new Set([
  'User',
  'AuthClient',
  'AuthStrategy',
  'UserAuthentication',
  'VerificationCode',
  'Role',
  'Permission',
  'RealtimeTopic',
  'MenuNode',
  'UserRole',
  'RolePermission',
  'RefreshToken',
  'MediaAsset',
  'ChatMessage',
  'OAuthProvider',
  'OAuthApplication',
  'OAuthApplicationPermission',
  'OAuthState',
  'OAuthUser',
  'OAuthToken',
]);

const softDeleteModelNames = new Set(auditedModelNames);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

type PrismaDelegateArgs = Record<string, unknown>;

type PrismaModelDelegate = Record<string, (args?: PrismaDelegateArgs) => Promise<unknown>>;

type RawPrismaClient = PrismaClient | Prisma.TransactionClient;

type ManagedOperationPlan = {
  effectiveArgs: PrismaDelegateArgs;
  effectiveOperation: string;
  softDelete: boolean;
};

const managedClientCache = new WeakMap<object, PrismaClient>();
const rawClientCache = new WeakMap<object, PrismaClient>();
const managedDelegateCache = new WeakMap<object, object>();
const rawDelegateCache = new WeakMap<object, object>();

const mergeActiveWhere = (where?: unknown) => {
  if (!isPlainObject(where)) {
    return { deleteAt: null };
  }

  if (Object.prototype.hasOwnProperty.call(where, 'deleteAt')) {
    return where;
  }

  return {
    ...where,
    deleteAt: null,
  };
};

const normalizeUniqueWhere = (where?: unknown) => {
  if (!isPlainObject(where)) {
    return {};
  }

  return Object.entries(where).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === undefined) {
      return accumulator;
    }

    if (isPlainObject(value)) {
      return {
        ...accumulator,
        ...value,
      };
    }

    return {
      ...accumulator,
      [key]: value,
    };
  }, {});
};

const stampCreateData = (data: unknown, actorId: string | null) => {
  if (Array.isArray(data)) {
    return data.map(item => stampCreateData(item, actorId));
  }

  if (!isPlainObject(data)) {
    return data;
  }

  return {
    id: typeof data.id === 'string' && data.id ? data.id : generateSnowflakeId(),
    createId: typeof data.createId === 'string' ? data.createId : actorId,
    updateId: typeof data.updateId === 'string' ? data.updateId : actorId,
    deleteAt: Object.prototype.hasOwnProperty.call(data, 'deleteAt') ? data.deleteAt : null,
    ...data,
  };
};

const stampUpdateData = (data: unknown, actorId: string | null) => {
  if (Array.isArray(data)) {
    return data.map(item => stampUpdateData(item, actorId));
  }

  if (!isPlainObject(data)) {
    return data;
  }

  return {
    ...data,
    updateId: typeof data.updateId === 'string' ? data.updateId : actorId,
  };
};

const stampDeleteData = (actorId: string | null) => ({
  deleteAt: new Date(),
  updateId: actorId,
});

const isModelDelegate = (value: unknown): value is PrismaModelDelegate =>
  typeof value === 'object'
  && value !== null
  && (
    'findMany' in value
    || 'findFirst' in value
    || 'findUnique' in value
    || 'create' in value
    || 'update' in value
  );

const callDelegateOperation = (
  delegate: PrismaModelDelegate,
  operation: string,
  args?: PrismaDelegateArgs,
) => {
  const executor = delegate[operation];
  if (typeof executor !== 'function') {
    throw new Error(`Unsupported Prisma delegate operation: ${operation}`);
  }

  return executor.call(delegate, args);
};

const getModelDelegate = (client: RawPrismaClient, model: string) =>
  (client as unknown as Record<string, PrismaModelDelegate>)[lowerFirst(model)];

const resolveRuntimeActorId = () => getBackendRuntimeContext()?.getActorId() ?? null;

const rootPrismaRaw = createPrismaClient();
const backendTriggerRegistry = buildBackendTriggerRegistry(rootPrismaRaw);

const resolveRuntimeRawDriver = () => getBackendRuntimeContext()?.dbRawDriver ?? rootPrismaRaw;

const resolveRuntimeRawClient = () =>
  getBackendRuntimeContext()?.dbRaw as PrismaClient | undefined;

const resolveActiveRecordId = async (
  delegate: PrismaModelDelegate,
  where?: unknown,
) => {
  const record = await callDelegateOperation(delegate, 'findFirst', {
    where: mergeActiveWhere(normalizeUniqueWhere(where)),
    select: { id: true },
  }) as { id: string } | null;

  return record?.id ?? '__soft_delete_missing__';
};

const buildManagedOperationPlan = (
  model: string,
  operation: string,
  args?: PrismaDelegateArgs,
): ManagedOperationPlan => {
  const normalizedArgs = args ?? {};
  if (!auditedModelNames.has(model)) {
    return {
      effectiveArgs: normalizedArgs,
      effectiveOperation: operation,
      softDelete: false,
    };
  }

  const actorId = resolveRuntimeActorId();
  if (softDeleteModelNames.has(model)) {
    if (operation === 'findUnique') {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: mergeActiveWhere(normalizeUniqueWhere(normalizedArgs.where)),
        },
        effectiveOperation: 'findFirst',
        softDelete: false,
      };
    }

    if (
      operation === 'findFirst'
      || operation === 'findMany'
      || operation === 'count'
      || operation === 'aggregate'
    ) {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: mergeActiveWhere(normalizedArgs.where),
        },
        effectiveOperation: operation,
        softDelete: false,
      };
    }

    if (operation === 'update') {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: normalizedArgs.where,
          data: stampUpdateData(normalizedArgs.data, actorId),
        },
        effectiveOperation: 'update',
        softDelete: false,
      };
    }

    if (operation === 'updateMany') {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: mergeActiveWhere(normalizedArgs.where),
          data: stampUpdateData(normalizedArgs.data, actorId),
        },
        effectiveOperation: 'updateMany',
        softDelete: false,
      };
    }

    if (operation === 'delete') {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: normalizedArgs.where,
          data: stampDeleteData(actorId),
        },
        effectiveOperation: 'update',
        softDelete: true,
      };
    }

    if (operation === 'deleteMany') {
      return {
        effectiveArgs: {
          ...normalizedArgs,
          where: mergeActiveWhere(normalizedArgs.where),
          data: stampDeleteData(actorId),
        },
        effectiveOperation: 'updateMany',
        softDelete: true,
      };
    }
  }

  if (operation === 'create') {
    return {
      effectiveArgs: {
        ...normalizedArgs,
        data: stampCreateData(normalizedArgs.data, actorId),
      },
      effectiveOperation: 'create',
      softDelete: false,
    };
  }

  if (operation === 'createMany') {
    return {
      effectiveArgs: {
        ...normalizedArgs,
        data: stampCreateData(normalizedArgs.data, actorId),
      },
      effectiveOperation: 'createMany',
      softDelete: false,
    };
  }

  if (operation === 'upsert') {
    return {
      effectiveArgs: {
        ...normalizedArgs,
        create: stampCreateData(normalizedArgs.create, actorId),
        update: {
          ...(stampUpdateData(normalizedArgs.update, actorId) as Record<string, unknown>),
          deleteAt: null,
        },
      },
      effectiveOperation: 'upsert',
      softDelete: false,
    };
  }

  return {
    effectiveArgs: normalizedArgs,
    effectiveOperation: operation,
    softDelete: false,
  };
};

const extractIdsFromMutationData = (data: unknown) => {
  if (Array.isArray(data)) {
    return data
      .flatMap(item => extractIdsFromMutationData(item))
      .filter((id, index, items) => items.indexOf(id) === index);
  }

  if (!isPlainObject(data)) {
    return [];
  }

  return typeof data.id === 'string' ? [data.id] : [];
};

const resolveRowsByWhere = async (
  rawClient: RawPrismaClient,
  model: string,
  where?: unknown,
) => {
  const delegate = getModelDelegate(rawClient, model);
  const rows = await callDelegateOperation(delegate, 'findMany', {
    where: where ?? {},
  }) as Array<Record<string, unknown>>;
  return rows;
};

const resolveRowsByIds = async (
  rawClient: RawPrismaClient,
  model: string,
  ids: string[],
) => {
  if (!ids.length) {
    return [];
  }

  const delegate = getModelDelegate(rawClient, model);
  const rows = await callDelegateOperation(delegate, 'findMany', {
    where: {
      id: {
        in: ids,
      },
    },
  }) as Array<Record<string, unknown>>;

  return rows;
};

const resolveBeforeRowsForWrite = async (input: {
  rawClient: RawPrismaClient;
  model: string;
  operation: string;
  effectiveArgs: PrismaDelegateArgs;
}) => {
  if (input.operation === 'create' || input.operation === 'createMany') {
    return [];
  }

  if (input.operation === 'upsert') {
    return resolveRowsByWhere(input.rawClient, input.model, normalizeUniqueWhere(input.effectiveArgs.where));
  }

  return resolveRowsByWhere(input.rawClient, input.model, input.effectiveArgs.where);
};

const resolveAfterRowsForWrite = async (input: {
  rawClient: RawPrismaClient;
  model: string;
  operation: string;
  effectiveArgs: PrismaDelegateArgs;
  result: unknown;
  beforeRows: Array<Record<string, unknown>>;
}) => {
  const idsFromResult = extractRecordIds(input.result);
  if (idsFromResult.length) {
    return resolveRowsByIds(input.rawClient, input.model, idsFromResult);
  }

  const idsFromMutation = extractIdsFromMutationData(input.effectiveArgs.data ?? input.effectiveArgs.create);
  if (idsFromMutation.length) {
    return resolveRowsByIds(input.rawClient, input.model, idsFromMutation);
  }

  const idsFromBefore = input.beforeRows
    .flatMap(row => typeof row.id === 'string' ? [row.id] : [])
    .filter((id, index, items) => items.indexOf(id) === index);

  if (!idsFromBefore.length) {
    return [];
  }

  return resolveRowsByIds(input.rawClient, input.model, idsFromBefore);
};

const captureRuntimeOperation = (input: {
  model: string;
  operation: string;
  effectiveOperation: string;
  requestedArgs?: PrismaDelegateArgs;
  effectiveArgs: PrismaDelegateArgs;
  accessKind: RuntimeOperationAccessKind;
  softDelete: boolean;
  startedAt: Date;
  finishedAt: Date;
  result?: unknown;
  beforeRows?: Array<Record<string, unknown>>;
  afterRows?: Array<Record<string, unknown>>;
  error?: unknown;
}) => {
  const context = getBackendRuntimeContext();
  if (!context) {
    return;
  }

  const effectKind = classifyOperationEffectKind(input.operation);
  const { query, mutation } = splitOperationAuditArgs(input.requestedArgs, input.effectiveArgs);
  const succeeded = !input.error;
  const error = input.error ? summarizeRuntimeError(input.error) : null;
  const affectedIds = effectKind === 'WRITE'
    ? [...new Set([
        ...(input.beforeRows ?? []).flatMap(row => typeof row.id === 'string' ? [row.id] : []),
        ...(input.afterRows ?? []).flatMap(row => typeof row.id === 'string' ? [row.id] : []),
      ])]
    : extractRecordIds(input.result);
  const effect = effectKind === 'WRITE'
    ? buildWriteOperationEffect({
        afterRows: input.afterRows ?? [],
        beforeRows: input.beforeRows ?? [],
        result: input.result,
      })
    : buildReadOperationEffect(input.result);

  context.addOperation({
    model: input.model,
    operation: input.operation,
    effectiveOperation: input.effectiveOperation,
    accessKind: input.accessKind,
    effectKind,
    inTransaction: context.inTransaction,
    softDelete: input.softDelete,
    succeeded,
    primaryEntityId: affectedIds[0] ?? null,
    affectedCount: affectedIds.length,
    affectedIds,
    query,
    mutation,
    result: toAuditJson(input.result),
    effect: toAuditJson(effect),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
  });
};

const runOperationTriggers = async (input: {
  when: 'before' | 'after';
  rawClient: RawPrismaClient;
  model: string;
  operation: string;
  effectiveOperation: string;
  requestedArgs: PrismaDelegateArgs;
  effectiveArgs: PrismaDelegateArgs;
  accessKind: RuntimeOperationAccessKind;
  softDelete: boolean;
  result: unknown;
  beforeRows: Array<Record<string, unknown>>;
  afterRows: Array<Record<string, unknown>>;
}) => {
  const action = resolveTriggerAction(input.operation, input.requestedArgs);
  if (!action) {
    return;
  }

  const triggers = getTriggersForOperation(
    backendTriggerRegistry,
    input.when,
    input.model,
    action,
  );
  if (!triggers.length) {
    return;
  }

  const runtime = getBackendRuntimeContext();
  const filter = input.requestedArgs.where ?? input.effectiveArgs.where ?? null;
  const data = input.requestedArgs.data ?? input.effectiveArgs.data ?? null;
  const deleteMode = resolveTriggerDeleteMode(
    input.operation,
    input.requestedArgs,
    input.softDelete,
  );

  for (const trigger of triggers) {
    await trigger.fn({
      entity: input.model,
      action,
      when: input.when,
      operation: input.operation,
      effectiveOperation: input.effectiveOperation,
      accessKind: input.accessKind,
      deleteMode,
      runtime,
      db: createManagedPrismaClient(input.rawClient),
      dbRaw: createRawPrismaClient(input.rawClient),
      dbDriver: input.rawClient,
      requestedArgs: input.requestedArgs,
      effectiveArgs: input.effectiveArgs,
      filter,
      data,
      result: input.result,
      beforeRows: input.beforeRows,
      afterRows: input.afterRows,
    });
  }
};

const executeAuditedOperation = async (input: {
  rawClient: RawPrismaClient;
  model: string;
  operation: string;
  effectiveOperation: string;
  requestedArgs?: PrismaDelegateArgs;
  effectiveArgs: PrismaDelegateArgs;
  delegate: PrismaModelDelegate;
  accessKind: RuntimeOperationAccessKind;
  softDelete: boolean;
}) => {
  const effectKind = classifyOperationEffectKind(input.operation);
  const startedAt = new Date();
  const requestedArgs = input.requestedArgs ?? {};

  await runOperationTriggers({
    accessKind: input.accessKind,
    afterRows: [],
    beforeRows: [],
    effectiveArgs: input.effectiveArgs,
    effectiveOperation: input.effectiveOperation,
    model: input.model,
    operation: input.operation,
    rawClient: input.rawClient,
    requestedArgs,
    result: null,
    softDelete: input.softDelete,
    when: 'before',
  });

  const beforeRows = effectKind === 'WRITE'
    ? await resolveBeforeRowsForWrite({
        effectiveArgs: input.effectiveArgs,
        model: input.model,
        operation: input.operation,
        rawClient: input.rawClient,
      })
    : [];

  try {
    const result = await callDelegateOperation(
      input.delegate,
      input.effectiveOperation,
      input.effectiveArgs,
    );
    const finishedAt = new Date();
    const afterRows = effectKind === 'WRITE'
      ? await resolveAfterRowsForWrite({
          beforeRows,
          effectiveArgs: input.effectiveArgs,
          model: input.model,
          operation: input.operation,
          rawClient: input.rawClient,
          result,
        })
      : [];

    await runOperationTriggers({
      accessKind: input.accessKind,
      afterRows,
      beforeRows,
      effectiveArgs: input.effectiveArgs,
      effectiveOperation: input.effectiveOperation,
      model: input.model,
      operation: input.operation,
      rawClient: input.rawClient,
      requestedArgs,
      result,
      softDelete: input.softDelete,
      when: 'after',
    });

    captureRuntimeOperation({
      accessKind: input.accessKind,
      afterRows,
      beforeRows,
      effectiveArgs: input.effectiveArgs,
      effectiveOperation: input.effectiveOperation,
      finishedAt,
      model: input.model,
      operation: input.operation,
      requestedArgs,
      result,
      softDelete: input.softDelete,
      startedAt,
    });

    return result;
  } catch (error) {
    const finishedAt = new Date();
    captureRuntimeOperation({
      accessKind: input.accessKind,
      beforeRows,
      effectiveArgs: input.effectiveArgs,
      effectiveOperation: input.effectiveOperation,
      error,
      finishedAt,
      model: input.model,
      operation: input.operation,
      requestedArgs,
      softDelete: input.softDelete,
      startedAt,
    });
    throw error;
  }
};

const runManagedDelegateOperation = async (
  rawClient: RawPrismaClient,
  model: string,
  operation: string,
  delegate: PrismaModelDelegate,
  args?: PrismaDelegateArgs,
) => {
  const requestedArgs = args ?? {};
  if (auditedModelNames.has(model) && isDeleteGuardedOperation(model, operation, requestedArgs, softDeleteModelNames)) {
    await assertNoDeleteReferenceBlocks({
      client: rawClient as PrismaClient,
      model,
      operation,
      args: requestedArgs,
      softDeleteModelNames,
    });
  }

  const plan = buildManagedOperationPlan(model, operation, requestedArgs);
  if (operation === 'update' && auditedModelNames.has(model)) {
    const recordId = await resolveActiveRecordId(delegate, requestedArgs.where);
    plan.effectiveArgs.where = { id: recordId };
  }

  if (operation === 'delete' && auditedModelNames.has(model)) {
    const recordId = await resolveActiveRecordId(delegate, requestedArgs.where);
    plan.effectiveArgs.where = { id: recordId };
  }

  return executeAuditedOperation({
    accessKind: 'MANAGED',
    delegate,
    effectiveArgs: plan.effectiveArgs,
    effectiveOperation: plan.effectiveOperation,
    model,
    operation,
    rawClient,
    requestedArgs,
    softDelete: plan.softDelete,
  });
};

const runRawDelegateOperation = async (
  rawClient: RawPrismaClient,
  model: string,
  operation: string,
  delegate: PrismaModelDelegate,
  args?: PrismaDelegateArgs,
) =>
  executeAuditedOperation({
    accessKind: 'RAW',
    delegate,
    effectiveArgs: args ?? {},
    effectiveOperation: operation,
    model,
    operation,
    rawClient,
    requestedArgs: args ?? {},
    softDelete: false,
  });

const createClientProxy = <TClient extends object>(resolver: () => TClient): TClient =>
  new Proxy({} as TClient, {
    get(_target, property) {
      const client = resolver() as Record<PropertyKey, unknown>;
      const value = client[property];
      return typeof value === 'function'
        ? value.bind(client)
        : value;
    },
    set(_target, property, value) {
      const client = resolver() as Record<PropertyKey, unknown>;
      client[property] = value;
      return true;
    },
    has(_target, property) {
      return property in (resolver() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(resolver() as object);
    },
    getOwnPropertyDescriptor(_target, property) {
      return Object.getOwnPropertyDescriptor(resolver() as object, property);
    },
  });

const createAuditedPrismaClient = (
  rawClient: RawPrismaClient,
  mode: RuntimeOperationAccessKind,
) => {
  const clientCache = mode === 'MANAGED' ? managedClientCache : rawClientCache;
  const delegateCache = mode === 'MANAGED' ? managedDelegateCache : rawDelegateCache;
  const cached = clientCache.get(rawClient as object);
  if (cached) {
    return cached;
  }

  const audited = new Proxy(rawClient as PrismaClient, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string') {
        return value;
      }

      if (!isModelDelegate(value)) {
        return typeof value === 'function'
          ? value.bind(target)
          : value;
      }

      const delegateKey = value as object;
      const cachedDelegate = delegateCache.get(delegateKey);
      if (cachedDelegate) {
        return cachedDelegate;
      }

      const model = property.charAt(0).toUpperCase() + property.slice(1);
      const auditedDelegate = new Proxy(value, {
        get(delegateTarget, operation, delegateReceiver) {
          const member = Reflect.get(delegateTarget, operation, delegateReceiver);
          if (typeof operation !== 'string' || typeof member !== 'function') {
            return member;
          }

          return (args?: PrismaDelegateArgs) =>
            mode === 'MANAGED'
              ? runManagedDelegateOperation(
                  rawClient,
                  model,
                  operation,
                  delegateTarget as PrismaModelDelegate,
                  args,
                )
              : runRawDelegateOperation(
                  rawClient,
                  model,
                  operation,
                  delegateTarget as PrismaModelDelegate,
                  args,
                );
        },
      });

      delegateCache.set(delegateKey, auditedDelegate);
      return auditedDelegate;
    },
  }) as unknown as PrismaClient;

  clientCache.set(rawClient as object, audited);
  return audited;
};

export const createManagedPrismaClient = (
  rawClient: RawPrismaClient,
) => createAuditedPrismaClient(rawClient, 'MANAGED');

export const createRawPrismaClient = (
  rawClient: RawPrismaClient,
) => createAuditedPrismaClient(rawClient, 'RAW');

const rootPrisma = createManagedPrismaClient(rootPrismaRaw);
const rootPrismaRawAudited = createRawPrismaClient(rootPrismaRaw);

export const getRootPrismaClient = () => rootPrisma;

export const getRootPrismaRawClient = () => rootPrismaRaw;

export const getRootPrismaRawContextClient = () => rootPrismaRawAudited;

export const assertPrismaDeleteAllowed = async (
  model: string,
  operation: 'delete' | 'deleteMany' | 'update' | 'updateMany',
  args: {
    where?: unknown;
    data?: unknown;
  },
  internalParams?: unknown,
) => {
  await assertNoDeleteReferenceBlocks({
    client: resolveRuntimeRawDriver() as PrismaClient,
    model,
    operation,
    args,
    softDeleteModelNames,
    internalParams,
  });
};

export const prisma = createClientProxy(
  () => getBackendRuntimeContext()?.db ?? rootPrisma,
) as PrismaClient;

export const prismaRaw = createClientProxy(
  () => resolveRuntimeRawClient() ?? rootPrismaRawAudited,
) as PrismaClient;
