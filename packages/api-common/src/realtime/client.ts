import type { AuthClientIdentity } from '../types/auth-client';
import type {
  RealtimeClientMessage,
  RealtimeErrorMessage,
  RealtimeReadyMessage,
  RealtimeServerMessage,
  RealtimeTopicMessage,
} from './protocol';
import { matchWsTopic, normalizeWsPublishTopic, normalizeWsSubscriptionTopic, sortWsTopics } from './topic';

export type WsClientStatus = 'connecting' | 'idle' | 'open' | 'reconnecting';

export interface WsConnectCloseEvent {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface WsConnectOptions {
  url: string;
  headers?: Record<string, string>;
  protocols?: string[];
  onClose: (event: WsConnectCloseEvent) => void;
  onError: (error: unknown) => void;
  onMessage: (data: string) => void;
  onOpen: () => void;
}

export interface WsSocketConnection {
  close(code?: number, reason?: string): void;
  send(data: string): Promise<void>;
}

export interface WsAdaptor {
  connect(options: WsConnectOptions): WsSocketConnection;
}

type AccessTokenTransport = 'both' | 'header' | 'none' | 'query';

type Waiter = {
  expectPresent: boolean;
  reject: (error: Error) => void;
  resolve: (state: WsClientStateSnapshot) => void;
  topics: string[];
};

type PendingSyncOperation = {
  requestId: string;
  topics: string[];
  type: 'sub' | 'unsub';
};

export interface WsTopicEvent<TPayload = unknown> {
  payload: TPayload;
  publishedAt: string;
  topic: string;
}

export type WsTopicHandler<TPayload = unknown> = (event: WsTopicEvent<TPayload>) => void;

export interface WsReconnectBackoffOptions {
  initialDelayMs: number;
  jitterRatio: number;
  maxDelayMs: number;
  multiplier: number;
}

export interface WsClientOptions {
  accessTokenQueryKey?: string;
  accessTokenTransport?: AccessTokenTransport;
  adaptor: WsAdaptor;
  backoff?: Partial<WsReconnectBackoffOptions>;
  getAccessToken?: () => string | null | undefined;
  getConnectHeaders?: () => Record<string, string> | undefined;
  getConnectParams?: () => Record<string, string | number | boolean | null | undefined> | undefined;
  onError?: (error: Error) => void;
  protocols?: string[];
  url: string;
}

export interface WsClientStateSnapshot {
  client: AuthClientIdentity | null;
  connectedAt: string | null;
  connectionId: string | null;
  desiredTopics: string[];
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  lastActivityAt: number | null;
  retryAttempt: number;
  serverTopics: string[];
  status: WsClientStatus;
  userId: string | null;
}

const DEFAULT_BACKOFF: WsReconnectBackoffOptions = {
  initialDelayMs: 1_000,
  jitterRatio: 0.2,
  maxDelayMs: 30_000,
  multiplier: 2,
};

const FATAL_CLOSE_CODES = new Set([4_001, 4_003, 4_400]);

const resolveRandomId = () => {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildWsUrl = (
  baseUrl: string,
  params: Record<string, string | number | boolean | null | undefined>,
) => {
  const fallbackBase = typeof location !== 'undefined' ? location.origin : 'http://localhost';
  const url = new URL(baseUrl, fallbackBase);

  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      url.searchParams.delete(key);
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
};

const toError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

const parseServerMessage = (value: string) => JSON.parse(value) as RealtimeServerMessage;

export const createWsClient = (options: WsClientOptions) => {
  const backoff = {
    ...DEFAULT_BACKOFF,
    ...(options.backoff ?? {}),
  };
  const accessTokenQueryKey = options.accessTokenQueryKey ?? 'access_token';
  const accessTokenTransport = options.accessTokenTransport ?? 'query';
  const desiredTopicRefs = new Map<string, number>();
  const serverTopics = new Set<string>();
  const topicHandlers = new Map<string, Set<WsTopicHandler>>();
  const stateListeners = new Set<(state: WsClientStateSnapshot) => void>();
  const waiters = new Set<Waiter>();
  let socket: WsSocketConnection | null = null;
  let socketReady = false;
  let status: WsClientStatus = 'idle';
  let retryAttempt = 0;
  let lastActivityAt: number | null = null;
  let heartbeatIntervalMs = 20_000;
  let heartbeatTimeoutMs = 60_000;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionId: string | null = null;
  let connectedAt: string | null = null;
  let userId: string | null = null;
  let client: AuthClientIdentity | null = null;
  let pendingOperation: PendingSyncOperation | null = null;

  const emitError = (error: unknown) => {
    options.onError?.(toError(error));
  };

  const getDesiredTopics = () =>
    [...desiredTopicRefs.entries()]
      .filter(([, count]) => count > 0)
      .map(([topic]) => topic)
      .sort((left, right) => left.localeCompare(right, 'en'));

  const getState = (): WsClientStateSnapshot => ({
    client,
    connectedAt,
    connectionId,
    desiredTopics: getDesiredTopics(),
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
    lastActivityAt,
    retryAttempt,
    serverTopics: sortWsTopics(serverTopics),
    status,
    userId,
  });

  const notifyState = () => {
    const snapshot = getState();
    stateListeners.forEach((listener) => listener(snapshot));
  };

  const clearReconnectTimer = () => {
    if (!reconnectTimer) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const stopHeartbeatTimer = () => {
    if (!heartbeatTimer) {
      return;
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const closeSocket = (code?: number, reason?: string) => {
    clearReconnectTimer();
    stopHeartbeatTimer();

    if (!socket) {
      socketReady = false;
      status = 'idle';
      notifyState();
      return;
    }

    const activeSocket = socket;
    socket = null;
    socketReady = false;
    activeSocket.close(code, reason);
  };

  const rejectWaiters = (error: Error, predicate?: (waiter: Waiter) => boolean) => {
    [...waiters].forEach((waiter) => {
      if (predicate && !predicate(waiter)) {
        return;
      }

      waiters.delete(waiter);
      waiter.reject(error);
    });
  };

  const resolveWaiters = () => {
    const state = getState();
    [...waiters].forEach((waiter) => {
      const matched = waiter.expectPresent
        ? waiter.topics.every((topic) => serverTopics.has(topic))
        : waiter.topics.every((topic) => !serverTopics.has(topic));

      if (!matched) {
        return;
      }

      waiters.delete(waiter);
      waiter.resolve(state);
    });
  };

  const sendMessage = async (message: RealtimeClientMessage) => {
    if (!socket || !socketReady) {
      return;
    }

    await socket.send(JSON.stringify(message));
  };

  const syncDesiredTopics = async () => {
    if (!socket || !socketReady || pendingOperation) {
      return;
    }

    const desiredTopics = getDesiredTopics();

    const topicsToSubscribe = desiredTopics.filter((topic) => !serverTopics.has(topic));
    if (topicsToSubscribe.length) {
      const requestId = resolveRandomId();
      pendingOperation = {
        requestId,
        topics: topicsToSubscribe,
        type: 'sub',
      };
      await sendMessage({
        type: 'sub',
        requestId,
        topics: topicsToSubscribe,
      });
      notifyState();
      return;
    }

    const topicsToUnsubscribe = [...serverTopics].filter((topic) => !desiredTopics.includes(topic));
    if (topicsToUnsubscribe.length) {
      const requestId = resolveRandomId();
      pendingOperation = {
        requestId,
        topics: topicsToUnsubscribe,
        type: 'unsub',
      };
      await sendMessage({
        type: 'unsub',
        requestId,
        topics: topicsToUnsubscribe,
      });
      notifyState();
      return;
    }

    if (!desiredTopics.length) {
      closeSocket(1_000, 'No realtime topics');
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer || !getDesiredTopics().length) {
      return;
    }

    retryAttempt += 1;
    status = 'reconnecting';
    notifyState();

    const baseDelay = Math.min(
      backoff.initialDelayMs * (backoff.multiplier ** Math.max(retryAttempt - 1, 0)),
      backoff.maxDelayMs,
    );
    const jitterWindow = Math.round(baseDelay * backoff.jitterRatio);
    const jitterOffset = jitterWindow
      ? Math.round((Math.random() * (jitterWindow * 2)) - jitterWindow)
      : 0;
    const delay = Math.max(baseDelay + jitterOffset, backoff.initialDelayMs);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const handleReadyMessage = async (message: RealtimeReadyMessage) => {
    socketReady = true;
    retryAttempt = 0;
    connectionId = message.connectionId;
    connectedAt = message.connectedAt;
    userId = message.userId;
    client = message.client;
    heartbeatIntervalMs = message.heartbeatIntervalMs;
    heartbeatTimeoutMs = message.heartbeatTimeoutMs;
    serverTopics.clear();
    message.topics.forEach((topic) => {
      serverTopics.add(normalizeWsSubscriptionTopic(topic));
    });
    notifyState();
    resolveWaiters();

    stopHeartbeatTimer();
    heartbeatTimer = setInterval(() => {
      if (!socket) {
        return;
      }

      if (lastActivityAt !== null && Date.now() - lastActivityAt > heartbeatTimeoutMs) {
        closeSocket(4_010, 'Heartbeat timeout');
      }
    }, Math.max(Math.floor(heartbeatIntervalMs / 2), 5_000));

    await syncDesiredTopics();
  };

  const handleTopicMessage = (message: RealtimeTopicMessage) => {
    const normalizedTopic = normalizeWsPublishTopic(message.topic);
    topicHandlers.forEach((handlers, topicPattern) => {
      if (!matchWsTopic(normalizedTopic, topicPattern)) {
        return;
      }

      handlers.forEach((handler) => {
        try {
          handler({
            payload: message.payload,
            publishedAt: message.publishedAt,
            topic: normalizedTopic,
          });
        } catch (error) {
          emitError(error);
        }
      });
    });
  };

  const handleErrorMessage = (message: RealtimeErrorMessage) => {
    emitError(new Error(message.message));

    if (!pendingOperation || pendingOperation.requestId !== message.requestId) {
      return;
    }

    const failedOperation = pendingOperation;
    pendingOperation = null;
    rejectWaiters(new Error(message.message), (waiter) =>
      waiter.expectPresent === (failedOperation.type === 'sub')
      && waiter.topics.every((topic) => failedOperation.topics.includes(topic)),
    );
    notifyState();
  };

  const handleClose = (event: WsConnectCloseEvent) => {
    socket = null;
    socketReady = false;
    pendingOperation = null;
    stopHeartbeatTimer();
    serverTopics.clear();
    connectionId = null;
    connectedAt = null;
    lastActivityAt = null;
    userId = null;
    client = null;
    notifyState();
    resolveWaiters();

    if (getDesiredTopics().length === 0) {
      status = 'idle';
      notifyState();
      return;
    }

    if (event.code && FATAL_CLOSE_CODES.has(event.code)) {
      status = 'idle';
      rejectWaiters(new Error(event.reason || 'Realtime connection closed'));
      notifyState();
      return;
    }

    scheduleReconnect();
  };

  const connect = async () => {
    clearReconnectTimer();

    const desiredTopics = getDesiredTopics();
    if (!desiredTopics.length) {
      status = 'idle';
      notifyState();
      return;
    }

    if (socket) {
      return;
    }

    const accessToken = options.getAccessToken?.() ?? null;
    const connectHeaders = {
      ...(options.getConnectHeaders?.() ?? {}),
    };

    if ((accessTokenTransport === 'both' || accessTokenTransport === 'header') && accessToken) {
      connectHeaders.Authorization = `Bearer ${accessToken}`;
    }

    const connectParams = {
      ...(options.getConnectParams?.() ?? {}),
      ...(
        (accessTokenTransport === 'both' || accessTokenTransport === 'query') && accessToken
          ? { [accessTokenQueryKey]: accessToken }
          : {}
      ),
    };

    status = retryAttempt > 0 ? 'reconnecting' : 'connecting';
    notifyState();

    socket = options.adaptor.connect({
      headers: Object.keys(connectHeaders).length ? connectHeaders : undefined,
      onClose: handleClose,
      onError: emitError,
      onMessage: (data) => {
        lastActivityAt = Date.now();
        notifyState();

        let message: RealtimeServerMessage;
        try {
          message = parseServerMessage(data);
        } catch (error) {
          emitError(error);
          return;
        }

        if (message.type === 'ping') {
          void sendMessage({
            type: 'pong',
            at: message.at,
          });
          return;
        }

        if (message.type === 'ready') {
          void handleReadyMessage(message);
          status = 'open';
          notifyState();
          return;
        }

        if (message.type === 'message') {
          handleTopicMessage(message);
          return;
        }

        if (message.type === 'error') {
          handleErrorMessage(message);
          return;
        }

        if (message.type === 'sub:ack' || message.type === 'unsub:ack') {
          if (pendingOperation?.requestId === message.requestId) {
            pendingOperation = null;
          }
          serverTopics.clear();
          message.topics.forEach((topic) => {
            serverTopics.add(normalizeWsSubscriptionTopic(topic));
          });
          notifyState();
          resolveWaiters();
          void syncDesiredTopics();
        }
      },
      onOpen: () => {
        lastActivityAt = Date.now();
        status = 'open';
        notifyState();
      },
      protocols: options.protocols,
      url: buildWsUrl(options.url, connectParams),
    });
  };

  const adjustTopicReferences = (topics: string[], delta: 1 | -1) => {
    topics.forEach((topic) => {
      const currentValue = desiredTopicRefs.get(topic) ?? 0;
      const nextValue = Math.max(currentValue + delta, 0);

      if (nextValue === 0) {
        desiredTopicRefs.delete(topic);
        return;
      }

      desiredTopicRefs.set(topic, nextValue);
    });
  };

  const waitForTopics = (topics: string[], expectPresent: boolean) =>
    new Promise<WsClientStateSnapshot>((resolve, reject) => {
      const waiter: Waiter = {
        expectPresent,
        reject,
        resolve,
        topics,
      };
      waiters.add(waiter);
      resolveWaiters();
    });

  const api = {
    connect: () => connect(),
    disconnect: () => {
      desiredTopicRefs.clear();
      rejectWaiters(new Error('Realtime connection closed by client'));
      closeSocket(1_000, 'Client disconnect');
    },
    getState,
    onTopic<TPayload = unknown>(topic: string, handler: WsTopicHandler<TPayload>) {
      const normalizedTopic = normalizeWsSubscriptionTopic(topic);
      const handlers = topicHandlers.get(normalizedTopic) ?? new Set<WsTopicHandler>();
      handlers.add(handler as WsTopicHandler);
      topicHandlers.set(normalizedTopic, handlers);
      void api.subscribe(normalizedTopic).catch((error) => emitError(error));

      return () => {
        const registeredHandlers = topicHandlers.get(normalizedTopic);
        if (!registeredHandlers) {
          return;
        }

        registeredHandlers.delete(handler as WsTopicHandler);
        if (!registeredHandlers.size) {
          topicHandlers.delete(normalizedTopic);
        }

        void api.unsubscribe(normalizedTopic).catch((error) => emitError(error));
      };
    },
    subscribe: async (topicInput: string | string[]) => {
      const topics = [...new Set(Array.isArray(topicInput) ? topicInput : [topicInput])];
      const normalizedTopics = topics.map((topic) => normalizeWsSubscriptionTopic(topic));
      adjustTopicReferences(normalizedTopics, 1);
      notifyState();
      await connect();
      void syncDesiredTopics();
      return waitForTopics(normalizedTopics, true);
    },
    unsubscribe: async (topicInput: string | string[]) => {
      const topics = [...new Set(Array.isArray(topicInput) ? topicInput : [topicInput])];
      const normalizedTopics = topics.map((topic) => normalizeWsSubscriptionTopic(topic));
      adjustTopicReferences(normalizedTopics, -1);
      notifyState();
      void syncDesiredTopics();

      if (!getDesiredTopics().length && !serverTopics.size) {
        closeSocket(1_000, 'No realtime topics');
      }

      return waitForTopics(normalizedTopics, false);
    },
    watchState(listener: (state: WsClientStateSnapshot) => void) {
      stateListeners.add(listener);
      listener(getState());
      return () => {
        stateListeners.delete(listener);
      };
    },
  };

  return api;
};
