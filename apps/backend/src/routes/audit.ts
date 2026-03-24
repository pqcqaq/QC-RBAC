import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';

const auditRouter = Router();

type AuditListQuery = {
  q: string;
  action: string;
};

const parseAuditListQuery = (query: Request['query']): AuditListQuery => ({
  q: String(query.q ?? '').trim(),
  action: String(query.action ?? '').trim(),
});

const buildAuditWhere = ({ q, action }: AuditListQuery) => {
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

  return where;
};

auditRouter.use(authMiddleware);

auditRouter.get(
  '/',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildAuditWhere(parseAuditListQuery(req.query));

    const total = await prisma.activityLog.count({ where });
    const rows = await prisma.activityLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

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

auditRouter.get(
  '/export',
  requirePermission('audit.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('audit-logs'),
    sheetName: 'Audit Logs',
    parseQuery: parseAuditListQuery,
    queryRows: async (query) =>
      prisma.activityLog.findMany({
        where: buildAuditWhere(query),
        orderBy: { createdAt: 'desc' },
      }),
    columns: [
      { header: '操作者', width: 18, value: (row) => row.actorName },
      { header: '动作', width: 22, value: (row) => row.action },
      { header: '目标', width: 28, value: (row) => row.target },
      { header: '明细', width: 40, value: (row) => row.detail ?? '' },
      { header: '发生时间', width: 22, value: (row) => row.createdAt },
    ],
  }),
);

export { auditRouter };
