import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import {
  REALTIME_TOPICS,
  dedupeWsSubscriptionTopics,
  isSameAuthClientIdentity,
  matchWsTopic,
  normalizeWsPublishTopic,
  normalizeWsSubscriptionTopic,
  REALTIME_SYNC_TARGETS,
  type AuditEventPayload,
  type LiveMessage,
  type PresenceChangedPayload,
  type RbacUpdatedPayload,
  type RealtimeSyncTarget,
  type RealtimeClientMessage,
  type RealtimeErrorMessage,
  type RealtimeReadyMessage,
  type RealtimeServerMessage,
} from '@rbac/api-common';
import { clientOrigins } from '../config/env';
import {
  authenticateOptionalHeadersClient,
  resolveAuthClientSummary,
} from '../services/auth-clients';
import {
  authorizeRealtimeTopicSubscriptions,
  handleRealtimeTopicsSubscribed,
  handleRealtimeTopicsUnsubscribed,
  type AuthorizedRealtimeTopicSubscription,
} from '../services/realtime-topic-auth';
import { notifyRealtimeTopicPublished } from '../topics';
import { getBrowserSessionCookieName } from '../utils/browser-session';
import { buildCurrentUser } from '../utils/rbac';
import { verifyAccessToken } from '../utils/token';

type RealtimeUser = Awaited<ReturnType<typeof buildCurrentUser>>;

type RealtimeConnectionContext = {
  client: Awaited<ReturnType<typeof resolveAuthClientSummary>>;
  connectedAt: string;
  id: string;
  lastSeenAt: number;
  socket: WebSocket;
  subscriptions: Set<string>;
  subscriptionRegistrations: Map<string, AuthorizedRealtimeTopicSubscription>;
  user: RealtimeUser;
};

const REALTIME_PATH = '/realtime/ws';
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const CLOSE_BAD_REQUEST = 4_400;
const CLOSE_HEARTBEAT_TIMEOUT = 4_010;

let wss: WebSocketServer | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

const connections = new Map<string, RealtimeConnectionContext>();
const connectionIdsByUserId = new Map<string, Set<string>>();
const connectionIdsByClientKey = new Map<string, Set<string>>();
const connectionIdsByUserAndClientKey = new Map<string, Map<string, Set<string>>>();
const connectionIdsBySubscriptionTopic = new Map<string, Set<string>>();

const toClientKey = (client: { id: string; code: string; type: string }) =>
  `${client.type}:${client.code}:${client.id}`;

const getConnectionIds = (map: Map<string, Set<string>>, key: string) => {
  const current = map.get(key);
  if (current) {
    return current;
  }

  const created = new Set<string>();
  map.set(key, created);
  return created;
};

const readCookieValue = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) {
    return null;
  }

  const targetPrefix = `${name}=`;
  const matched = cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(targetPrefix));

  if (!matched) {
    return null;
  }

  const [, value = ''] = matched.split('=');
  return decodeURIComponent(value);
};

const sendRealtimeMessage = <TPayload = unknown>(
  socket: WebSocket,
  message: RealtimeServerMessage<TPayload>,
) => {
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(message));
  return true;
};

const sendRealtimeError = (
  socket: WebSocket,
  payload: RealtimeErrorMessage,
) => {
  sendRealtimeMessage(socket, payload);
};

const attachIndexedReference = (map: Map<string, Set<string>>, key: string, connectionId: string) => {
  getConnectionIds(map, key).add(connectionId);
};

const detachIndexedReference = (map: Map<string, Set<string>>, key: string, connectionId: string) => {
  const current = map.get(key);
  if (!current) {
    return;
  }

  current.delete(connectionId);
  if (!current.size) {
    map.delete(key);
  }
};

const indexConnection = (context: RealtimeConnectionContext) => {
  attachIndexedReference(connectionIdsByUserId, context.user.id, context.id);

  const clientKey = toClientKey(context.client);
  attachIndexedReference(connectionIdsByClientKey, clientKey, context.id);

  const userClientMap = connectionIdsByUserAndClientKey.get(context.user.id) ?? new Map<string, Set<string>>();
  const userClientConnections = userClientMap.get(clientKey) ?? new Set<string>();
  userClientConnections.add(context.id);
  userClientMap.set(clientKey, userClientConnections);
  connectionIdsByUserAndClientKey.set(context.user.id, userClientMap);
};

const unindexConnection = (context: RealtimeConnectionContext) => {
  detachIndexedReference(connectionIdsByUserId, context.user.id, context.id);

  const clientKey = toClientKey(context.client);
  detachIndexedReference(connectionIdsByClientKey, clientKey, context.id);

  const userClientMap = connectionIdsByUserAndClientKey.get(context.user.id);
  const userClientConnections = userClientMap?.get(clientKey);
  userClientConnections?.delete(context.id);
  if (userClientConnections && !userClientConnections.size) {
    userClientMap?.delete(clientKey);
  }
  if (userClientMap && !userClientMap.size) {
    connectionIdsByUserAndClientKey.delete(context.user.id);
  }
};

