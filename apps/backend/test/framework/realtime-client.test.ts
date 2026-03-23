import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, it } from 'node:test';
import {
  AuthClientType,
  createWsClient,
  type RealtimeClientMessage,
  type RealtimeReadyMessage,
  type RealtimeServerMessage,
  type WsAdaptor,
  type WsConnectCloseEvent,
  type WsConnectOptions,
  type WsSocketConnection,
} from '@rbac/api-common';

type CloseCall = {
  code?: number;
  reason?: string;
};

const waitFor = async <T>(
  resolver: () => false | null | T | undefined,
  timeoutMs = 1_000,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = resolver();
    if (result) {
      return result;
    }

    await delay(5);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
};

const isSubMessage = (
  message: RealtimeClientMessage | undefined,
): message is Extract<RealtimeClientMessage, { type: 'sub' }> => message?.type === 'sub';

const isUnsubMessage = (
  message: RealtimeClientMessage | undefined,
): message is Extract<RealtimeClientMessage, { type: 'unsub' }> => message?.type === 'unsub';

const isPongMessage = (
  message: RealtimeClientMessage | undefined,
): message is Extract<RealtimeClientMessage, { type: 'pong' }> => message?.type === 'pong';

class MockSocketConnection implements WsSocketConnection {
  readonly closeCalls: CloseCall[] = [];
  readonly sentMessages: RealtimeClientMessage[] = [];

  constructor(private readonly options: WsConnectOptions) {}

  close(code?: number, reason?: string) {
    this.closeCalls.push({ code, reason });
    this.options.onClose({
      code,
      reason,
      wasClean: true,
    });
  }

  triggerClose(event: WsConnectCloseEvent) {
    this.options.onClose(event);
  }

  triggerMessage(message: RealtimeServerMessage) {
    this.options.onMessage(JSON.stringify(message));
  }

  triggerOpen() {
    this.options.onOpen();
  }

  async send(data: string) {
    this.sentMessages.push(JSON.parse(data) as RealtimeClientMessage);
  }
}

class MockWsAdaptor implements WsAdaptor {
  readonly connections: MockSocketConnection[] = [];
  readonly connectOptions: WsConnectOptions[] = [];

  connect(options: WsConnectOptions) {
    const connection = new MockSocketConnection(options);
    this.connectOptions.push(options);
    this.connections.push(connection);
    return connection;
  }
}

const createReadyMessage = (input?: Partial<RealtimeReadyMessage>): RealtimeReadyMessage => ({
  client: {
    code: 'web-console',
    id: 'client-web-console',
    type: AuthClientType.WEB,
  },
  connectedAt: '2026-03-23T09:00:00.000Z',
  connectionId: 'conn-1',
  heartbeatIntervalMs: 20_000,
  heartbeatTimeoutMs: 60_000,
  topics: [],
  type: 'ready',
  userId: 'user-1',
  ...input,
});

