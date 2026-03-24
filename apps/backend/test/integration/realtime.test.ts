import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  REALTIME_TOPICS,
  type RbacUpdatedPayload,
  type RealtimeServerMessage,
} from '@rbac/api-common';
import request from 'supertest';
import { WebSocket } from 'ws';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  webClient,
  webH5Client,
} from '../support/backend-testkit';
import {
  closeSocketServer,
  getRealtimeConnectionSnapshot,
  initSocket,
  publishRealtimeMessage,
} from '../../src/lib/socket';


type RealtimeTestClient = {
  closeEvents: Array<{ code: number; reason: string }>;
  messages: RealtimeServerMessage[];
  socket: WebSocket;
};

const waitFor = async <T>(
  resolver: () => false | null | T | undefined,
  timeoutMs = 1_500,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = resolver();
    if (result) {
      return result;
    }

    await delay(10);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
};

const connectRealtimeClient = async (port: number, accessToken: string) => {
  const messages: RealtimeServerMessage[] = [];
  const closeEvents: Array<{ code: number; reason: string }> = [];
  const socket = new WebSocket(`ws://127.0.0.1:${port}/realtime/ws?access_token=${encodeURIComponent(accessToken)}`);

  socket.on('message', (data) => {
    messages.push(JSON.parse(data.toString()) as RealtimeServerMessage);
  });
  socket.on('close', (code, reason) => {
    closeEvents.push({
      code,
      reason: reason.toString(),
    });
  });

  await waitFor(() => socket.readyState === WebSocket.OPEN ? true : undefined);

  return {
    closeEvents,
    messages,
    socket,
  } satisfies RealtimeTestClient;
};

const subscribeUserTopic = async (client: RealtimeTestClient, userId: string, requestId: string) => {
  client.socket.send(JSON.stringify({
    requestId,
    topics: [REALTIME_TOPICS.userRbacUpdated(userId)],
    type: 'sub',
  }));

  return takeMessage(
    client,
    (message): message is Extract<RealtimeServerMessage, { type: 'sub:ack' }> => message.type === 'sub:ack',
  );
};

const takeMessage = async <T extends RealtimeServerMessage>(
  client: RealtimeTestClient,
  matcher: (message: RealtimeServerMessage) => message is T,
  timeoutMs = 1_500,
) =>
  waitFor(() => {
    const index = client.messages.findIndex(matcher);
    if (index < 0) {
      return undefined;
    }

    return client.messages.splice(index, 1)[0] as T;
  }, timeoutMs);

const closeRealtimeClient = async (client: RealtimeTestClient) => {
  if (client.socket.readyState === WebSocket.CLOSED) {
    return;
  }

  if (
    client.socket.readyState === WebSocket.OPEN
    || client.socket.readyState === WebSocket.CONNECTING
  ) {
    client.socket.close();
  }

  await waitFor(() => client.socket.readyState === WebSocket.CLOSED ? true : undefined);
};

const assertNoTopicMessage = async (
  client: RealtimeTestClient,
  timeoutMs = 250,
) => {
  await delay(timeoutMs);
  assert.equal(client.messages.some((message) => message.type === 'message'), false);
};

let context: BackendTestContext;
let server: http.Server;
let port: number;

before(async () => {
  context = await bootstrapBackendTestContext();
  server = http.createServer(context.app);
  initSocket(server);

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(0, '127.0.0.1');
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  port = address.port;
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await closeSocketServer();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await teardownBackendTestContext(context);
});

