import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
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

describe('File upload integration', () => {
  it('persists FAILED upload status when callback finalization errors', async () => {
    const { app, prismaRaw } = context;
    const session = await loginAs(app, 'admin@example.com', 'Admin123!');

    const prepareResponse = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'broken-upload.txt',
        contentType: 'text/plain',
        size: 32,
      })
      .expect(200);

    const fileId = prepareResponse.body.data.fileId as string;

    await request(app)
      .post('/api/files/callback')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ fileId })
      .expect(500);

    const asset = await prismaRaw.mediaAsset.findUnique({
      where: { id: fileId },
      select: {
        uploadStatus: true,
        updateId: true,
      },
    });

    assert.ok(asset);
    assert.equal(asset.uploadStatus, 'FAILED');
    assert.equal(asset.updateId, session.user.id);
  });
});
