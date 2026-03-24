import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
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
});
