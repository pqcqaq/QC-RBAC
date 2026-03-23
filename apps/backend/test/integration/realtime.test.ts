import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, beforeEach, describe, it } from 'node:test';
import { REALTIME_TOPICS, type RealtimeServerMessage } from '@rbac/api-common';
import { WebSocket } from 'ws';
import {
  closeSocketServer,
  getRealtimeConnectionSnapshot,
  initSocket,
  publishRealtimeMessage,
} from '../../src/lib/socket';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  webClient,
  webH5Client,
} from '../support/backend-testkit';

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
});
