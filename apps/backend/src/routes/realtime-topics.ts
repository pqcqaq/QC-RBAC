import { Router, type Request } from 'express';
import { normalizeWsSubscriptionTopic } from '@rbac/api-common';
import type { Prisma } from '../lib/prisma-generated';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import {
  listPermissionSummaries,
  parseOptionResolvePayload,
  parsePermissionSummarySearchPayload,
  resolvePermissionSummariesByIds,
} from '../services/rbac-options';
import { invalidateRealtimeTopicRegistryCache } from '../services/realtime-topic-auth';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import { badRequest, notFound } from '../utils/errors';
import { asyncHandler, ok, parsePagination } from '../utils/http';
import { withSnowflakeId } from '../utils/persistence';
import { publishRbacMutation } from '../utils/rbac-mutation';
import {
  realtimeTopicWithPermissionSummaryInclude,
  toRealtimeTopicRecord,
} from '../utils/rbac-records';

const realtimeTopicPayloadSchema = z.object({
  code: z.string().min(3).max(64),
  name: z.string().min(2).max(48),
  description: z.string().max(120).nullable().optional(),
  topicPattern: z.string().min(1).max(160),
  permissionId: z.string().min(1),
});

type RealtimeTopicListQuery = {
  q: string;
  permissionId: string;
  sourceType: '' | 'seed' | 'custom';
};

const realtimeTopicsRouter = Router();

const parseRealtimeTopicListQuery = (query: Request['query']): RealtimeTopicListQuery => {
  const sourceType = String(query.sourceType ?? '').trim();

  return {
    q: String(query.q ?? '').trim(),
    permissionId: String(query.permissionId ?? '').trim(),
    sourceType: sourceType === 'seed' || sourceType === 'custom' ? sourceType : '',
  };
};

const buildRealtimeTopicWhere = ({
  q,
  permissionId,
  sourceType,
}: RealtimeTopicListQuery): Prisma.RealtimeTopicWhereInput => {
  const where: Prisma.RealtimeTopicWhereInput = {};

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { topicPattern: { contains: q, mode: 'insensitive' } },
      {
        permission: {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { module: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  if (permissionId) {
    where.permissionId = permissionId;
  }

  if (sourceType === 'seed') {
    where.isSystem = true;
  }

  if (sourceType === 'custom') {
    where.isSystem = false;
  }

  return where;
};

const normalizeRealtimeTopicPayload = (
  payload: z.infer<typeof realtimeTopicPayloadSchema>,
) => {
  try {
    return {
      code: payload.code.trim(),
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      topicPattern: normalizeWsSubscriptionTopic(payload.topicPattern),
      permissionId: payload.permissionId,
    };
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'Invalid topic pattern');
  }
};

const ensurePermissionExists = async (permissionId: string) => {
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { id: true },
  });

  if (!permission) {
    throw notFound('Permission not found');
  }
};

const ensureNoDuplicateBinding = async (
  topicPattern: string,
  permissionId: string,
  currentId?: string,
) => {
  const existing = await prisma.realtimeTopic.findFirst({
    where: {
      topicPattern,
      permissionId,
      ...(currentId
        ? {
            id: {
              not: currentId,
            },
          }
        : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw badRequest('Topic permission binding already exists');
  }
};

realtimeTopicsRouter.use(authMiddleware);

const handlePermissionOptions = asyncHandler(async (req, res) =>
  ok(
    res,
    await listPermissionSummaries(parsePermissionSummarySearchPayload(req)),
    'Permission options',
  ));

const handlePermissionOptionResolve = asyncHandler(async (req, res) =>
  ok(
    res,
    await resolvePermissionSummariesByIds(parseOptionResolvePayload(req).ids),
    'Resolved permission options',
  ));

realtimeTopicsRouter.get(
  '/options/permissions',
  requireAnyPermission('realtime-topic.read', 'realtime-topic.create', 'realtime-topic.update'),
  handlePermissionOptions,
);

realtimeTopicsRouter.post(
  '/options/permissions',
  requireAnyPermission('realtime-topic.read', 'realtime-topic.create', 'realtime-topic.update'),
  handlePermissionOptions,
);

realtimeTopicsRouter.post(
  '/options/permissions/resolve',
  requireAnyPermission('realtime-topic.read', 'realtime-topic.create', 'realtime-topic.update'),
  handlePermissionOptionResolve,
);

realtimeTopicsRouter.get(
  '/',
  requirePermission('realtime-topic.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildRealtimeTopicWhere(parseRealtimeTopicListQuery(req.query));

    const [total, topics] = await prisma.$transaction([
      prisma.realtimeTopic.count({ where }),
      prisma.realtimeTopic.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isSystem: 'desc' }, { topicPattern: 'asc' }, { code: 'asc' }],
        include: realtimeTopicWithPermissionSummaryInclude,
      }),
    ]);

    return ok(
      res,
      {
        items: topics.map(toRealtimeTopicRecord),
        meta: { page, pageSize, total },
      },
      'Realtime topic list',
    );
  }),
);

