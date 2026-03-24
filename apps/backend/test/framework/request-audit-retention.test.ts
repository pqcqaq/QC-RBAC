import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  reseedBackendTestContext,
  teardownBackendTestContext,
} from '../support/backend-testkit';
import { purgeExpiredRequestAudits } from '../../src/services/request-audit';
import { withSnowflakeId } from '../../src/utils/persistence';

let context: BackendTestContext;

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('Request audit retention', () => {
  it('removes request records older than 30 days and cascades operations', async () => {
    const oldStartedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const recentStartedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await context.prismaRaw.requestRecord.create({
      data: {
        id: 'old-request-record',
        actorName: 'Old Actor',
        authMode: 'ANONYMOUS',
        method: 'POST',
        path: '/api/old',
        statusCode: 200,
        success: true,
        operationCount: 1,
        readCount: 0,
        writeCount: 1,
        startedAt: oldStartedAt,
        finishedAt: oldStartedAt,
        durationMs: 1,
        operations: {
          create: [
            withSnowflakeId({
              sequence: 1,
              model: 'Role',
              operation: 'create',
              effectiveOperation: 'create',
              accessKind: 'MANAGED',
              effectKind: 'WRITE',
              committed: true,
              softDelete: false,
              succeeded: true,
              affectedCount: 1,
              affectedIds: ['role-old'],
              startedAt: oldStartedAt,
              finishedAt: oldStartedAt,
              durationMs: 1,
            }),
          ],
        },
      },
    });

    await context.prismaRaw.requestRecord.create({
      data: {
        id: 'recent-request-record',
        actorName: 'Recent Actor',
        authMode: 'ANONYMOUS',
        method: 'GET',
        path: '/api/recent',
        statusCode: 200,
        success: true,
        operationCount: 1,
        readCount: 1,
        writeCount: 0,
        startedAt: recentStartedAt,
        finishedAt: recentStartedAt,
        durationMs: 1,
        operations: {
          create: [
            withSnowflakeId({
              sequence: 1,
              model: 'Role',
              operation: 'findMany',
              effectiveOperation: 'findMany',
              accessKind: 'MANAGED',
              effectKind: 'READ',
              committed: true,
              softDelete: false,
              succeeded: true,
              affectedCount: 0,
              affectedIds: [],
              startedAt: recentStartedAt,
              finishedAt: recentStartedAt,
              durationMs: 1,
            }),
          ],
        },
      },
    });

    const result = await purgeExpiredRequestAudits(30);

    assert.equal(result.deleted, 1);

    const oldRequest = await context.prismaRaw.requestRecord.findUnique({
      where: { id: 'old-request-record' },
      select: { id: true },
    });
    const recentRequest = await context.prismaRaw.requestRecord.findUnique({
      where: { id: 'recent-request-record' },
      select: { id: true },
    });
    const orphanOperations = await context.prismaRaw.operation.findMany({
      where: {
        requestRecordId: 'old-request-record',
      },
      select: { id: true },
    });

    assert.equal(oldRequest, null);
    assert.ok(recentRequest);
    assert.deepEqual(orphanOperations, []);
  });
});
