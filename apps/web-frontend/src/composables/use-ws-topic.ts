import type { MaybeRefOrGetter } from 'vue';
import type { WsTopicHandler } from '@rbac/api-common';
import { onScopeDispose, toValue, watch } from 'vue';
import { wsClient } from '@/api/client';

const toTopicList = (value: string | string[] | null | undefined) => {
  if (!value) {
    return [] as string[];
  }

  const topics = Array.isArray(value) ? value : [value];
  return topics.filter((topic): topic is string => typeof topic === 'string' && Boolean(topic.trim()));
};

export const useWsTopic = <TPayload = unknown>(
  topicInput: MaybeRefOrGetter<string | string[] | null | undefined>,
  handler: WsTopicHandler<TPayload>,
) => {
  let cleanups: Array<() => void> = [];

  const clearTopics = () => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
  };

  const stopWatch = watch(
    () => toValue(topicInput),
    (value) => {
      clearTopics();
      toTopicList(value).forEach((topic) => {
        cleanups.push(wsClient.onTopic(topic, handler));
      });
    },
    {
      immediate: true,
    },
  );

  const stop = () => {
    stopWatch();
    clearTopics();
  };

  onScopeDispose(stop);
  return stop;
};
