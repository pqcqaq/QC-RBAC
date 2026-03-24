import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
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
  });

  it('rolls back writes when an async handler throws', async () => {
    const app = createRuntimeTestApp();
    await request(app)
      .post('/runtime/rollback')
      .expect(400);

    const role = await context.prismaRaw.role.findFirst({
      where: { code: 'runtime-tx-rollback' },
      select: { id: true },
    });

    assert.equal(role, null);
  });

  it('rolls back handled error responses and reuses the same nested transaction', async () => {
    const app = createRuntimeTestApp();
    await request(app)
      .post('/runtime/handled-rollback')
      .expect(400);

    const roles = await context.prismaRaw.role.findMany({
      where: {
        code: {
          in: ['runtime-tx-handled-outer', 'runtime-tx-handled-inner'],
        },
      },
      select: { code: true },
    });

    assert.deepEqual(roles, []);
  });
});
