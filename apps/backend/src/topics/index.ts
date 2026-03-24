import {
  matchWsTopic,
  normalizeWsPublishTopic,
  normalizeWsSubscriptionTopic,
} from '@rbac/api-common';
import { auditRealtimeTopicRegistrations } from './audit';
import { chatRealtimeTopicRegistrations } from './chat';
import { presenceRealtimeTopicRegistrations } from './presence';
import { rbacRealtimeTopicRegistrations } from './rbac';
import type {
  RealtimeTopicCatalogItem,
  RealtimeTopicPublishContext,
  RealtimeTopicRegistration,
  RealtimeTopicSubscriptionContext,
} from './types';

const normalizeRegistration = (
  registration: RealtimeTopicRegistration,
): RealtimeTopicRegistration => ({
  ...registration,
  topicPattern: normalizeWsSubscriptionTopic(registration.topicPattern),
});

export const realtimeTopicRegistrations = [
  ...auditRealtimeTopicRegistrations,
  ...chatRealtimeTopicRegistrations,
  ...presenceRealtimeTopicRegistrations,
  ...rbacRealtimeTopicRegistrations,
].map(normalizeRegistration);

const realtimeTopicRegistrationByCode = new Map(
  realtimeTopicRegistrations.map((registration) => [registration.code, registration] as const),
);

export const systemRealtimeTopicCatalog: RealtimeTopicCatalogItem[] = realtimeTopicRegistrations.map((registration) => ({
  code: registration.code,
  description: registration.description,
  name: registration.name,
  permissionCode: registration.permissionCode,
  topicPattern: registration.topicPattern,
}));

export const getRealtimeTopicRegistration = (code: string) =>
  realtimeTopicRegistrationByCode.get(code) ?? null;

const runLifecycleHandler = async (
  handler: ((context: RealtimeTopicSubscriptionContext) => Promise<void> | void) | undefined,
  context: RealtimeTopicSubscriptionContext,
) => {
  if (!handler) {
    return;
  }

  await handler(context);
};

const emitHandlerError = (scope: string, code: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[realtime-topics] ${scope} handler failed for ${code}: ${message}`);
};

export const runRealtimeTopicSubscribedHook = async (
  registration: RealtimeTopicRegistration | null,
  context: RealtimeTopicSubscriptionContext,
) => {
  if (!registration) {
    return;
  }

  await runLifecycleHandler(registration.onSubscribed, context);
};

export const runRealtimeTopicUnsubscribedHook = async (
  registration: RealtimeTopicRegistration | null,
  context: RealtimeTopicSubscriptionContext,
) => {
  if (!registration) {
    return;
  }

  await runLifecycleHandler(registration.onUnsubscribed, context);
};

export const notifyRealtimeTopicPublished = (
  context: RealtimeTopicPublishContext,
) => {
  const normalizedTopic = normalizeWsPublishTopic(context.topic);

  realtimeTopicRegistrations.forEach((registration) => {
    if (!registration.onPublished || !matchWsTopic(normalizedTopic, registration.topicPattern)) {
      return;
    }

    void Promise.resolve(registration.onPublished({
      ...context,
      topic: normalizedTopic,
    })).catch((error) => {
      emitHandlerError('publish', registration.code, error);
    });
  });
};

