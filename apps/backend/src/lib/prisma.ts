import { PrismaClient } from './prisma-generated';
import {
  assertNoDeleteReferenceBlocks,
  isDeleteGuardedOperation,
} from './delete-reference-checker';
import { createPrismaClient } from './prisma-client-factory';
import { getRequestActorId } from '../utils/request-context';
import { generateSnowflakeId } from '../utils/snowflake';

const auditedModelNames = new Set([
  'User',
  'AuthClient',
  'AuthStrategy',
  'UserAuthentication',
  'VerificationCode',
  'Role',
  'Permission',
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

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const getModelDelegate = (client: PrismaClient, model: string) =>
  (client as unknown as Record<string, Record<string, (...args: any[]) => unknown>>)[lowerFirst(model)];

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

const resolveActiveRecordId = async (
  delegate: Record<string, (...args: any[]) => unknown>,
  where?: unknown,
) => {
  const record = await delegate.findFirst({
    where: mergeActiveWhere(normalizeUniqueWhere(where)),
    select: { id: true },
  }) as { id: string } | null;

  return record?.id ?? '__soft_delete_missing__';
};

const prismaRaw = createPrismaClient();

export const prisma: PrismaClient = prismaRaw.$extends({
  query: {
    $allModels: {
      async $allOperations(params) {
        const { model, operation, args, query } = params;
        if (!model || !auditedModelNames.has(model)) {
          return query(args);
        }

        const internalParams = (params as typeof params & { __internalParams?: unknown }).__internalParams;
        if (isDeleteGuardedOperation(model, operation, args, softDeleteModelNames)) {
          await assertNoDeleteReferenceBlocks({
            client: prismaRaw,
            model,
            operation,
            args,
            softDeleteModelNames,
            internalParams,
          });
        }

        const actorId = getRequestActorId();
        const delegate = getModelDelegate(prismaRaw, model);

        if (softDeleteModelNames.has(model)) {
          if (operation === 'findUnique') {
            return delegate.findFirst({
              ...(args as Record<string, unknown>),
              where: mergeActiveWhere(normalizeUniqueWhere((args as { where?: unknown } | undefined)?.where)),
            });
          }

          if (operation === 'findFirst' || operation === 'findMany' || operation === 'count' || operation === 'aggregate') {
            return query({
              ...(args as Record<string, unknown>),
              where: mergeActiveWhere((args as { where?: unknown } | undefined)?.where),
            });
          }

          if (operation === 'update' || operation === 'updateMany') {
            if (operation === 'update') {
              const recordId = await resolveActiveRecordId(delegate, (args as { where?: unknown } | undefined)?.where);
              return delegate.update({
                ...(args as Record<string, unknown>),
                where: { id: recordId },
                data: stampUpdateData((args as { data?: unknown } | undefined)?.data, actorId),
              });
            }

            return query({
              ...(args as Record<string, unknown>),
              where: mergeActiveWhere((args as { where?: unknown } | undefined)?.where),
              data: stampUpdateData((args as { data?: unknown } | undefined)?.data, actorId),
            });
          }

          if (operation === 'delete') {
            const recordId = await resolveActiveRecordId(delegate, (args as { where?: unknown } | undefined)?.where);
            return delegate.update({
              ...(args as Record<string, unknown>),
              where: { id: recordId },
              data: stampDeleteData(actorId),
            });
          }

          if (operation === 'deleteMany') {
            return delegate.updateMany({
              ...(args as Record<string, unknown>),
              where: mergeActiveWhere((args as { where?: unknown } | undefined)?.where),
              data: stampDeleteData(actorId),
            });
          }
        }

        if (operation === 'create') {
          return query({
            ...(args as Record<string, unknown>),
            data: stampCreateData((args as { data?: unknown } | undefined)?.data, actorId),
          });
        }

        if (operation === 'createMany') {
          return query({
            ...(args as Record<string, unknown>),
            data: stampCreateData((args as { data?: unknown } | undefined)?.data, actorId),
          });
        }

        if (operation === 'upsert') {
          return delegate.upsert({
            ...(args as Record<string, unknown>),
            create: stampCreateData((args as { create?: unknown } | undefined)?.create, actorId),
            update: {
              ...(stampUpdateData((args as { update?: unknown } | undefined)?.update, actorId) as Record<string, unknown>),
              deleteAt: null,
            },
          });
        }

        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;

export { prismaRaw };
