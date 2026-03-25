import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPrismaEntityRelationGraphFromSchema } from '../../src/lib/entity-relation-graph';
import { resolveMediaAssetCleanupSpecs } from '../../src/triggers';

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
});
