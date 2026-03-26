import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPrismaEntityRelationGraphFromSchema } from '../../src/lib/entity-relation-graph';
import {
  resolveMediaAssetCleanupSpecs,
  resolveTriggerAction,
  resolveTriggerDeleteMode,
} from '../../src/triggers';

const schema = `
model User {
  id String @id
  avatarFileId String?
  avatarFile MediaAsset? @relation("UserAvatar", fields: [avatarFileId], references: [id], onDelete: Restrict)
}

model Document {
  id String @id
  coverId String?
  cover MediaAsset? @relation("DocumentCover", fields: [coverId], references: [id], onDelete: SetNull)
}

model MediaAsset {
  id String @id
  avatarUsers User[] @relation("UserAvatar")
  coverDocuments Document[] @relation("DocumentCover")
}
`;

describe('Backend trigger generation', () => {
  it('derives MediaAsset cleanup specs from relation graph edges', () => {
    const graph = buildPrismaEntityRelationGraphFromSchema(schema);
    const specs = resolveMediaAssetCleanupSpecs(graph);

    assert.deepEqual(specs, [
      {
        entity: 'Document',
        sourceField: 'cover',
        relationName: 'DocumentCover',
        fromField: 'coverId',
      },
      {
        entity: 'User',
        sourceField: 'avatarFile',
        relationName: 'UserAvatar',
        fromField: 'avatarFileId',
      },
    ]);
  });

  it('classifies trigger actions and delete modes for select, update and delete flows', () => {
    assert.equal(resolveTriggerAction('findUnique', {}), 'select');
    assert.equal(resolveTriggerAction('update', { data: { nickname: 'updated' } }), 'update');
    assert.equal(resolveTriggerAction('delete', {}), 'delete');
    assert.equal(
      resolveTriggerAction('updateMany', {
        data: {
          deleteAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      }),
      'delete',
    );

    assert.equal(resolveTriggerDeleteMode('findUnique', {}, false), null);
    assert.equal(resolveTriggerDeleteMode('delete', {}, false), 'hard');
    assert.equal(resolveTriggerDeleteMode('delete', {}, true), 'soft');
    assert.equal(
      resolveTriggerDeleteMode(
        'updateMany',
        {
          data: {
            deleteAt: {
              set: new Date('2026-03-26T00:00:00.000Z'),
            },
          },
        },
        false,
      ),
      'soft',
    );
  });
});