const syncTopicReference = (
  map: Map<string, Set<string>>,
  topic: string,
  connectionId: string,
  mode: 'add' | 'delete',
) => {
  if (mode === 'add') {
    attachIndexedReference(map, topic, connectionId);
    return;
  }

  detachIndexedReference(map, topic, connectionId);
};

const subscribeTopics = async (context: RealtimeConnectionContext, topics: string[]) => {
  const normalizedTopics = dedupeWsSubscriptionTopics(topics);
  const pendingTopics = normalizedTopics.filter((topic) => !context.subscriptions.has(topic));
  if (!pendingTopics.length) {
    return normalizedTopics;
  }

  const authorizedSubscriptions = await authorizeRealtimeTopicSubscriptions({
    client: context.client,
    requestedTopic: '',
    user: context.user,
  }, pendingTopics);

  await handleRealtimeTopicsSubscribed({
    client: context.client,
    requestedTopic: '',
    user: context.user,
  }, authorizedSubscriptions);

  authorizedSubscriptions.forEach((subscription) => {
    context.subscriptions.add(subscription.requestedTopic);
    context.subscriptionRegistrations.set(subscription.requestedTopic, subscription);
    syncTopicReference(connectionIdsBySubscriptionTopic, subscription.requestedTopic, context.id, 'add');
  });

  return normalizedTopics;
};

const unsubscribeTopics = async (context: RealtimeConnectionContext, topics: string[]) => {
  const normalizedTopics = dedupeWsSubscriptionTopics(topics);
  const existingSubscriptions = normalizedTopics
    .filter((topic) => context.subscriptions.has(topic))
    .map((topic) => context.subscriptionRegistrations.get(topic) ?? {
      registration: null,
      requestedTopic: topic,
    });

  await handleRealtimeTopicsUnsubscribed({
    client: context.client,
    requestedTopic: '',
    user: context.user,
  }, existingSubscriptions);

  existingSubscriptions.forEach((subscription) => {
    context.subscriptions.delete(subscription.requestedTopic);
    context.subscriptionRegistrations.delete(subscription.requestedTopic);
    syncTopicReference(connectionIdsBySubscriptionTopic, subscription.requestedTopic, context.id, 'delete');
  });

  return normalizedTopics;
};

const clearConnectionTopics = (context: RealtimeConnectionContext) => {
  [...context.subscriptions].forEach((topic) => {
    syncTopicReference(connectionIdsBySubscriptionTopic, topic, context.id, 'delete');
  });
  context.subscriptions.clear();
  context.subscriptionRegistrations.clear();
};

const countUserConnections = (userId: string) => connectionIdsByUserId.get(userId)?.size ?? 0;

const publishRealtimeTopic = <TPayload = unknown>(topic: string, payload: TPayload) => {
  const normalizedTopic = normalizeWsPublishTopic(topic);
  const publishedAt = new Date().toISOString();
  const targetConnectionIds = new Set<string>();

  connectionIdsBySubscriptionTopic.forEach((connectionIds, subscriptionTopic) => {
    if (!matchWsTopic(normalizedTopic, subscriptionTopic)) {
      return;
    }

    connectionIds.forEach((connectionId) => {
      targetConnectionIds.add(connectionId);
    });
  });

  targetConnectionIds.forEach((connectionId) => {
    const context = connections.get(connectionId);
    if (!context) {
      return;
    }

    sendRealtimeMessage(context.socket, {
      type: 'message',
      payload,
      publishedAt,
      topic: normalizedTopic,
    });
  });

  notifyRealtimeTopicPublished({
    deliveredConnectionCount: targetConnectionIds.size,
    payload,
    publishedAt,
    topic: normalizedTopic,
  });

  return targetConnectionIds.size;
};

const closeSocket = (socket: WebSocket, code: number, reason: string) => {
  if (socket.readyState === socket.CLOSING || socket.readyState === socket.CLOSED) {
    return;
  }

  socket.close(code, reason);
};

const extractRealtimeToken = (request: IncomingMessage, url: URL) => {
  const headerValue = request.headers.authorization;
  if (typeof headerValue === 'string' && headerValue) {
    return headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;
  }

  const queryValue = url.searchParams.get('access_token');
  if (queryValue) {
    return queryValue;
  }

  return readCookieValue(
    typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
    getBrowserSessionCookieName(),
  );
};

const assertAllowedOrigin = (request: IncomingMessage) => {
  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  if (Array.isArray(origin) || !clientOrigins.includes(origin)) {
    throw new Error('Invalid client origin');
  }
};

