import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrismaEntityRelationGraphFromSchema,
  formatPrismaEntityRelationGraph,
  formatPrismaEntityRelationMermaid,
  formatPrismaEntityRelationTerminalDiagram,
} from '../../src/lib/entity-relation-graph';

const schema = `
model User {
  id String @id
  avatarFileId String? @unique
  avatarFile MediaAsset? @relation("UserAvatar", fields: [avatarFileId], references: [id], onDelete: Restrict)
  roles UserRole[]
}

model MediaAsset {
  id String @id
  avatarUsers User[] @relation("UserAvatar")
}

model UserRole {
  id String @id
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model MenuNode {
  id String @id
  parentId String?
  parent MenuNode? @relation("MenuTree", fields: [parentId], references: [id])
  children MenuNode[] @relation("MenuTree")
}

model Detached {
  id String @id
}
`;

describe('Entity relation graph', () => {
  it('builds model and relation edges from Prisma schema', () => {
    const graph = buildPrismaEntityRelationGraphFromSchema(schema);

    assert.deepEqual(graph.models, ['Detached', 'MediaAsset', 'MenuNode', 'User', 'UserRole']);
    assert.deepEqual(graph.edges, [
      {
        sourceModel: 'MenuNode',
        sourceField: 'parent',
        sourceFieldArity: 'optional',
        targetModel: 'MenuNode',
        relationName: 'MenuTree',
        fromFields: ['parentId'],
        toFields: ['id'],
      },
      {
        sourceModel: 'User',
        sourceField: 'avatarFile',
        sourceFieldArity: 'optional',
        targetModel: 'MediaAsset',
        relationName: 'UserAvatar',
        fromFields: ['avatarFileId'],
        toFields: ['id'],
      },
      {
        sourceModel: 'UserRole',
        sourceField: 'user',
        sourceFieldArity: 'required',
        targetModel: 'User',
        relationName: null,
        fromFields: ['userId'],
        toFields: ['id'],
      },
    ]);
  });

  it('formats readable text and mermaid outputs', () => {
    const graph = buildPrismaEntityRelationGraphFromSchema(schema);
    const text = formatPrismaEntityRelationGraph(graph);
    const mermaid = formatPrismaEntityRelationMermaid(graph);
    const terminal = formatPrismaEntityRelationTerminalDiagram(graph);

    assert.match(text, /\[backend\] entity relation graph \(models=5, edges=3\)/);
    assert.match(text, /Detached\r?\n  \(no relations\)/);
    assert.match(text, /User\r?\n  outgoing:\r?\n    - avatarFile -> MediaAsset \[avatarFileId=id\]/);
    assert.match(text, /User\r?\n(?:.*\r?\n)*  incoming:\r?\n    - UserRole\.user \[userId=id\]/);

    assert.match(mermaid, /^erDiagram/m);
    assert.match(mermaid, /User \{\r?\n    string id PK\r?\n  \}/);
    assert.match(mermaid, /%% r01 MenuNode\.parent->MenuNode\(parentId=id,\?,@MenuTree\)/);
    assert.match(mermaid, /UserRole \|\|--\|\| User : r03/);

    assert.match(terminal, /\[backend\] entity relation graph \(models=5, edges=3, components=3\)/);
    assert.match(terminal, /c1 models=3 edges=2 nodes=MediaAsset, User, UserRole/);
    assert.match(terminal, /User\.avatarFile->MediaAsset\(avatarFileId=id,\?,@UserAvatar\)/);
    assert.match(terminal, /UserRole\.user->User\(userId=id,!\)/);
    assert.match(terminal, /c2 models=1 edges=1 nodes=MenuNode/);
    assert.match(terminal, /MenuNode\.parent->MenuNode\(parentId=id,\?,@MenuTree\)/);
    assert.match(terminal, /c3 models=1 edges=0 nodes=Detached/);
    assert.match(terminal, /relations: \(none\)/);
  });
});
