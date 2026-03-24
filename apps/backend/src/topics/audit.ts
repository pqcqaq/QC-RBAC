import { REALTIME_TOPICS } from '@rbac/api-common';
import type { RealtimeTopicRegistration } from './types';

export const auditRealtimeTopicRegistrations: RealtimeTopicRegistration[] = [
  {
    code: 'audit-events',
    description: '系统审计广播。',
    name: '审计事件广播',
    permissionCode: 'realtime.topic.audit.subscribe',
    topicPattern: REALTIME_TOPICS.auditEvent,
  },
];