const createReadyMessage = (context: RealtimeConnectionContext): RealtimeReadyMessage => ({
  client: {
    code: context.client.code,
    id: context.client.id,
    type: context.client.type,
  },
  connectedAt: context.connectedAt,
  connectionId: context.id,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
  topics: [...context.subscriptions].sort((left, right) => left.localeCompare(right, 'en')),
  type: 'ready',
  userId: context.user.id,
});

const cleanupConnection = (connectionId: string) => {
  const context = connections.get(connectionId);
  if (!context) {
    return;
  }

  connections.delete(connectionId);
  clearConnectionTopics(context);
  unindexConnection(context);

  if (countUserConnections(context.user.id) === 0) {
    const payload: PresenceChangedPayload = {
      at: new Date().toISOString(),
      nickname: context.user.nickname,
      status: 'offline',
      userId: context.user.id,
    };
    publishRealtimeTopic(REALTIME_TOPICS.presenceChanged, payload);
  }
};

export const getRealtimeConnectionSnapshot = () => ({
  totalConnections: connections.size,
  users: [...connectionIdsByUserId.entries()]
    .map(([userId, connectionIds]) => {
      const clientGroups = connectionIdsByUserAndClientKey.get(userId) ?? new Map<string, Set<string>>();

      return {
        clientGroups: [...clientGroups.entries()]
          .map(([clientKey, ids]) => ({
            clientKey,
            connectionIds: [...ids].sort((left, right) => left.localeCompare(right, 'en')),
            count: ids.size,
          }))
          .sort((left, right) => left.clientKey.localeCompare(right.clientKey, 'en')),
        connectionIds: [...connectionIds].sort((left, right) => left.localeCompare(right, 'en')),
        count: connectionIds.size,
        userId,
      };
    })
    .sort((left, right) => left.userId.localeCompare(right.userId, 'en')),
});

export const getConnectedRealtimeUserIds = () =>
  [...connectionIdsByUserId.keys()].sort((left, right) => left.localeCompare(right, 'en'));

const authenticateRealtimeRequest = async (request: IncomingMessage, url: URL) => {
  assertAllowedOrigin(request);

  const token = extractRealtimeToken(request, url);
  if (!token) {
    throw new Error('Missing access token');
  }

  const payload = verifyAccessToken(token);
  if (payload.type !== 'access') {
    throw new Error('Invalid access token');
  }

  const declaredClient = await authenticateOptionalHeadersClient(request.headers);
  if (declaredClient && !isSameAuthClientIdentity(payload.client, declaredClient)) {
    throw new Error('Access token client mismatch');
  }

  const [user, resolvedClient] = await Promise.all([
    buildCurrentUser(payload.sub),
    declaredClient ? Promise.resolve(declaredClient) : resolveAuthClientSummary(payload.client),
  ]);

  if (user.status !== 'ACTIVE') {
    throw new Error('Account disabled');
  }

  return {
    client: resolvedClient,
    user,
  };
};

const startHeartbeat = () => {
  if (heartbeatTimer) {
    return;
  }

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    connections.forEach((context) => {
      if (now - context.lastSeenAt > HEARTBEAT_TIMEOUT_MS) {
        closeSocket(context.socket, CLOSE_HEARTBEAT_TIMEOUT, 'Heartbeat timeout');
        return;
      }

      sendRealtimeMessage(context.socket, {
        at: new Date().toISOString(),
        type: 'ping',
      });
    });
  }, HEARTBEAT_INTERVAL_MS);
};

