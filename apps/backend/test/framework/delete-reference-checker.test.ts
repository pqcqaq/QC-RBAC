import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  isDeleteGuardedOperation,
} from '../../src/lib/delete-reference-checker';
import { HttpError } from '../../src/utils/errors';
import { withSnowflakeId } from '../../src/utils/persistence';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  reseedBackendTestContext,
  teardownBackendTestContext,
} from '../support/backend-testkit';

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

describe('Delete reference checker framework', () => {
  it('detects guarded delete and soft-delete operations', () => {
    const softDeleteModels = new Set(['Role', 'MenuNode']);

    assert.equal(isDeleteGuardedOperation('Role', 'delete', {}, softDeleteModels), true);
    assert.equal(isDeleteGuardedOperation('Role', 'deleteMany', {}, softDeleteModels), true);
    assert.equal(
      isDeleteGuardedOperation('Role', 'updateMany', { data: { deleteAt: new Date() } }, softDeleteModels),
      true,
    );
    assert.equal(
      isDeleteGuardedOperation('Role', 'updateMany', { data: { description: 'noop' } }, softDeleteModels),
      false,
    );
    assert.equal(isDeleteGuardedOperation(undefined, 'delete', {}, softDeleteModels), false);
  });

  it('blocks deleting records that still have incoming references', async () => {
    const { prisma } = context;
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    });

    assert.ok(admin);

    const role = await prisma.role.create({
      data: withSnowflakeId({
        code: 'checker-role-delete',
        name: 'Checker Role Delete',
        description: 'delete guard',
      }),
    });

    await prisma.userRole.create({
      data: withSnowflakeId({
        userId: admin.id,
        roleId: role.id,
      }),
    });

    await assert.rejects(
      prisma.role.delete({ where: { id: role.id } }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 400
        && /UserRole\.role/.test(error.message),
    );
  });

  it('blocks updateMany soft deletes when referenced records still exist', async () => {
    const { prisma } = context;
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    });

    assert.ok(admin);

    const role = await prisma.role.create({
      data: withSnowflakeId({
        code: 'checker-role-update-many',
        name: 'Checker Role UpdateMany',
        description: 'updateMany guard',
      }),
    });

    await prisma.userRole.create({
      data: withSnowflakeId({
        userId: admin.id,
        roleId: role.id,
      }),
    });

    await assert.rejects(
      prisma.role.updateMany({
        where: { id: role.id },
        data: { deleteAt: new Date() },
      }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 400
        && /UserRole\.role/.test(error.message),
    );
  });

  it('blocks deleting menu parents while active children still reference them', async () => {
    const { prisma } = context;

    const parent = await prisma.menuNode.create({
      data: withSnowflakeId({
        code: 'checker-menu-parent',
        type: 'DIRECTORY',
        title: 'Checker Parent',
      }),
    });

    await prisma.menuNode.create({
      data: withSnowflakeId({
        code: 'checker-menu-child',
        type: 'PAGE',
        title: 'Checker Child',
        parentId: parent.id,
      }),
    });

    await assert.rejects(
      prisma.menuNode.delete({ where: { id: parent.id } }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 400
        && /MenuNode\.parent/.test(error.message),
    );
  });

  it('allows batch soft deletion when the self-referencing graph is deleted together', async () => {
    const { prisma, prismaRaw } = context;

    const parent = await prisma.menuNode.create({
      data: withSnowflakeId({
        code: 'checker-menu-batch-parent',
        type: 'DIRECTORY',
        title: 'Checker Batch Parent',
      }),
    });

    const child = await prisma.menuNode.create({
      data: withSnowflakeId({
        code: 'checker-menu-batch-child',
        type: 'PAGE',
        title: 'Checker Batch Child',
        parentId: parent.id,
      }),
    });

    const deleted = await prisma.menuNode.deleteMany({
      where: {
        id: {
          in: [parent.id, child.id],
        },
      },
    });

    assert.equal(deleted.count, 2);

    const rows = await prismaRaw.menuNode.findMany({
      where: {
        id: {
          in: [parent.id, child.id],
        },
      },
      select: {
        id: true,
        deleteAt: true,
      },
    });

    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.deleteAt instanceof Date));
  });
});
