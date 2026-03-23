import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  binaryParser,
  bootstrapBackendTestContext,
  type BackendTestContext,
  loadWorksheet,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  uploadManagedFileForTest,
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

describe('Attachment integration', () => {
  it('supports attachment management CRUD, tag filters and xlsx export', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const primaryUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'invoice-q1.pdf',
      contentType: 'application/pdf',
      content: 'invoice-q1-content',
      kind: 'attachment',
      tag1: 'finance',
      tag2: 'invoice',
    });

    const secondaryUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'contract.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: 'contract-content',
      kind: 'attachment',
      tag1: 'hr',
      tag2: 'contract',
    });

    assert.match(primaryUpload.url, /attachments\//);
    assert.match(secondaryUpload.url, /attachments\//);

    const filteredList = await request(app)
      .get('/api/attachments')
      .query({
        page: 1,
        pageSize: 10,
        kind: 'attachment',
        uploadStatus: 'COMPLETED',
        tag1: 'finance',
        tag2: 'invoice',
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(filteredList.body.data.meta.total, 1);
    assert.equal(filteredList.body.data.items[0].id, primaryUpload.fileId);
    assert.equal(filteredList.body.data.items[0].tag1, 'finance');
    assert.equal(filteredList.body.data.items[0].tag2, 'invoice');
    assert.equal(filteredList.body.data.items[0].owner.username, 'admin');

    const detailResponse = await request(app)
      .get(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(detailResponse.body.data.originalName, 'invoice-q1.pdf');
    assert.equal(detailResponse.body.data.kind, 'attachment');

    const updatedAttachment = await request(app)
      .put(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        originalName: 'invoice-q1-reviewed.pdf',
        tag1: 'finance-review',
        tag2: 'archived',
      })
      .expect(200);

    assert.equal(updatedAttachment.body.data.originalName, 'invoice-q1-reviewed.pdf');
    assert.equal(updatedAttachment.body.data.tag1, 'finance-review');
    assert.equal(updatedAttachment.body.data.tag2, 'archived');

    const exportResponse = await request(app)
      .get('/api/attachments/export')
      .query({ tag1: 'finance-review', tag2: 'archived' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const attachmentSheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(attachmentSheet.name, 'Attachments');
    assert.equal(attachmentSheet.getRow(1).getCell(1).value, '文件名');
    assert.equal(attachmentSheet.rowCount, 2);
    assert.equal(attachmentSheet.getRow(2).getCell(1).value, 'invoice-q1-reviewed.pdf');
    assert.equal(attachmentSheet.getRow(2).getCell(2).value, 'attachment');
    assert.equal(attachmentSheet.getRow(2).getCell(3).value, 'finance-review');
    assert.equal(attachmentSheet.getRow(2).getCell(4).value, 'archived');

    await request(app)
      .delete(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .get(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);

    const remainingAttachment = await request(app)
      .get('/api/attachments')
      .query({ page: 1, pageSize: 10, tag1: 'hr', tag2: 'contract' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(remainingAttachment.body.data.meta.total, 1);
    assert.equal(remainingAttachment.body.data.items[0].id, secondaryUpload.fileId);
  });

  it('supports image option search and resolve for image selectors', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const imageUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'brand-cover.png',
      contentType: 'image/png',
      content: 'png-image-content',
      kind: 'attachment',
      tag1: 'brand',
      tag2: 'cover',
    });

    await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'readme.pdf',
      contentType: 'application/pdf',
      content: 'pdf-content',
      kind: 'attachment',
      tag1: 'brand',
      tag2: 'document',
    });

    const imageOptions = await request(app)
      .post('/api/attachments/options/images')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        page: 1,
        pageSize: 10,
        q: 'brand',
        tag1: 'brand',
      })
      .expect(200);

    assert.equal(imageOptions.body.data.meta.total, 1);
    assert.equal(imageOptions.body.data.items[0].id, imageUpload.fileId);
    assert.equal(imageOptions.body.data.items[0].mimeType, 'image/png');

    const resolved = await request(app)
      .post('/api/attachments/options/images/resolve')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        ids: [imageUpload.fileId],
      })
      .expect(200);

    assert.equal(resolved.body.data.length, 1);
    assert.equal(resolved.body.data[0].id, imageUpload.fileId);
    assert.equal(resolved.body.data[0].originalName, 'brand-cover.png');
  });
});
