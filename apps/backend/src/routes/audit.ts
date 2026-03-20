import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';

const auditRouter = Router();

auditRouter.use(authMiddleware);

auditRouter.get(
  '/',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const q = String(req.query.q ?? '').trim();
    const action = String(req.query.action ?? '').trim();

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { actorName: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { target: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const [total, rows] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return ok(
      res,
      {
        items: rows.map((item) => ({
          id: item.id,
          actorId: item.actorId,
          actorName: item.actorName,
          action: item.action,
          target: item.target,
          detail: item.detail ?? undefined,
          createdAt: item.createdAt.toISOString(),
        })),
        meta: { page, pageSize, total },
      },
      'Audit log list',
    );
  }),
);

export { auditRouter };
