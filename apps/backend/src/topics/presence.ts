import { REALTIME_TOPICS } from '@rbac/api-common';
import type { RealtimeTopicRegistration } from './types';

export const presenceRealtimeTopicRegistrations: RealtimeTopicRegistration[] = [
  {
    code: 'presence-events',
    description: '在线状态变更广播。',
    name: '在线状态广播',
    permissionCode: 'realtime.topic.presence.subscribe',
    topicPattern: REALTIME_TOPICS.presenceChanged,
  },
];

