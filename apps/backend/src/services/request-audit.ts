import type { Request } from 'express';
import type { Prisma } from '../lib/prisma-generated';
import type { BackendRuntimeContext } from '../lib/backend-runtime-context';
import { prisma, getRootPrismaRawClient } from '../lib/prisma';
import {
  type RuntimeOperationCapture,
  toAuditJson,
} from '../lib/request-audit';
import { enqueueRequestAuditFlush } from '../lib/request-audit-flush-queue';
import { emitAuditEvent } from '../lib/socket';
import { withSnowflakeId } from '../utils/persistence';

export type RequestAuditListQuery = {
  q: string;
  method: string;
  model: string;
  operation: string;
  status: string;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeRequestPayload = (value: unknown) => {
  const normalized = toAuditJson(value);
  if (Array.isArray(normalized)) {
    return normalized.length ? normalized : undefined;
  }

  if (isPlainObject(normalized)) {
    return Object.keys(normalized).length ? normalized : undefined;
  }

  return normalized ?? undefined;
};

const resolveAuthMode = (context: BackendRuntimeContext) => {
  const authMode = context.getAuthMode();
  if (authMode === 'local') {
    return 'LOCAL';
  }

  if (authMode === 'oauth') {
    return 'OAUTH';
  }

  return 'ANONYMOUS';
};

const buildOperationCreateInput = (
  actorId: string | null,
  requestSucceeded: boolean,
  operation: RuntimeOperationCapture & { sequence: number },
) =>
  withSnowflakeId({
    createId: actorId,
    updateId: actorId,
    sequence: operation.sequence,
    model: operation.model,
    operation: operation.operation,
    effectiveOperation: operation.effectiveOperation,
    accessKind: operation.accessKind,
    effectKind: operation.effectKind,
    committed: operation.effectKind === 'READ' || !operation.inTransaction || requestSucceeded,
    softDelete: operation.softDelete,
    succeeded: operation.succeeded,
    primaryEntityId: operation.primaryEntityId,
    affectedCount: operation.affectedCount,
    affectedIds: operation.affectedIds,
    query: operation.query as Prisma.InputJsonValue | undefined,
    mutation: operation.mutation as Prisma.InputJsonValue | undefined,
    result: operation.result as Prisma.InputJsonValue | undefined,
    effect: operation.effect as Prisma.InputJsonValue | undefined,
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    startedAt: operation.startedAt,
    finishedAt: operation.finishedAt,
    durationMs: operation.durationMs,
  });

const formatPrimaryOperation = (operations: RuntimeOperationCapture[]) => {
  const primary = operations.find(item => item.effectKind === 'WRITE') ?? operations[0];
  if (!primary) {
    return null;
  }

  return `${primary.model}.${primary.operation}`;
};

const resolveActorName = async (
  context: BackendRuntimeContext,
  actorId: string | null,
) => {
  const auth = context.getAuth();
  if (auth?.nickname) {
    return auth.nickname;
  }

  if (!actorId) {
    return '匿名';
  }

  const actor = await getRootPrismaRawClient().user.findUnique({
    where: { id: actorId },
    select: { nickname: true },
  });

  return actor?.nickname ?? actorId;
};

export const flushRequestAuditRecord = async (
  context: BackendRuntimeContext,
) => {
  const request = context.request;
  const response = context.response;

  if (!request || !response) {
    return;
  }

  if (!context.beginAuditFlush()) {
    return;
  }

  await enqueueRequestAuditFlush(async () => {
    try {
      const root = getRootPrismaRawClient();
      const actorId = context.getActorId();
      const actorName = await resolveActorName(context, actorId);
      const operations = context.getOperations().map((operation, index) => ({
        ...operation,
        sequence: index + 1,
      }));
      const startedAt = context.getRequestStartedAt();
      const finishedAt = new Date();
      const failure = context.getRequestFailure();
      const success = !failure && response.statusCode < 400;
      const readCount = operations.filter(item => item.effectKind === 'READ').length;
      const writeCount = operations.filter(item => item.effectKind === 'WRITE').length;
      const requestRecordId = context.requestId;
      const requestData: Prisma.RequestRecordUncheckedCreateInput = {
        id: requestRecordId,
        createId: actorId,
        updateId: actorId,
        actorId,
        actorName,
        authMode: resolveAuthMode(context),
        authClientId: context.getAuthClient()?.id ?? null,
        authClientCode: context.getAuthClient()?.code ?? null,
        authClientType: context.getAuthClient()?.type ?? null,
        oauthApplicationId: context.getOAuthApplication()?.id ?? null,
        oauthApplicationCode: context.getOAuthApplication()?.code ?? null,
        method: request.method,
        path: request.originalUrl,
        ipAddress: request.ip || null,
        userAgent: request.get('user-agent') ?? null,
        requestQuery: normalizeRequestPayload(request.query) as Prisma.InputJsonValue | undefined,
        requestParams: normalizeRequestPayload(request.params) as Prisma.InputJsonValue | undefined,
        requestBody: normalizeRequestPayload(request.body) as Prisma.InputJsonValue | undefined,
        statusCode: response.statusCode,
        success,
        errorCode: failure?.code ?? null,
        errorMessage: failure?.message ?? null,
        errorDetail: failure?.detail as Prisma.InputJsonValue | undefined,
        operationCount: operations.length,
        readCount,
        writeCount,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      };

      await root.requestRecord.create({
        data: {
          ...requestData,
          operations: {
            create: operations.map(operation => buildOperationCreateInput(actorId, success, operation)),
          },
        },
      });

      emitAuditEvent({
        actor: actorName,
        createdAt: finishedAt.toISOString(),
        method: request.method,
        operationCount: operations.length,
        path: request.originalUrl,
        primaryOperation: formatPrimaryOperation(operations),
        requestId: requestRecordId,
        statusCode: response.statusCode,
      });

      context.completeAuditFlush();
    } catch (error) {
      context.failAuditFlush();
      console.error('[audit] failed to flush request record', error);
    }
  });
};

export const parseRequestAuditListQuery = (query: Request['query']): RequestAuditListQuery => ({
  q: String(query.q ?? '').trim(),
  method: String(query.method ?? '').trim().toUpperCase(),
  model: String(query.model ?? '').trim(),
  operation: String(query.operation ?? '').trim(),
  status: String(query.status ?? '').trim().toLowerCase(),
});

export const buildRequestAuditWhere = (
  input: RequestAuditListQuery,
): Prisma.RequestRecordWhereInput => {
  const where: Prisma.RequestRecordWhereInput = {};
  const andClauses: Prisma.RequestRecordWhereInput[] = [];

  if (input.q) {
    andClauses.push({
      OR: [
        { id: { contains: input.q, mode: 'insensitive' } },
        { actorName: { contains: input.q, mode: 'insensitive' } },
        { path: { contains: input.q, mode: 'insensitive' } },
        {
          operations: {
            some: {
              model: { contains: input.q, mode: 'insensitive' },
            },
          },
        },
        {
          operations: {
            some: {
              operation: { contains: input.q, mode: 'insensitive' },
            },
          },
        },
      ],
    });
  }

  if (input.method) {
    andClauses.push({
      method: input.method,
    });
  }

  if (input.model) {
    andClauses.push({
      operations: {
        some: {
          model: { contains: input.model, mode: 'insensitive' },
        },
      },
    });
  }

  if (input.operation) {
    andClauses.push({
      operations: {
        some: {
          operation: { contains: input.operation, mode: 'insensitive' },
        },
      },
    });
  }

  if (input.status === 'success') {
    andClauses.push({ success: true });
  } else if (input.status === 'failure') {
    andClauses.push({ success: false });
  }

  if (andClauses.length) {
    where.AND = andClauses;
  }

  return where;
};

const requestAuditInclude = {
  operations: {
    orderBy: { sequence: 'asc' },
  },
} as const;

const requestAuditRecencyOrderBy = [
  { startedAt: 'desc' as const },
  { id: 'desc' as const },
] satisfies Prisma.RequestRecordOrderByWithRelationInput[];

type RequestAuditRow = Prisma.RequestRecordGetPayload<{
  include: typeof requestAuditInclude;
}>;

const toOperationRecord = (operation: RequestAuditRow['operations'][number]) => ({
  id: operation.id,
  sequence: operation.sequence,
  model: operation.model,
  operation: operation.operation,
  effectiveOperation: operation.effectiveOperation ?? null,
  accessKind: operation.accessKind,
  effectKind: operation.effectKind,
  committed: operation.committed,
  softDelete: operation.softDelete,
  succeeded: operation.succeeded,
  primaryEntityId: operation.primaryEntityId ?? null,
  affectedCount: operation.affectedCount,
  affectedIds: operation.affectedIds,
  query: operation.query ?? undefined,
  mutation: operation.mutation ?? undefined,
  result: operation.result ?? undefined,
  effect: operation.effect ?? undefined,
  errorCode: operation.errorCode ?? null,
  errorMessage: operation.errorMessage ?? null,
  startedAt: operation.startedAt.toISOString(),
  finishedAt: operation.finishedAt.toISOString(),
  durationMs: operation.durationMs,
});

export const toRequestAuditRecord = (row: RequestAuditRow) => ({
  id: row.id,
  actorId: row.actorId ?? null,
  actorName: row.actorName,
  method: row.method,
  path: row.path,
  statusCode: row.statusCode,
  success: row.success,
  authMode: row.authMode,
  authClientCode: row.authClientCode ?? null,
  authClientType: row.authClientType ?? null,
  errorCode: row.errorCode ?? null,
  errorMessage: row.errorMessage ?? null,
  operationCount: row.operationCount,
  readCount: row.readCount,
  writeCount: row.writeCount,
  requestQuery: row.requestQuery ?? undefined,
  requestParams: row.requestParams ?? undefined,
  requestBody: row.requestBody ?? undefined,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt.toISOString(),
  durationMs: row.durationMs,
  operations: row.operations.map(toOperationRecord),
});

export const listRequestAuditRecords = async (input: {
  page: number;
  pageSize: number;
  skip: number;
  query: RequestAuditListQuery;
}) => {
  const where = buildRequestAuditWhere(input.query);
  const total = await prisma.requestRecord.count({ where });
  const items = await prisma.requestRecord.findMany({
    where,
    skip: input.skip,
    take: input.pageSize,
    include: requestAuditInclude,
    orderBy: requestAuditRecencyOrderBy,
  });

  return {
    items: items.map(toRequestAuditRecord),
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total,
    },
  };
};

export const listRequestAuditExportRows = async (query: RequestAuditListQuery) => {
  const where = buildRequestAuditWhere(query);
  const items = await prisma.requestRecord.findMany({
    where,
    include: requestAuditInclude,
    orderBy: requestAuditRecencyOrderBy,
  });

  return items.map(toRequestAuditRecord);
};

export const listRecentAuditFeed = async (take = 8) => {
  const items = await prisma.requestRecord.findMany({
    where: {
      operationCount: {
        gt: 0,
      },
    },
    take,
    orderBy: requestAuditRecencyOrderBy,
    select: {
      id: true,
      actorName: true,
      method: true,
      path: true,
      statusCode: true,
      operationCount: true,
      startedAt: true,
    },
  });

  return items.map(item => ({
    id: item.id,
    actor: item.actorName,
    summary: `${item.method} ${item.path}`,
    statusCode: item.statusCode,
    operationCount: item.operationCount,
    createdAt: item.startedAt.toISOString(),
  }));
};

export const purgeExpiredRequestAudits = async (olderThanDays = 30) => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await getRootPrismaRawClient().requestRecord.deleteMany({
    where: {
      startedAt: {
        lt: cutoff,
      },
    },
  });

  return {
    cutoff,
    deleted: result.count,
  };
};
