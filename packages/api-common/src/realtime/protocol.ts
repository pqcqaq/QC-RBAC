import type { AuthClientIdentity } from '../types/auth-client';

export interface RealtimeReadyMessage {
  type: 'ready';
  connectionId: string;
  userId: string;
  client: AuthClientIdentity;
  topics: string[];
  connectedAt: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
}

export interface RealtimeSubscribeMessage {
  type: 'sub';
  requestId: string;
  topics: string[];
}

export interface RealtimeUnsubscribeMessage {
  type: 'unsub';
  requestId: string;
  topics: string[];
}

export interface RealtimeSubscribeAckMessage {
  type: 'sub:ack';
  requestId: string;
  subscribedTopics: string[];
  topics: string[];
}

export interface RealtimeUnsubscribeAckMessage {
  type: 'unsub:ack';
  requestId: string;
  unsubscribedTopics: string[];
  topics: string[];
}

export interface RealtimeTopicMessage<TPayload = unknown> {
  type: 'message';
  topic: string;
  payload: TPayload;
  publishedAt: string;
}

export interface RealtimePingMessage {
  type: 'ping';
  at: string;
}

export interface RealtimePongMessage {
  type: 'pong';
  at: string;
}

export interface RealtimeErrorMessage {
  type: 'error';
  code: string;
  message: string;
  requestId?: string;
}

export type RealtimeClientMessage =
  | RealtimePongMessage
  | RealtimeSubscribeMessage
  | RealtimeUnsubscribeMessage;

export type RealtimeServerMessage<TPayload = unknown> =
  | RealtimeErrorMessage
  | RealtimePingMessage
  | RealtimeReadyMessage
  | RealtimeSubscribeAckMessage
  | RealtimeTopicMessage<TPayload>
  | RealtimeUnsubscribeAckMessage;