describe('Realtime client framework', () => {
  it('syncs subscribed topics, dispatches wildcard handlers, and closes after the last unsubscribe', async () => {
    const adaptor = new MockWsAdaptor();
    const client = createWsClient({
      adaptor,
      backoff: {
        initialDelayMs: 10,
        jitterRatio: 0,
        maxDelayMs: 10,
        multiplier: 2,
      },
      url: 'ws://realtime.example.test/ws',
    });

    const receivedEvents: Array<{ payload: unknown; topic: string }> = [];
    const dispose = client.onTopic('/chat/#', (event) => {
      receivedEvents.push({
        payload: event.payload,
        topic: event.topic,
      });
    });

    const connection = await waitFor(() => adaptor.connections[0]);
    connection.triggerOpen();
    connection.triggerMessage(createReadyMessage());

    const subscribeMessage = await waitFor(() => connection.sentMessages.find(isSubMessage));
    assert.deepEqual(subscribeMessage.topics, ['/chat/#']);

    connection.triggerMessage({
      requestId: subscribeMessage.requestId,
      subscribedTopics: ['/chat/#'],
      topics: ['/chat/#'],
      type: 'sub:ack',
    });

    await waitFor(() => client.getState().serverTopics.length ? client.getState() : undefined);
    assert.deepEqual(client.getState().desiredTopics, ['/chat/#']);
    assert.deepEqual(client.getState().serverTopics, ['/chat/#']);

    connection.triggerMessage({
      payload: { text: 'hello' },
      publishedAt: '2026-03-23T09:00:01.000Z',
      topic: '/chat/global/message',
      type: 'message',
    });

    assert.deepEqual(receivedEvents, [
      {
        payload: { text: 'hello' },
        topic: '/chat/global/message',
      },
    ]);

    dispose();

    const unsubscribeMessage = await waitFor(() => connection.sentMessages.find(isUnsubMessage));
    assert.deepEqual(unsubscribeMessage.topics, ['/chat/#']);

    connection.triggerMessage({
      requestId: unsubscribeMessage.requestId,
      topics: [],
      type: 'unsub:ack',
      unsubscribedTopics: ['/chat/#'],
    });

    const closeCall = await waitFor(() => connection.closeCalls[0]);
    assert.deepEqual(closeCall, {
      code: 1_000,
      reason: 'No realtime topics',
    });
    assert.equal(client.getState().status, 'idle');
    assert.deepEqual(client.getState().desiredTopics, []);
    assert.deepEqual(client.getState().serverTopics, []);
  });

  it('answers heartbeat pings and reconnects after a non-fatal close while topics remain', async () => {
    const adaptor = new MockWsAdaptor();
    const client = createWsClient({
      adaptor,
      backoff: {
        initialDelayMs: 10,
        jitterRatio: 0,
        maxDelayMs: 10,
        multiplier: 2,
      },
      url: 'ws://realtime.example.test/ws',
    });

    const subscribePromise = client.subscribe('/system/#');

    const firstConnection = await waitFor(() => adaptor.connections[0]);
    firstConnection.triggerOpen();
    firstConnection.triggerMessage(createReadyMessage());

    const firstSubscribeMessage = await waitFor(() => firstConnection.sentMessages.find(isSubMessage));
    firstConnection.triggerMessage({
      requestId: firstSubscribeMessage.requestId,
      subscribedTopics: ['/system/#'],
      topics: ['/system/#'],
      type: 'sub:ack',
    });

    await subscribePromise;

    firstConnection.triggerMessage({
      at: '2026-03-23T09:00:02.000Z',
      type: 'ping',
    });

    const pongMessage = await waitFor(() => firstConnection.sentMessages.find(isPongMessage));
    assert.equal(pongMessage.at, '2026-03-23T09:00:02.000Z');

    firstConnection.triggerClose({
      code: 1_006,
      reason: 'abnormal close',
      wasClean: false,
    });

    const secondConnection = await waitFor(() => adaptor.connections[1]);
    secondConnection.triggerOpen();
    secondConnection.triggerMessage(createReadyMessage({
      connectedAt: '2026-03-23T09:00:03.000Z',
      connectionId: 'conn-2',
    }));

    const secondSubscribeMessage = await waitFor(() => secondConnection.sentMessages.find(isSubMessage));
    assert.deepEqual(secondSubscribeMessage.topics, ['/system/#']);

    secondConnection.triggerMessage({
      requestId: secondSubscribeMessage.requestId,
      subscribedTopics: ['/system/#'],
      topics: ['/system/#'],
      type: 'sub:ack',
    });

    await waitFor(() => client.getState().connectionId === 'conn-2' ? client.getState() : undefined);
    assert.equal(client.getState().retryAttempt, 0);
    assert.deepEqual(client.getState().desiredTopics, ['/system/#']);
    assert.deepEqual(client.getState().serverTopics, ['/system/#']);

    client.disconnect();

    const closeCall = await waitFor(() => secondConnection.closeCalls[0]);
    assert.deepEqual(closeCall, {
      code: 1_000,
      reason: 'Client disconnect',
    });
    assert.equal(client.getState().status, 'idle');
  });
});
