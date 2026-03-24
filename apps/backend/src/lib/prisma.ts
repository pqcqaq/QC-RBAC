import type { Prisma } from './prisma-generated';
import { PrismaClient } from './prisma-generated';
import {
  assertNoDeleteReferenceBlocks,
  isDeleteGuardedOperation,
} from './delete-reference-checker';
import { createPrismaClient } from './prisma-client-factory';
import { getBackendRuntimeContext } from './backend-runtime-context';
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
  'ActivityLog',
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

type PrismaDelegateArgs = Record<string, unknown>;

type PrismaModelDelegate = Record<string, (args?: PrismaDelegateArgs) => Promise<unknown>>;

type RawPrismaClient = PrismaClient | Prisma.TransactionClient;

const managedClientCache = new WeakMap<object, PrismaClient>();
const managedDelegateCache = new WeakMap<object, object>();

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
    return data.map((item) => stampCreateData(item, actorId));
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
    return data.map((item) => stampUpdateData(item, actorId));
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

const resolveRuntimeActorId = () => getBackendRuntimeContext()?.getActorId() ?? null;

const rootPrismaRaw = createPrismaClient();

const resolveRuntimeRawClient = () => getBackendRuntimeContext()?.dbRaw ?? rootPrismaRaw;

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

const runManagedDelegateOperation = async (
  rawClient: RawPrismaClient,
  model: string,
  operation: string,
  delegate: PrismaModelDelegate,
  args?: PrismaDelegateArgs,
) => {
  if (!auditedModelNames.has(model)) {
    return callDelegateOperation(delegate, operation, args);
  }

  const normalizedArgs = args ?? {};

  if (isDeleteGuardedOperation(model, operation, normalizedArgs, softDeleteModelNames)) {
    await assertNoDeleteReferenceBlocks({
      client: rawClient as PrismaClient,
      model,
      operation,
      args: normalizedArgs,
      softDeleteModelNames,
    });
  }

  const actorId = resolveRuntimeActorId();

  if (softDeleteModelNames.has(model)) {
    if (operation === 'findUnique') {
      return callDelegateOperation(delegate, 'findFirst', {
        ...normalizedArgs,
        where: mergeActiveWhere(normalizeUniqueWhere(normalizedArgs.where)),
      });
    }

    if (
      operation === 'findFirst'
      || operation === 'findMany'
      || operation === 'count'
      || operation === 'aggregate'
    ) {
      return callDelegateOperation(delegate, operation, {
        ...normalizedArgs,
        where: mergeActiveWhere(normalizedArgs.where),
      });
    }

    if (operation === 'update') {
      const recordId = await resolveActiveRecordId(delegate, normalizedArgs.where);
      return callDelegateOperation(delegate, 'update', {
        ...normalizedArgs,
        where: { id: recordId },
        data: stampUpdateData(normalizedArgs.data, actorId),
      });
    }

    if (operation === 'updateMany') {
      return callDelegateOperation(delegate, 'updateMany', {
        ...normalizedArgs,
        where: mergeActiveWhere(normalizedArgs.where),
        data: stampUpdateData(normalizedArgs.data, actorId),
      });
    }

    if (operation === 'delete') {
      const recordId = await resolveActiveRecordId(delegate, normalizedArgs.where);
      return callDelegateOperation(delegate, 'update', {
        ...normalizedArgs,
        where: { id: recordId },
        data: stampDeleteData(actorId),
      });
    }

    if (operation === 'deleteMany') {
      return callDelegateOperation(delegate, 'updateMany', {
        ...normalizedArgs,
        where: mergeActiveWhere(normalizedArgs.where),
        data: stampDeleteData(actorId),
      });
    }
  }

  if (operation === 'create') {
    return callDelegateOperation(delegate, 'create', {
      ...normalizedArgs,
      data: stampCreateData(normalizedArgs.data, actorId),
    });
  }

  if (operation === 'createMany') {
    return callDelegateOperation(delegate, 'createMany', {
      ...normalizedArgs,
      data: stampCreateData(normalizedArgs.data, actorId),
    });
  }

  if (operation === 'upsert') {
    return callDelegateOperation(delegate, 'upsert', {
      ...normalizedArgs,
      create: stampCreateData(normalizedArgs.create, actorId),
      update: {
        ...(stampUpdateData(normalizedArgs.update, actorId) as Record<string, unknown>),
        deleteAt: null,
      },
    });
  }

  return callDelegateOperation(delegate, operation, normalizedArgs);
};

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

export const createManagedPrismaClient = (
  rawClient: RawPrismaClient,
) => {
  const cached = managedClientCache.get(rawClient as object);
  if (cached) {
    return cached;
  }

  const managed = new Proxy(rawClient as PrismaClient, {
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
      const cachedDelegate = managedDelegateCache.get(delegateKey);
      if (cachedDelegate) {
        return cachedDelegate;
      }

      const model = property.charAt(0).toUpperCase() + property.slice(1);
      const managedDelegate = new Proxy(value, {
        get(delegateTarget, operation, delegateReceiver) {
          const member = Reflect.get(delegateTarget, operation, delegateReceiver);
          if (typeof operation !== 'string' || typeof member !== 'function') {
            return member;
          }

          return (args?: PrismaDelegateArgs) =>
            runManagedDelegateOperation(
              rawClient,
              model,
              operation,
              delegateTarget as PrismaModelDelegate,
              args,
            );
        },
      });

      managedDelegateCache.set(delegateKey, managedDelegate);
      return managedDelegate;
    },
  }) as unknown as PrismaClient;

  managedClientCache.set(rawClient as object, managed);
  return managed;
};

const rootPrisma = createManagedPrismaClient(rootPrismaRaw);

export const getRootPrismaClient = () => rootPrisma;

export const getRootPrismaRawClient = () => rootPrismaRaw;

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
    client: resolveRuntimeRawClient() as PrismaClient,
    model,
    operation,
    args,
    softDeleteModelNames,
    internalParams,
  });
};

export const prisma = createClientProxy(() => getBackendRuntimeContext()?.db ?? rootPrisma) as PrismaClient;

export const prismaRaw = createClientProxy(
  () => resolveRuntimeRawClient() as unknown as PrismaClient,
) as PrismaClient;
