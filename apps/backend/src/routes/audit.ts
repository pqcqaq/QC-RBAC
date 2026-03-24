import { Router, type Request } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import {
  listRequestAuditExportRows,
  listRequestAuditRecords,
  parseRequestAuditListQuery,
} from '../services/request-audit';

const auditRouter = Router();

type AuditListQuery = {
  q: string;
  method: string;
  model: string;
  operation: string;
  status: string;
};

const parseAuditListQuery = (query: Request['query']): AuditListQuery =>
  parseRequestAuditListQuery(query);

auditRouter.use(authMiddleware);

auditRouter.get(
  '/',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const result = await listRequestAuditRecords({
      page,
      pageSize,
      query: parseAuditListQuery(req.query),
      skip,
    });

    return ok(
      res,
      result,
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
    queryRows: listRequestAuditExportRows,
    columns: [
      { header: '请求ID', width: 26, value: (row) => row.id },
      { header: '操作者', width: 18, value: (row) => row.actorName },
      { header: '方法', width: 12, value: (row) => row.method },
      { header: '路径', width: 42, value: (row) => row.path },
      { header: '状态码', width: 12, value: (row) => row.statusCode },
      { header: '操作数', width: 12, value: (row) => row.operationCount },
      { header: '读操作', width: 12, value: (row) => row.readCount },
      { header: '写操作', width: 12, value: (row) => row.writeCount },
      { header: '错误', width: 32, value: (row) => row.errorMessage ?? '' },
      { header: '开始时间', width: 22, value: (row) => row.startedAt },
      { header: '耗时(ms)', width: 14, value: (row) => row.durationMs },
    ],
  }),
);

export { auditRouter };