realtimeTopicsRouter.get(
  '/export',
  requirePermission('realtime-topic.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('realtime-topics'),
    sheetName: 'RealtimeTopics',
    parseQuery: parseRealtimeTopicListQuery,
    queryRows: async (query) =>
      prisma.realtimeTopic.findMany({
        where: buildRealtimeTopicWhere(query),
        orderBy: [{ isSystem: 'desc' }, { topicPattern: 'asc' }, { code: 'asc' }],
        include: realtimeTopicWithPermissionSummaryInclude,
      }),
    columns: [
      { header: '编码', width: 28, value: (row) => row.code },
      { header: '名称', width: 20, value: (row) => row.name },
      { header: 'Topic Pattern', width: 36, value: (row) => row.topicPattern },
      { header: '权限码', width: 28, value: (row) => row.permission.code },
      { header: '权限名称', width: 20, value: (row) => row.permission.name },
      { header: '来源', width: 12, value: (row) => (row.isSystem ? '系统注册' : '自定义绑定') },
      { header: '描述', width: 36, value: (row) => row.description ?? '' },
      { header: '创建时间', width: 22, value: (row) => row.createdAt },
      { header: '更新时间', width: 22, value: (row) => row.updatedAt },
    ],
  }),
);

realtimeTopicsRouter.get(
  '/:id',
  requirePermission('realtime-topic.read'),
  asyncHandler(async (req, res) => {
    const topicId = String(req.params.id);
    const topic = await prisma.realtimeTopic.findUnique({
      where: { id: topicId },
      include: realtimeTopicWithPermissionSummaryInclude,
    });

    if (!topic) {
      throw notFound('Realtime topic not found');
    }

    return ok(res, toRealtimeTopicRecord(topic), 'Realtime topic detail');
  }),
);

realtimeTopicsRouter.post(
  '/',
  requirePermission('realtime-topic.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = normalizeRealtimeTopicPayload(realtimeTopicPayloadSchema.parse(req.body));

    await ensurePermissionExists(payload.permissionId);
    await ensureNoDuplicateBinding(payload.topicPattern, payload.permissionId);

    const topic = await prisma.realtimeTopic.create({
      data: withSnowflakeId(payload),
      include: realtimeTopicWithPermissionSummaryInclude,
    });

    await invalidateRealtimeTopicRegistryCache();
    await publishRbacMutation({
      actor,
      action: 'realtime-topic.create',
      target: topic.code,
      detail: {
        topicPattern: topic.topicPattern,
        permissionCode: topic.permission.code,
      },
      invalidateCache: false,
    });

    return ok(res, toRealtimeTopicRecord(topic), 'Realtime topic created');
  }),
);

realtimeTopicsRouter.put(
  '/:id',
  requirePermission('realtime-topic.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const topicId = String(req.params.id);
    const current = await prisma.realtimeTopic.findUnique({
      where: { id: topicId },
      include: realtimeTopicWithPermissionSummaryInclude,
    });

    if (!current) {
      throw notFound('Realtime topic not found');
    }

    if (current.isSystem) {
      throw badRequest('System realtime topic cannot be edited');
    }

    const payload = normalizeRealtimeTopicPayload(realtimeTopicPayloadSchema.parse(req.body));
    await ensurePermissionExists(payload.permissionId);
    await ensureNoDuplicateBinding(payload.topicPattern, payload.permissionId, topicId);

    const topic = await prisma.realtimeTopic.update({
      where: { id: topicId },
      data: payload,
      include: realtimeTopicWithPermissionSummaryInclude,
    });

    await invalidateRealtimeTopicRegistryCache();
    await publishRbacMutation({
      actor,
      action: 'realtime-topic.update',
      target: topic.code,
      detail: {
        topicPattern: topic.topicPattern,
        permissionCode: topic.permission.code,
      },
      invalidateCache: false,
    });

    return ok(res, toRealtimeTopicRecord(topic), 'Realtime topic updated');
  }),
);

realtimeTopicsRouter.delete(
  '/:id',
  requirePermission('realtime-topic.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const topicId = String(req.params.id);
    const topic = await prisma.realtimeTopic.findUnique({
      where: { id: topicId },
      include: realtimeTopicWithPermissionSummaryInclude,
    });

    if (!topic) {
      throw notFound('Realtime topic not found');
    }

    if (topic.isSystem) {
      throw badRequest('System realtime topic cannot be deleted');
    }

    await prisma.realtimeTopic.delete({
      where: { id: topicId },
    });

    await invalidateRealtimeTopicRegistryCache();
    await publishRbacMutation({
      actor,
      action: 'realtime-topic.delete',
      target: topic.code,
      detail: {
        topicPattern: topic.topicPattern,
        permissionCode: topic.permission.code,
      },
      invalidateCache: false,
    });

    return ok(res, { ok: true }, 'Realtime topic deleted');
  }),
);

export { realtimeTopicsRouter };
