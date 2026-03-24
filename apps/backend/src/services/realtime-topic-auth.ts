import { coversWsSubscriptionTopic, dedupeWsSubscriptionTopics } from '@rbac/api-common';
import { prisma } from '../lib/prisma';
import { cacheDel, cacheGet, cacheSet } from '../lib/redis';
import {
  getRealtimeTopicRegistration,
  runRealtimeTopicSubscribedHook,
  runRealtimeTopicUnsubscribedHook,
} from '../topics';
import type {
  RealtimeTopicRegistration,
  RealtimeTopicSubscriptionContext,
} from '../topics/types';
import { getUserPermissionCodes } from '../utils/rbac';

type PersistedRealtimeTopicBinding = {
  code: string;
  description: string | null;
  name: string;
  permissionCode: string;
  topicPattern: string;
};

export type AuthorizedRealtimeTopicSubscription = {
  registration: RealtimeTopicRegistration | null;
  requestedTopic: string;
};

const REALTIME_TOPIC_CACHE_TTL_SECONDS = 300;
const REALTIME_TOPIC_VERSION_TTL_SECONDS = 86_400;
const REALTIME_TOPIC_VERSION_CACHE_KEY = 'realtime-topic-auth:version';

const buildRealtimeTopicRegistryCacheKey = (version: string) =>
  `realtime-topic-auth:registry:${version}`;

const buildRealtimeTopicUserCacheKey = (version: string, userId: string) =>
  `realtime-topic-auth:user:${version}:${userId}`;

const readRealtimeTopicAuthVersion = async () => {
  const cached = await cacheGet(REALTIME_TOPIC_VERSION_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const created = String(Date.now());
  await cacheSet(REALTIME_TOPIC_VERSION_CACHE_KEY, created, REALTIME_TOPIC_VERSION_TTL_SECONDS);
  return created;
};

const loadPersistedRealtimeTopicBindings = async () => {
  const rows = await prisma.realtimeTopic.findMany({
    where: {
      deleteAt: null,
      permission: {
        deleteAt: null,
      },
    },
    select: {
      code: true,
      description: true,
      name: true,
      permission: {
        select: {
          code: true,
        },
      },
      topicPattern: true,
    },
  });

  return rows.map((row) => ({
    code: row.code,
    description: row.description ?? null,
    name: row.name,
    permissionCode: row.permission.code,
    topicPattern: row.topicPattern,
  })) satisfies PersistedRealtimeTopicBinding[];
};

const getPersistedRealtimeTopicBindings = async () => {
  const version = await readRealtimeTopicAuthVersion();
  const cacheKey = buildRealtimeTopicRegistryCacheKey(version);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PersistedRealtimeTopicBinding[];
  }

  const bindings = await loadPersistedRealtimeTopicBindings();
  await cacheSet(cacheKey, JSON.stringify(bindings), REALTIME_TOPIC_CACHE_TTL_SECONDS);
  return bindings;
};

const getUserRealtimeTopicBindings = async (userId: string) => {
  const version = await readRealtimeTopicAuthVersion();
  const cacheKey = buildRealtimeTopicUserCacheKey(version, userId);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PersistedRealtimeTopicBinding[];
  }

  const [bindings, permissionCodes] = await Promise.all([
    getPersistedRealtimeTopicBindings(),
    getUserPermissionCodes(userId),
  ]);
  const permissionCodeSet = new Set(permissionCodes);
  const authorizedBindings = bindings.filter((binding) => permissionCodeSet.has(binding.permissionCode));
  await cacheSet(cacheKey, JSON.stringify(authorizedBindings), REALTIME_TOPIC_CACHE_TTL_SECONDS);
  return authorizedBindings;
};

export const invalidateRealtimeTopicRegistryCache = async () => {
  await cacheSet(
    REALTIME_TOPIC_VERSION_CACHE_KEY,
    String(Date.now()),
    REALTIME_TOPIC_VERSION_TTL_SECONDS,
  );
};

export const invalidateRealtimeTopicAccessCache = async (userIds: string[]) => {
  if (!userIds.length) {
    return;
  }

  const version = await readRealtimeTopicAuthVersion();
  await cacheDel(...userIds.map((userId) => buildRealtimeTopicUserCacheKey(version, userId)));
};

export const authorizeRealtimeTopicSubscriptions = async (
  context: RealtimeTopicSubscriptionContext,
  topics: string[],
) => {
  const requestedTopics = dedupeWsSubscriptionTopics(topics);
  const authorizedBindings = await getUserRealtimeTopicBindings(context.user.id);
  const subscriptions: AuthorizedRealtimeTopicSubscription[] = [];

  for (const requestedTopic of requestedTopics) {
    const matchingBindings = authorizedBindings.filter((binding) =>
      coversWsSubscriptionTopic(binding.topicPattern, requestedTopic)
    );
    if (!matchingBindings.length) {
      throw new Error(`Missing topic subscription permission: ${requestedTopic}`);
    }

    let matchedRegistration: RealtimeTopicRegistration | null = null;
    let rejectionMessage: string | null = null;

    for (const binding of matchingBindings) {
      const registration = getRealtimeTopicRegistration(binding.code);
      try {
        if (registration?.authorizeSubscription) {
          await registration.authorizeSubscription({
            ...context,
            requestedTopic,
          });
        }
        matchedRegistration = registration;
        break;
      } catch (error) {
        rejectionMessage = error instanceof Error ? error.message : 'Topic subscription rejected';
      }
    }

    if (!matchedRegistration && matchingBindings.every((binding) => getRealtimeTopicRegistration(binding.code))) {
      throw new Error(rejectionMessage ?? `Topic subscription rejected: ${requestedTopic}`);
    }

    subscriptions.push({
      registration: matchedRegistration,
      requestedTopic,
    });
  }

  return subscriptions;
};

export const handleRealtimeTopicsSubscribed = async (
  context: RealtimeTopicSubscriptionContext,
  subscriptions: AuthorizedRealtimeTopicSubscription[],
) => {
  for (const subscription of subscriptions) {
    await runRealtimeTopicSubscribedHook(subscription.registration, {
      ...context,
      requestedTopic: subscription.requestedTopic,
    });
  }
};

export const handleRealtimeTopicsUnsubscribed = async (
  context: RealtimeTopicSubscriptionContext,
  subscriptions: AuthorizedRealtimeTopicSubscription[],
) => {
  for (const subscription of subscriptions) {
    await runRealtimeTopicUnsubscribedHook(subscription.registration, {
      ...context,
      requestedTopic: subscription.requestedTopic,
    });
  }
};