describe('Realtime integration', () => {
  it('tracks the same user across multiple realtime client groups', async () => {
    const webSession = await loginAs(context.app, 'admin@example.com', 'Admin123!', webClient);
    const webH5Session = await loginAs(context.app, 'admin@example.com', 'Admin123!', webH5Client);

    const webRealtime = await connectRealtimeClient(port, webSession.tokens.accessToken);
    const webH5Realtime = await connectRealtimeClient(port, webH5Session.tokens.accessToken);

    const webReady = await takeMessage(
      webRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );
    const webH5Ready = await takeMessage(
      webH5Realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );

    assert.equal(webReady.userId, webH5Ready.userId);
    assert.equal(webReady.client.code, webClient.code);
    assert.equal(webH5Ready.client.code, webH5Client.code);

    const snapshot = await waitFor(() => {
      const current = getRealtimeConnectionSnapshot();
      return current.totalConnections === 2 ? current : undefined;
    });

    assert.equal(snapshot.users.length, 1);
    assert.equal(snapshot.users[0]?.count, 2);
    assert.equal(snapshot.users[0]?.clientGroups.length, 2);
    assert.ok(snapshot.users[0]?.clientGroups.some((group) => group.clientKey.includes(webClient.code)));
    assert.ok(snapshot.users[0]?.clientGroups.some((group) => group.clientKey.includes(webH5Client.code)));

    await closeRealtimeClient(webRealtime);
    await closeRealtimeClient(webH5Realtime);
    await waitFor(() => getRealtimeConnectionSnapshot().totalConnections === 0 ? true : undefined);
  });

  it('acknowledges subscriptions and unsubscriptions and dispatches wildcard topic messages', async () => {
    const session = await loginAs(context.app, 'admin@example.com', 'Admin123!', webClient);
    const realtime = await connectRealtimeClient(port, session.tokens.accessToken);

    const ready = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );

    realtime.socket.send(JSON.stringify({
      requestId: 'req-sub-1',
      topics: ['/system/users/+/rbac-updated'],
      type: 'sub',
    }));

    const subAck = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'sub:ack' }> => message.type === 'sub:ack',
    );

    assert.equal(subAck.requestId, 'req-sub-1');
    assert.deepEqual(subAck.subscribedTopics, ['/system/users/+/rbac-updated']);
    assert.deepEqual(subAck.topics, ['/system/users/+/rbac-updated']);

    const deliveredCount = publishRealtimeMessage(REALTIME_TOPICS.userRbacUpdated(ready.userId), {
      at: '2026-03-23T10:00:00.000Z',
      reason: 'integration-test',
      targets: ['user', 'menus'],
    });

    assert.equal(deliveredCount, 1);

    const pushedMessage = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'message' }> => message.type === 'message',
    );

    assert.equal(pushedMessage.topic, REALTIME_TOPICS.userRbacUpdated(ready.userId));
    assert.deepEqual(pushedMessage.payload, {
      at: '2026-03-23T10:00:00.000Z',
      reason: 'integration-test',
      targets: ['user', 'menus'],
    });

    realtime.socket.send(JSON.stringify({
      requestId: 'req-unsub-1',
      topics: ['/system/users/+/rbac-updated'],
      type: 'unsub',
    }));

    const unsubAck = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'unsub:ack' }> => message.type === 'unsub:ack',
    );

    assert.equal(unsubAck.requestId, 'req-unsub-1');
    assert.deepEqual(unsubAck.unsubscribedTopics, ['/system/users/+/rbac-updated']);
    assert.deepEqual(unsubAck.topics, []);

    const closeEvent = await waitFor(() => realtime.closeEvents[0]);
    assert.deepEqual(closeEvent, {
      code: 1_000,
      reason: 'No subscriptions',
    });
    await waitFor(() => getRealtimeConnectionSnapshot().totalConnections === 0 ? true : undefined);
  });

  it('rejects topic subscriptions that are not covered by the current user permissions', async () => {
    const session = await loginAs(context.app, 'user@example.com', 'User123!', webClient);
    const realtime = await connectRealtimeClient(port, session.tokens.accessToken);

    const ready = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );

    realtime.socket.send(JSON.stringify({
      requestId: 'req-sub-denied-rbac',
      topics: ['/system/users/+/rbac-updated'],
      type: 'sub',
    }));

    const rbacError = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'error' }> => message.type === 'error',
    );

    assert.equal(rbacError.code, 'SUBSCRIBE_REJECTED');
    assert.match(rbacError.message, /other users rbac topic/i);

    realtime.socket.send(JSON.stringify({
      requestId: 'req-sub-denied-audit',
      topics: [REALTIME_TOPICS.auditEvent],
      type: 'sub',
    }));

    const auditError = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'error' }> => message.type === 'error',
    );

    assert.equal(auditError.code, 'SUBSCRIBE_REJECTED');
    assert.match(auditError.message, /Missing topic subscription permission/i);

    realtime.socket.send(JSON.stringify({
      requestId: 'req-sub-self',
      topics: [REALTIME_TOPICS.userRbacUpdated(ready.userId)],
      type: 'sub',
    }));

    const selfAck = await takeMessage(
      realtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'sub:ack' }> => message.type === 'sub:ack',
    );

    assert.equal(selfAck.requestId, 'req-sub-self');
    assert.deepEqual(selfAck.subscribedTopics, [REALTIME_TOPICS.userRbacUpdated(ready.userId)]);
    assert.deepEqual(selfAck.topics, [REALTIME_TOPICS.userRbacUpdated(ready.userId)]);

    await closeRealtimeClient(realtime);
  });

  it('pushes permission updates only to affected online users and includes full sync targets', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!', webClient);

    const permissionResponse = await request(context.app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        action: 'read',
        code: 'realtime.permission.target',
        description: 'Realtime permission target',
        module: 'realtime',
        name: 'Realtime Permission Target',
      })
      .expect(200);

    const permission = permissionResponse.body.data as {
      action: string;
      code: string;
      description?: string;
      id: string;
      module: string;
      name: string;
    };

    const selfTopicPermission = await context.prisma.permission.findUnique({
      where: {
        code: 'realtime.topic.user-rbac.subscribe-self',
      },
      select: {
        id: true,
      },
    });

    assert.ok(selfTopicPermission);
    const roleResponse = await request(context.app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'realtime-permission-role',
        description: 'Realtime permission role',
        name: 'Realtime Permission Role',
        permissionIds: [permission.id, selfTopicPermission.id],
      })
      .expect(200);

    const role = roleResponse.body.data as { id: string };

    await request(context.app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        email: 'realtime-permission-user@example.com',
        nickname: '权限实时用户',
        password: 'Target123!',
        roleIds: [role.id],
        status: 'ACTIVE',
        username: 'realtime-permission-user',
      })
      .expect(200);

    const affectedSession = await loginAs(context.app, 'realtime-permission-user@example.com', 'Target123!', webClient);
    const unaffectedSession = await loginAs(context.app, 'user@example.com', 'User123!', webClient);
    const affectedRealtime = await connectRealtimeClient(port, affectedSession.tokens.accessToken);
    const unaffectedRealtime = await connectRealtimeClient(port, unaffectedSession.tokens.accessToken);

    const affectedReady = await takeMessage(
      affectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );
    const unaffectedReady = await takeMessage(
      unaffectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );

    await subscribeUserTopic(affectedRealtime, affectedReady.userId, 'perm-sub-affected');
    await subscribeUserTopic(unaffectedRealtime, unaffectedReady.userId, 'perm-sub-unaffected');

    await request(context.app)
      .put(`/api/permissions/${permission.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        action: permission.action,
        code: permission.code,
        description: 'Realtime permission target updated',
        module: permission.module,
        name: 'Realtime Permission Updated',
      })
      .expect(200);

    const affectedMessage = await takeMessage(
      affectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'message' }> => message.type === 'message',
    );
    const payload = affectedMessage.payload as RbacUpdatedPayload;

    assert.equal(affectedMessage.topic, REALTIME_TOPICS.userRbacUpdated(affectedReady.userId));
    assert.deepEqual(affectedMessage.payload, {
      at: payload.at,
      reason: `Permission changed: ${permission.code}`,
      targets: ['user', 'menus'],
    });

    await assertNoTopicMessage(unaffectedRealtime);
    await closeRealtimeClient(affectedRealtime);
    await closeRealtimeClient(unaffectedRealtime);
  });

  it('pushes menu updates only to online users whose menu tree is affected', async () => {
    const adminSession = await loginAs(context.app, 'admin@example.com', 'Admin123!', webClient);

    const permissionResponse = await request(context.app)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        action: 'read',
        code: 'realtime.menu.target',
        description: 'Realtime menu target',
        module: 'realtime',
        name: 'Realtime Menu Target',
      })
      .expect(200);

    const permission = permissionResponse.body.data as { id: string };

    const selfTopicPermission = await context.prisma.permission.findUnique({
      where: {
        code: 'realtime.topic.user-rbac.subscribe-self',
      },
      select: {
        id: true,
      },
    });

    assert.ok(selfTopicPermission);
    const roleResponse = await request(context.app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        code: 'realtime-menu-role',
        description: 'Realtime menu role',
        name: 'Realtime Menu Role',
        permissionIds: [permission.id, selfTopicPermission.id],
      })
      .expect(200);

    const role = roleResponse.body.data as { id: string };

    await request(context.app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        email: 'realtime-menu-user@example.com',
        nickname: '菜单实时用户',
        password: 'Target123!',
        roleIds: [role.id],
        status: 'ACTIVE',
        username: 'realtime-menu-user',
      })
      .expect(200);

    const affectedSession = await loginAs(context.app, 'realtime-menu-user@example.com', 'Target123!', webClient);
    const unaffectedSession = await loginAs(context.app, 'user@example.com', 'User123!', webClient);
    const affectedRealtime = await connectRealtimeClient(port, affectedSession.tokens.accessToken);
    const unaffectedRealtime = await connectRealtimeClient(port, unaffectedSession.tokens.accessToken);

    const affectedReady = await takeMessage(
      affectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );
    const unaffectedReady = await takeMessage(
      unaffectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'ready' }> => message.type === 'ready',
    );

    await subscribeUserTopic(affectedRealtime, affectedReady.userId, 'menu-sub-affected');
    await subscribeUserTopic(unaffectedRealtime, unaffectedReady.userId, 'menu-sub-unaffected');

    const parentPage = await context.prisma.menuNode.findFirst({
      where: {
        type: 'PAGE',
      },
      select: {
        id: true,
      },
    });

    assert.ok(parentPage);

    await request(context.app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        caption: 'realtime menu',
        code: 'realtime-menu-action',
        description: 'Realtime menu action',
        icon: 'i-carbon-home',
        parentId: parentPage.id,
        permissionId: permission.id,
        sortOrder: 9_999,
        title: 'Realtime Menu Action',
        type: 'ACTION',
      })
      .expect(200);

    const affectedMessage = await takeMessage(
      affectedRealtime,
      (message): message is Extract<RealtimeServerMessage, { type: 'message' }> => message.type === 'message',
    );
    const payload = affectedMessage.payload as RbacUpdatedPayload;

    assert.equal(affectedMessage.topic, REALTIME_TOPICS.userRbacUpdated(affectedReady.userId));
    assert.deepEqual(affectedMessage.payload, {
      at: payload.at,
      reason: 'Menu created: Realtime Menu Action',
      targets: ['menus'],
    });

    await assertNoTopicMessage(unaffectedRealtime);
    await closeRealtimeClient(affectedRealtime);
    await closeRealtimeClient(unaffectedRealtime);
  });
});
