import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withSnowflakeId } from './persistence';

type AuditPayload = {
  actorId?: string;
  actorName: string;
  action: string;
  target: string;
  detail?: unknown;
};

export const logActivity = async ({
  actorId,
  actorName,
  action,
  target,
  detail,
}: AuditPayload) => {
  const data: Prisma.ActivityLogUncheckedCreateInput = withSnowflakeId({
    createId: actorId ?? null,
    updateId: actorId ?? null,
    actorId: actorId ?? null,
    actorName,
    action,
    target,
    ...(detail === undefined ? {} : { detail: detail as Prisma.InputJsonValue }),
  });

  await prisma.activityLog.create({
    data,
  });
};
