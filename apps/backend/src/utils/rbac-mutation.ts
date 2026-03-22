import type { CurrentUser } from '@rbac/api-common';
import { emitAuditEvent, emitRbacUpdated } from '../lib/socket';
import { logActivity } from './audit';
import { invalidatePermissionCache } from './rbac';

type MutationActor = Pick<CurrentUser, 'id' | 'nickname'>;

type RbacMutationPayload = {
  actor: MutationActor;
  action: string;
  target: string;
  detail?: unknown;
  affectedUserIds?: string[];
  reason?: string;
  invalidateCache?: boolean;
};

export const publishRbacMutation = async ({
  actor,
  action,
  target,
  detail,
  affectedUserIds = [],
  reason,
  invalidateCache = true,
}: RbacMutationPayload) => {
  const uniqueUserIds = [...new Set(affectedUserIds)];

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

  if (reason && uniqueUserIds.length) {
    emitRbacUpdated(uniqueUserIds, reason);
  }
};
