import type { CurrentUser } from '@rbac/api-common';
import type { RealtimeSyncTarget } from '@rbac/api-common';
import { emitAuditEvent, emitRbacUpdated, getConnectedRealtimeUserIds } from '../lib/socket';
import { logActivity } from './audit';
import { invalidatePermissionCache } from './rbac';

type MutationActor = Pick<CurrentUser, 'id' | 'nickname'>;

type RbacMutationPayload = {
  actor: MutationActor;
  action: string;
  target: string;
  detail?: unknown;
  affectedUserIds?: string[];
  notifiedUserIds?: string[];
  reason?: string;
  invalidateCache?: boolean;
  syncTargets?: RealtimeSyncTarget[];
};

export const publishRbacMutation = async ({
  actor,
  action,
  target,
  detail,
  affectedUserIds = [],
  notifiedUserIds,
  reason,
  invalidateCache = true,
  syncTargets,
}: RbacMutationPayload) => {
  const uniqueUserIds = [...new Set(affectedUserIds)];
  const connectedUserIds = new Set(getConnectedRealtimeUserIds());
  const resolvedNotifiedUserIds = [...new Set(notifiedUserIds ?? uniqueUserIds)]
    .filter((userId) => connectedUserIds.has(userId));

  if (invalidateCache && uniqueUserIds.length) {
    await invalidatePermissionCache(uniqueUserIds);
  }

  await logActivity({
    actorId: actor.id,
    actorName: actor.nickname,
    action,
    target,
    detail,
  });

  emitAuditEvent({
    action,
    actor: actor.nickname,
    target,
  });

  if (reason && resolvedNotifiedUserIds.length) {
    emitRbacUpdated(resolvedNotifiedUserIds, {
      reason,
      targets: syncTargets,
    });
  }
};
