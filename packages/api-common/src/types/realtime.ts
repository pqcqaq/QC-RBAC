import type { AuthClientIdentity } from './auth-client';
import type { LiveMessage } from './rbac';

export const REALTIME_TOPICS = {
  auditEvent: '/system/audit/event',
  chatGlobalMessage: '/chat/global/message',
  presenceChanged: '/system/presence/changed',
  userRbacUpdated: (userId: string) => `/system/users/${userId}/rbac-updated`,
} as const;

export const REALTIME_SYNC_TARGETS = ['menus', 'user'] as const;
export type RealtimeSyncTarget = (typeof REALTIME_SYNC_TARGETS)[number];

export interface PresenceChangedPayload {
  userId: string;
  nickname: string;
  status: 'online' | 'offline';
  at: string;
}

export interface AuditEventPayload {
  action: string;
  actor: string;
  target: string;
  createdAt: string;
}

export interface RbacUpdatedPayload {
  reason: string;
  at: string;
  targets: RealtimeSyncTarget[];
}

export interface RealtimeConnectionSnapshot {
  connectionId: string;
  userId: string;
  client: AuthClientIdentity;
  topics: string[];
  connectedAt: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
}

export interface RealtimePublishEnvelope<TPayload = unknown> {
  topic: string;
  payload: TPayload;
  publishedAt: string;
}

export type RealtimeKnownPayload =
  | AuditEventPayload
  | LiveMessage
  | PresenceChangedPayload
  | RbacUpdatedPayload;
