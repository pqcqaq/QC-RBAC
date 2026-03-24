import type { AuthClientSummary, CurrentUser } from '@rbac/api-common';

export type RealtimeTopicPublishContext<TPayload = unknown> = {
  deliveredConnectionCount: number;
  payload: TPayload;
  publishedAt: string;
  topic: string;
};

export type RealtimeTopicSubscriptionContext = {
  client: AuthClientSummary;
  requestedTopic: string;
  user: CurrentUser;
};

export type RealtimeTopicCatalogItem = {
  code: string;
  description?: string;
  name: string;
  permissionCode: string;
  topicPattern: string;
};

export type RealtimeTopicRegistration = RealtimeTopicCatalogItem & {
  authorizeSubscription?: (context: RealtimeTopicSubscriptionContext) => Promise<void> | void;
  onPublished?: (context: RealtimeTopicPublishContext) => Promise<void> | void;
  onSubscribed?: (context: RealtimeTopicSubscriptionContext) => Promise<void> | void;
  onUnsubscribed?: (context: RealtimeTopicSubscriptionContext) => Promise<void> | void;
};