const stopHeartbeat = () => {
  if (!heartbeatTimer) {
    return;
  }

  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

const handleRealtimeMessage = async (context: RealtimeConnectionContext, data: RawData) => {
  context.lastSeenAt = Date.now();

  let message: RealtimeClientMessage;
  try {
    message = JSON.parse(data.toString()) as RealtimeClientMessage;
  } catch {
    sendRealtimeError(context.socket, {
      code: 'BAD_JSON',
      message: 'Realtime payload must be valid JSON',
      type: 'error',
    });
    closeSocket(context.socket, CLOSE_BAD_REQUEST, 'Invalid realtime payload');
    return;
  }

  if (message.type === 'pong') {
    return;
  }

  if (message.type === 'sub') {
    try {
      const subscribedTopics = await subscribeTopics(context, message.topics.map((topic) => normalizeWsSubscriptionTopic(topic)));
      sendRealtimeMessage(context.socket, {
        requestId: message.requestId,
        subscribedTopics,
        topics: [...context.subscriptions].sort((left, right) => left.localeCompare(right, 'en')),
        type: 'sub:ack',
      });
    } catch (error) {
      sendRealtimeError(context.socket, {
        code: 'SUBSCRIBE_REJECTED',
        message: error instanceof Error ? error.message : 'Failed to subscribe',
        requestId: message.requestId,
        type: 'error',
      });
    }
    return;
  }

  if (message.type === 'unsub') {
    try {
      const unsubscribedTopics = await unsubscribeTopics(context, message.topics.map((topic) => normalizeWsSubscriptionTopic(topic)));
      sendRealtimeMessage(context.socket, {
        requestId: message.requestId,
        topics: [...context.subscriptions].sort((left, right) => left.localeCompare(right, 'en')),
        type: 'unsub:ack',
        unsubscribedTopics,
      });

      if (!context.subscriptions.size) {
        closeSocket(context.socket, 1_000, 'No subscriptions');
      }
    } catch (error) {
      sendRealtimeError(context.socket, {
        code: 'UNSUBSCRIBE_REJECTED',
        message: error instanceof Error ? error.message : 'Failed to unsubscribe',
        requestId: message.requestId,
        type: 'error',
      });
    }
  }
};

export const initSocket = (server: HttpServer) => {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({
    noServer: true,
  });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? REALTIME_PATH, `http://${request.headers.host ?? 'localhost'}`);
    if (requestUrl.pathname !== REALTIME_PATH) {
      socket.destroy();
      return;
    }

    void authenticateRealtimeRequest(request, requestUrl)
      .then(({ client, user }) => {
        wss?.handleUpgrade(request, socket, head, (websocket) => {
          const context: RealtimeConnectionContext = {
            client,
            connectedAt: new Date().toISOString(),
            id: randomUUID(),
            lastSeenAt: Date.now(),
            socket: websocket,
            subscriptions: new Set<string>(),
            subscriptionRegistrations: new Map<string, AuthorizedRealtimeTopicSubscription>(),
            user,
          };

          connections.set(context.id, context);
          indexConnection(context);

          websocket.on('message', (data) => {
            void handleRealtimeMessage(context, data);
          });

          websocket.on('close', () => {
            cleanupConnection(context.id);
          });

          websocket.on('error', () => {
            cleanupConnection(context.id);
          });

          sendRealtimeMessage(websocket, createReadyMessage(context));

          if (countUserConnections(user.id) === 1) {
            const payload: PresenceChangedPayload = {
              at: new Date().toISOString(),
              nickname: user.nickname,
              status: 'online',
              userId: user.id,
            };
            publishRealtimeTopic(REALTIME_TOPICS.presenceChanged, payload);
          }
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unauthorized';
        socket.write(
          'HTTP/1.1 401 Unauthorized\r\n'
          + 'Connection: close\r\n'
          + 'Content-Type: application/json\r\n'
          + '\r\n'
          + JSON.stringify({ message }),
        );
        socket.destroy();
      });
  });

  startHeartbeat();
  return wss;
};

export const closeSocketServer = async () => {
  stopHeartbeat();

  connections.forEach((context) => {
    closeSocket(context.socket, 1_000, 'Server shutdown');
  });
  connections.clear();
  connectionIdsByUserId.clear();
  connectionIdsByClientKey.clear();
  connectionIdsByUserAndClientKey.clear();
  connectionIdsBySubscriptionTopic.clear();

  if (!wss) {
    return;
  }

  const activeServer = wss;
  wss = null;
  await new Promise<void>((resolve) => {
    activeServer.close(() => resolve());
  });
};

export const emitAuditEvent = (payload: {
  action: string;
  actor: string;
  createdAt?: string;
  target: string;
}) => {
  const normalizedPayload: AuditEventPayload = {
    ...payload,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  };
  return publishRealtimeTopic(REALTIME_TOPICS.auditEvent, normalizedPayload);
};

export const emitRbacUpdated = (
  userIds: string[],
  input: string | {
    reason: string;
    targets?: RealtimeSyncTarget[];
  },
) => {
  const normalizedInput = typeof input === 'string'
    ? {
        reason: input,
        targets: [...REALTIME_SYNC_TARGETS],
      }
    : {
        reason: input.reason,
        targets: input.targets?.length ? [...new Set(input.targets)] : [...REALTIME_SYNC_TARGETS],
      };

  userIds.forEach((userId) => {
    const payload: RbacUpdatedPayload = {
      at: new Date().toISOString(),
      reason: normalizedInput.reason,
      targets: normalizedInput.targets,
    };
    publishRealtimeTopic(REALTIME_TOPICS.userRbacUpdated(userId), payload);
  });
};

export const emitChatMessage = (message: LiveMessage) =>
  publishRealtimeTopic(REALTIME_TOPICS.chatGlobalMessage, message);

export const publishRealtimeMessage = <TPayload = unknown>(topic: string, payload: TPayload) =>
  publishRealtimeTopic(topic, payload);
