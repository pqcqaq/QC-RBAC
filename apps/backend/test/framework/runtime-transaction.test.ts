import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import request from 'supertest';
import { prisma, prismaRaw } from '../../src/lib/prisma';
import { runInBackendRuntimeTransaction } from '../../src/lib/runtime-transaction';
import { errorHandler } from '../../src/middlewares/error-handler';
import { requestContextMiddleware } from '../../src/middlewares/request-context';
import { HttpError, badRequest } from '../../src/utils/errors';
import { asyncHandler, ok, rollbackHandledResponse } from '../../src/utils/http';
import { withSnowflakeId } from '../../src/utils/persistence';
import { setRequestActorId } from '../../src/utils/request-context';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  reseedBackendTestContext,
  teardownBackendTestContext,
} from '../support/backend-testkit';

let context: BackendTestContext;

const waitForRequestAuditRecord = async (requestId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const requestRecord = await context.prismaRaw.requestRecord.findUnique({
      where: { id: requestId },
      include: {
        operations: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (requestRecord) {
      return requestRecord;
    }

    await delay(25);
  }

  return null;
};

const createRuntimeTestApp = () => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json());

  app.post('/runtime/commit', asyncHandler(async (_req, res) => {
    setRequestActorId('runtime-actor-commit');
    const role = await prisma.role.create({
      data: withSnowflakeId({
        code: 'runtime-tx-commit',
        name: 'Runtime Tx Commit',
        description: 'runtime commit',
      }),
    });

    return ok(res, { id: role.id }, 'Committed');
  }));

  app.post('/runtime/rollback', asyncHandler(async (_req, _res) => {
    await prisma.role.create({
      data: withSnowflakeId({
        code: 'runtime-tx-rollback',
        name: 'Runtime Tx Rollback',
        description: 'runtime rollback',
      }),
    });

    throw badRequest('rollback requested');
  }));

  app.post('/runtime/handled-rollback', asyncHandler(async (_req, res) => {
    try {
      setRequestActorId('runtime-actor-handled');
      await prisma.role.create({
        data: withSnowflakeId({
          code: 'runtime-tx-handled-outer',
          name: 'Runtime Tx Handled Outer',
          description: 'handled outer',
        }),
      });

      await runInBackendRuntimeTransaction(async () => {
        await prisma.role.create({
          data: withSnowflakeId({
            code: 'runtime-tx-handled-inner',
            name: 'Runtime Tx Handled Inner',
            description: 'handled inner',
          }),
        });

        throw badRequest('handled rollback requested');
      });

      return ok(res, { ok: true }, 'Unexpected success');
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          data: null,
        });
        throw rollbackHandledResponse();
      }

      throw error;
    }
  }));

  app.post('/runtime/redaction', asyncHandler(async (req, res) => {
    setRequestActorId('runtime-actor-redaction');
    await prisma.authClient.create({
      data: withSnowflakeId({
        code: 'runtime-redaction-client',
        name: 'Runtime Redaction Client',
        type: 'WEB',
        description: 'runtime redaction',
        config: {
          host: 'localhost',
          port: 5173,
          protocol: 'http',
          requestSecret: req.body.clientSecret,
        },
        secretHash: 'runtime-secret-hash',
        salt: 'runtime-secret-salt',
        enabled: true,
      }),
    });

    return ok(res, { ok: true }, 'Redacted');
  }));

  app.post('/runtime/operation-mix', asyncHandler(async (_req, res) => {
    setRequestActorId('runtime-actor-operation-mix');
    const created = await prisma.role.create({
      data: withSnowflakeId({
        code: 'runtime-tx-operation-mix',
        name: 'Runtime Tx Operation Mix',
        description: 'runtime operation mix created',
      }),
    });

    const managedRead = await prisma.role.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        description: true,
        deleteAt: true,
      },
    });

    await prisma.role.update({
      where: { id: created.id },
      data: {
        description: 'runtime operation mix updated',
      },
    });

    await prismaRaw.role.update({
      where: { id: created.id },
      data: {
        description: 'runtime operation mix raw updated',
        updateId: 'runtime-actor-operation-mix',
      },
    });

    const rawReadBeforeDelete = await prismaRaw.role.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        description: true,
        deleteAt: true,
      },
    });

    await prisma.role.delete({
      where: { id: created.id },
    });

    const rawReadAfterDelete = await prismaRaw.role.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        description: true,
        deleteAt: true,
      },
    });

    return ok(res, {
      id: created.id,
      managedRead,
      rawReadBeforeDelete,
      rawReadAfterDelete,
    }, 'Operation mix');
  }));

  app.use(errorHandler);
  return app;
};

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('Backend runtime transaction framework', () => {
  it('commits writes and preserves actor ids from request context', async () => {
    const app = createRuntimeTestApp();
    const response = await request(app)
      .post('/runtime/commit')
      .expect(200);
    const requestId = String(response.headers['x-request-id'] ?? '');

    const role = await context.prismaRaw.role.findUnique({
      where: { id: String(response.body.data.id) },
      select: {
        id: true,
        code: true,
        createId: true,
        updateId: true,
        deleteAt: true,
      },
    });

    assert.ok(role);
    assert.equal(role.code, 'runtime-tx-commit');
    assert.equal(role.createId, 'runtime-actor-commit');
    assert.equal(role.updateId, 'runtime-actor-commit');
    assert.equal(role.deleteAt, null);

    const requestRecord = await waitForRequestAuditRecord(requestId);

    assert.ok(requestRecord);
    assert.equal(requestRecord.success, true);
    assert.equal(requestRecord.actorName, 'runtime-actor-commit');
    assert.equal(requestRecord.operationCount, 1);
    assert.equal(requestRecord.operations[0]?.model, 'Role');
    assert.equal(requestRecord.operations[0]?.operation, 'create');
    assert.equal(requestRecord.operations[0]?.committed, true);
  });

  it('rolls back writes when an async handler throws', async () => {
    const app = createRuntimeTestApp();
    const response = await request(app)
      .post('/runtime/rollback')
      .expect(400);
    const requestId = String(response.headers['x-request-id'] ?? '');

    const role = await context.prismaRaw.role.findFirst({
      where: { code: 'runtime-tx-rollback' },
      select: { id: true },
    });

    assert.equal(role, null);

    const requestRecord = await waitForRequestAuditRecord(requestId);

    assert.ok(requestRecord);
    assert.equal(requestRecord.success, false);
    assert.equal(requestRecord.errorCode, 'HTTP_400');
    assert.equal(requestRecord.operations[0]?.operation, 'create');
    assert.equal(requestRecord.operations[0]?.committed, false);
  });

  it('rolls back handled error responses and reuses the same nested transaction', async () => {
    const app = createRuntimeTestApp();
    const response = await request(app)
      .post('/runtime/handled-rollback')
      .expect(400);
    const requestId = String(response.headers['x-request-id'] ?? '');

    const roles = await context.prismaRaw.role.findMany({
      where: {
        code: {
          in: ['runtime-tx-handled-outer', 'runtime-tx-handled-inner'],
        },
      },
      select: { code: true },
    });

    assert.deepEqual(roles, []);

    const requestRecord = await waitForRequestAuditRecord(requestId);

    assert.ok(requestRecord);
    assert.equal(requestRecord.success, false);
    assert.equal(requestRecord.operations.length, 2);
    assert.ok(requestRecord.operations.every(operation => operation.committed === false));
  });

  it('redacts sensitive request and database fields in persisted audit records', async () => {
    const app = createRuntimeTestApp();
    const response = await request(app)
      .post('/runtime/redaction')
      .send({
        clientSecret: 'plain-client-secret',
        password: 'plain-password',
      })
      .expect(200);
    const requestId = String(response.headers['x-request-id'] ?? '');

    const requestRecord = await waitForRequestAuditRecord(requestId);

    assert.ok(requestRecord);
    assert.deepEqual(requestRecord.requestBody, {
      clientSecret: '[REDACTED]',
      password: '[REDACTED]',
    });
    assert.equal(requestRecord.operations[0]?.model, 'AuthClient');
    const operationEffect = requestRecord.operations[0]?.effect as {
      records?: Array<{
        after?: {
          config?: { requestSecret?: string };
          salt?: string;
          secretHash?: string;
        };
      }>;
    } | null;
    assert.equal(operationEffect?.records?.[0]?.after?.secretHash, '[REDACTED]');
    assert.equal(operationEffect?.records?.[0]?.after?.salt, '[REDACTED]');
    assert.equal(operationEffect?.records?.[0]?.after?.config?.requestSecret, '[REDACTED]');
  });

  it('captures managed and raw read/write operations in sequence with accurate effects', async () => {
    const app = createRuntimeTestApp();
    const response = await request(app)
      .post('/runtime/operation-mix')
      .expect(200);
    const requestId = String(response.headers['x-request-id'] ?? '');
    const roleId = String(response.body.data.id);

    const rawRole = await context.prismaRaw.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        description: true,
        deleteAt: true,
        updateId: true,
      },
    });

    assert.ok(rawRole);
    assert.equal(rawRole.description, 'runtime operation mix raw updated');
    assert.equal(rawRole.updateId, 'runtime-actor-operation-mix');
    assert.notEqual(rawRole.deleteAt, null);

    const requestRecord = await waitForRequestAuditRecord(requestId);

    assert.ok(requestRecord);
    assert.equal(requestRecord.success, true);
    assert.equal(requestRecord.actorName, 'runtime-actor-operation-mix');
    assert.equal(requestRecord.operationCount, 7);
    assert.equal(requestRecord.readCount, 3);
    assert.equal(requestRecord.writeCount, 4);

    const operations = requestRecord.operations;
    assert.equal(operations.length, 7);
    assert.deepEqual(
      operations.map(operation => ({
        accessKind: operation.accessKind,
        effectKind: operation.effectKind,
        effectiveOperation: operation.effectiveOperation,
        operation: operation.operation,
        softDelete: operation.softDelete,
      })),
      [
        {
          accessKind: 'MANAGED',
          effectKind: 'WRITE',
          effectiveOperation: 'create',
          operation: 'create',
          softDelete: false,
        },
        {
          accessKind: 'MANAGED',
          effectKind: 'READ',
          effectiveOperation: 'findFirst',
          operation: 'findUnique',
          softDelete: false,
        },
        {
          accessKind: 'MANAGED',
          effectKind: 'WRITE',
          effectiveOperation: 'update',
          operation: 'update',
          softDelete: false,
        },
        {
          accessKind: 'RAW',
          effectKind: 'WRITE',
          effectiveOperation: 'update',
          operation: 'update',
          softDelete: false,
        },
        {
          accessKind: 'RAW',
          effectKind: 'READ',
          effectiveOperation: 'findUnique',
          operation: 'findUnique',
          softDelete: false,
        },
        {
          accessKind: 'MANAGED',
          effectKind: 'WRITE',
          effectiveOperation: 'update',
          operation: 'delete',
          softDelete: true,
        },
        {
          accessKind: 'RAW',
          effectKind: 'READ',
          effectiveOperation: 'findUnique',
          operation: 'findUnique',
          softDelete: false,
        },
      ],
    );
    assert.ok(operations.every(operation => operation.committed === true));
    assert.ok(operations.every((operation, index) => operation.sequence === index + 1));

    const managedReadEffect = operations[1]?.effect as {
      summary?: {
        resultCount?: number;
        resultType?: string;
        returnedIds?: string[];
      };
    } | null;
    assert.equal(managedReadEffect?.summary?.resultType, 'single');
    assert.equal(managedReadEffect?.summary?.resultCount, 1);
    assert.deepEqual(managedReadEffect?.summary?.returnedIds, [roleId]);

    const rawUpdateEffect = operations[3]?.effect as {
      records?: Array<{
        changes?: Array<{
          field?: string;
          before?: string | null;
          after?: string | null;
        }>;
      }>;
    } | null;
    assert.deepEqual(
      rawUpdateEffect?.records?.[0]?.changes?.find(change => change.field === 'description'),
      {
        field: 'description',
        before: 'runtime operation mix updated',
        after: 'runtime operation mix raw updated',
      },
    );

    const deleteEffect = operations[5]?.effect as {
      records?: Array<{
        before?: { deleteAt?: string | null };
        after?: { deleteAt?: string | null };
      }>;
    } | null;
    assert.equal(deleteEffect?.records?.[0]?.before?.deleteAt ?? null, null);
    assert.equal(typeof deleteEffect?.records?.[0]?.after?.deleteAt, 'string');

    const rawReadAfterDeleteEffect = operations[6]?.effect as {
      summary?: {
        returnedIds?: string[];
      };
    } | null;
    assert.deepEqual(rawReadAfterDeleteEffect?.summary?.returnedIds, [roleId]);
  });
});
