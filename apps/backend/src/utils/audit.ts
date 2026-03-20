import { prisma } from '../lib/prisma.js';

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
  await prisma.activityLog.create({
    data: {
      actorId,
      actorName,
      action,
      target,
      detail: detail as never,
    },
  });
};
