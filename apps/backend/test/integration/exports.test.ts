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

describe('Export integration', () => {
  it('exports filtered user lists and realtime history as xlsx workbooks', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const userExport = await request(app)
      .get('/api/users/export')
      .query({ q: 'admin@example.com', status: 'ACTIVE' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(userExport.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(userExport.headers['content-disposition']), /attachment/i);

    const userSheet = await loadWorksheet(userExport.body as Buffer);
    assert.equal(userSheet.name, 'Users');
    assert.equal(userSheet.getRow(1).getCell(1).value, '用户名');
    assert.equal(userSheet.rowCount, 2);
    assert.equal(userSheet.getRow(2).getCell(1).value, 'admin');
    assert.equal(userSheet.getRow(2).getCell(4).value, '启用');

    const messageExport = await request(app)
      .get('/api/realtime/messages/export')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const messageSheet = await loadWorksheet(messageExport.body as Buffer);
    assert.equal(messageSheet.name, 'Live Messages');
    assert.equal(messageSheet.getRow(1).getCell(1).value, '发送人');
    assert.equal(messageSheet.rowCount, 4);
  });
});
