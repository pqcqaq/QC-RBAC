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

describe('Realtime topic admin integration', () => {
  it('lists seeded realtime topic bindings for admins', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!');

    const response = await request(context.app)
      .get('/api/realtime-topics')
      .query({ page: 1, pageSize: 20, sourceType: 'seed' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(response.body.data.meta.total, 5);
    assert.equal(response.body.data.items.length, 5);
    assert.ok(response.body.data.items.every((item: { isSystem: boolean }) => item.isSystem));
    assert.ok(
      response.body.data.items.some(
        (item: { code: string; permission: { code: string } }) =>
          item.code === 'chat-global-messages'
          && item.permission.code === 'realtime.topic.chat-global.subscribe',
      ),
    );
  });

  it('supports permission option search and resolve for topic bindings', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!');

    const optionPage = await request(context.app)
      .post('/api/realtime-topics/options/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ page: 1, pageSize: 10, q: 'chat-global' })
      .expect(200);

    assert.equal(optionPage.body.data.meta.total, 1);
    assert.equal(optionPage.body.data.items[0].code, 'realtime.topic.chat-global.subscribe');

    const resolved = await request(context.app)
      .post('/api/realtime-topics/options/permissions/resolve')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ ids: [optionPage.body.data.items[0].id, 'missing-permission-id'] })
      .expect(200);

    assert.equal(resolved.body.data.length, 1);
    assert.equal(resolved.body.data[0].code, 'realtime.topic.chat-global.subscribe');
  });

  it('supports custom realtime topic CRUD and rejects duplicate topic permission bindings', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!');

    const permissionResponse = await request(context.app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'realtime.topic.project-admin.subscribe',
        name: '订阅项目管理员广播',
        module: 'realtime-topic',
        action: 'subscribe-project-admin',
        description: '允许订阅项目管理员相关广播',
      })
      .expect(200);

    const permissionId = permissionResponse.body.data.id as string;

    const created = await request(context.app)
      .post('/api/realtime-topics')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'project-admin-events',
        name: '项目管理员广播',
        description: '项目管理员专用订阅授权',
        topicPattern: '/projects/+/admin-updated',
        permissionId,
      })
      .expect(200);

    assert.equal(created.body.data.code, 'project-admin-events');
    assert.equal(created.body.data.isSystem, false);
    assert.equal(created.body.data.permission.code, 'realtime.topic.project-admin.subscribe');
    assert.equal(created.body.data.topicPattern, '/projects/+/admin-updated');

    const duplicate = await request(context.app)
      .post('/api/realtime-topics')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'project-admin-events-duplicate',
        name: '项目管理员广播副本',
        description: '重复绑定',
        topicPattern: '/projects/+/admin-updated',
        permissionId,
      })
      .expect(400);

    assert.match(duplicate.body.message, /binding already exists/i);

    const customList = await request(context.app)
      .get('/api/realtime-topics')
      .query({ page: 1, pageSize: 20, sourceType: 'custom', q: 'project-admin' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(customList.body.data.meta.total, 1);
    assert.equal(customList.body.data.items[0].id, created.body.data.id);

    const updated = await request(context.app)
      .put(`/api/realtime-topics/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'project-admin-events',
        name: '项目管理员变更广播',
        description: '允许按项目范围订阅管理员变更',
        topicPattern: '/projects/#',
        permissionId,
      })
      .expect(200);

    assert.equal(updated.body.data.name, '项目管理员变更广播');
    assert.equal(updated.body.data.topicPattern, '/projects/#');

    const detail = await request(context.app)
      .get(`/api/realtime-topics/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(detail.body.data.code, 'project-admin-events');
    assert.equal(detail.body.data.permission.id, permissionId);

    await request(context.app)
      .delete(`/api/realtime-topics/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await request(context.app)
      .get(`/api/realtime-topics/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);
  });

  it('prevents editing or deleting seeded realtime topics', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!');

    const listResponse = await request(context.app)
      .get('/api/realtime-topics')
      .query({ page: 1, pageSize: 20, sourceType: 'seed' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const seededTopic = listResponse.body.data.items.find(
      (item: { code: string }) => item.code === 'chat-global-messages',
    );

    assert.ok(seededTopic);

    const updateResponse = await request(context.app)
      .put(`/api/realtime-topics/${seededTopic.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: seededTopic.code,
        name: seededTopic.name,
        description: seededTopic.description,
        topicPattern: seededTopic.topicPattern,
        permissionId: seededTopic.permissionId,
      })
      .expect(400);

    assert.match(updateResponse.body.message, /cannot be edited/i);

    const deleteResponse = await request(context.app)
      .delete(`/api/realtime-topics/${seededTopic.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(deleteResponse.body.message, /cannot be deleted/i);
  });

  it('forbids ordinary members from reading realtime topic bindings', async () => {
    const memberSession = await loginAs(context.app, 'user@example.com', 'User123!');

    await request(context.app)
      .get('/api/realtime-topics')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);
  });
});
