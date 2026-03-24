import { REALTIME_TOPICS } from '@rbac/api-common';
import type { RealtimeTopicRegistration } from './types';

export const rbacRealtimeTopicRegistrations: RealtimeTopicRegistration[] = [
  {
    authorizeSubscription: ({ requestedTopic, user }) => {
      const ownTopic = REALTIME_TOPICS.userRbacUpdated(user.id);
      if (requestedTopic !== ownTopic) {
        throw new Error('Missing permission for other users rbac topic');
      }
    },
    code: 'user-rbac-updated-self',
    description: '仅允许订阅当前用户自己的 RBAC 变更 topic。',
    name: '当前用户 RBAC 变更',
    permissionCode: 'realtime.topic.user-rbac.subscribe-self',
    topicPattern: REALTIME_TOPICS.userRbacUpdated('+'),
  },
  {
    code: 'user-rbac-updated-any',
    description: '允许按用户或通配模式订阅 RBAC 变更 topic。',
    name: '任意用户 RBAC 变更',
    permissionCode: 'realtime.topic.user-rbac.subscribe-any',
    topicPattern: REALTIME_TOPICS.userRbacUpdated('+'),
  },
];

