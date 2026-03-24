import { REALTIME_TOPICS } from '@rbac/api-common';
import type { RealtimeTopicRegistration } from './types';

export const chatRealtimeTopicRegistrations: RealtimeTopicRegistration[] = [
  {
    code: 'chat-global-messages',
    description: '全局实时聊天消息。',
    name: '全局聊天消息',
    permissionCode: 'realtime.topic.chat-global.subscribe',
    topicPattern: REALTIME_TOPICS.chatGlobalMessage,
  },
];

