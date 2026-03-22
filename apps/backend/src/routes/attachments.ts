import path from 'node:path';
import type { Prisma } from '../lib/prisma-generated';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { deleteStoredUpload, normalizeMediaAssetTag } from '../services/file-upload';
import { logActivity } from '../utils/audit';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import { badRequest, notFound } from '../utils/errors';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import {
  mediaAssetWithOwnerInclude,
  toMediaAssetRecord,
  type MediaAssetWithOwnerRecord,
} from '../utils/file-records';

const attachmentsRouter = Router();

const attachmentUpdateSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  tag1: z.string().trim().max(64).nullable().optional(),
  tag2: z.string().trim().max(64).nullable().optional(),
});

type AttachmentListQuery = {
  q: string;
  kind: string;
  uploadStatus: '' | 'PENDING' | 'COMPLETED' | 'FAILED';
  tag1: string;
  tag2: string;
};

const parseAttachmentListQuery = (query: Request['query']): AttachmentListQuery => {
  const uploadStatus = String(query.uploadStatus ?? '').trim();

  return {
    q: String(query.q ?? '').trim(),
    kind: String(query.kind ?? '').trim(),
    uploadStatus: ['PENDING', 'COMPLETED', 'FAILED'].includes(uploadStatus)
      ? (uploadStatus as AttachmentListQuery['uploadStatus'])
      : '',
    tag1: String(query.tag1 ?? '').trim(),
    tag2: String(query.tag2 ?? '').trim(),
  };
};

const buildAttachmentWhere = ({
  q,
  kind,
  uploadStatus,
  tag1,
  tag2,
}: AttachmentListQuery): Prisma.MediaAssetWhereInput => {
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { originalName: { contains: q, mode: 'insensitive' } },
      { mimeType: { contains: q, mode: 'insensitive' } },
      { objectKey: { contains: q, mode: 'insensitive' } },
      { tag1: { contains: q, mode: 'insensitive' } },
      { tag2: { contains: q, mode: 'insensitive' } },
      {
        user: {
          is: {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { nickname: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  if (kind) {
    where.kind = kind;
  }

  if (uploadStatus) {
    where.uploadStatus = uploadStatus;
  }

  if (tag1) {
    where.tag1 = tag1;
  }

  if (tag2) {
    where.tag2 = tag2;
  }

  return where as Prisma.MediaAssetWhereInput;
};

const normalizeOriginalName = (value: string) => {
  const nextValue = path.basename(value).trim().slice(0, 255);
  if (!nextValue) {
    throw badRequest('Missing file name');
  }

  return nextValue;
};

attachmentsRouter.use(authMiddleware);

attachmentsRouter.get(
  '/',
  requirePermission('file.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildAttachmentWhere(parseAttachmentListQuery(req.query));

    const [total, assets] = await prisma.$transaction([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        skip,
        take: pageSize,
        include: mediaAssetWithOwnerInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return ok(
      res,
      {
        items: assets.map(toMediaAssetRecord),
        meta: { page, pageSize, total },
      },
      'Attachment list',
    );
  }),
);

attachmentsRouter.get(
  '/export',
  requirePermission('file.read'),
  createExcelExportHandler<AttachmentListQuery, MediaAssetWithOwnerRecord>({
    fileName: () => createTimestampedExcelFileName('attachments'),
    sheetName: 'Attachments',
    parseQuery: parseAttachmentListQuery,
    queryRows: async (query) =>
      prisma.mediaAsset.findMany({
        where: buildAttachmentWhere(query),
        include: mediaAssetWithOwnerInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }) as Promise<MediaAssetWithOwnerRecord[]>,
    columns: [
      { header: '文件名', width: 30, value: (row) => row.originalName },
      { header: '类型', width: 16, value: (row) => row.kind },
      { header: '标签1', width: 18, value: (row) => row.tag1 ?? '' },
      { header: '标签2', width: 18, value: (row) => row.tag2 ?? '' },
      { header: 'MIME', width: 26, value: (row) => row.mimeType },
      { header: '大小(Byte)', width: 16, value: (row) => Number(row.size) },
      { header: '存储', width: 14, value: (row) => row.storageProvider },
      { header: '状态', width: 14, value: (row) => row.uploadStatus },
      { header: '上传人', width: 22, value: (row) => `${row.user.nickname} (${row.user.username})` },
      { header: '上传时间', width: 22, value: (row) => row.createdAt },
      { header: '完成时间', width: 22, value: (row) => row.completedAt ?? '' },
      { header: '访问地址', width: 50, value: (row) => row.url ?? '' },
    ],
  }),
);

attachmentsRouter.get(
  '/:id',
  requirePermission('file.read'),
  asyncHandler(async (req, res) => {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: String(req.params.id) },
      include: mediaAssetWithOwnerInclude,
    }) as MediaAssetWithOwnerRecord | null;

    if (!asset) {
      throw notFound('Attachment not found');
    }

    return ok(res, toMediaAssetRecord(asset), 'Attachment detail');
  }),
);

attachmentsRouter.put(
  '/:id',
  requirePermission('file.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const assetId = String(req.params.id);
    const payload = attachmentUpdateSchema.parse(req.body);

    const current = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: mediaAssetWithOwnerInclude,
    }) as MediaAssetWithOwnerRecord | null;

    if (!current) {
      throw notFound('Attachment not found');
    }

    const updateData = {
      originalName: normalizeOriginalName(payload.originalName),
      tag1: normalizeMediaAssetTag(payload.tag1),
      tag2: normalizeMediaAssetTag(payload.tag2),
    } as Prisma.MediaAssetUpdateInput;

    const asset = await prisma.mediaAsset.update({
      where: { id: assetId },
      data: updateData,
      include: mediaAssetWithOwnerInclude,
    }) as MediaAssetWithOwnerRecord;

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'file.update',
      target: current.originalName,
      detail: {
        assetId: current.id,
        tag1: asset.tag1,
        tag2: asset.tag2,
      },
    });

    return ok(res, toMediaAssetRecord(asset), 'Attachment updated');
  }),
);

attachmentsRouter.delete(
  '/:id',
  requirePermission('file.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const assetId = String(req.params.id);
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: mediaAssetWithOwnerInclude,
    }) as MediaAssetWithOwnerRecord | null;

    if (!asset) {
      throw notFound('Attachment not found');
    }

    await deleteStoredUpload({
      fileId: asset.id,
      objectKey: asset.objectKey,
      storageProvider: asset.storageProvider,
      storageBucket: asset.storageBucket,
      uploadStrategy: asset.uploadStrategy,
      chunkCount: asset.chunkCount,
    });

    if (asset.kind === 'avatar' && asset.url) {
      await prisma.user.updateMany({
        where: {
          id: asset.userId,
          avatar: asset.url,
        },
        data: {
          avatar: null,
        },
      });
    }

    await prisma.mediaAsset.delete({
      where: { id: asset.id },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'file.delete',
      target: asset.originalName,
      detail: {
        assetId: asset.id,
        kind: asset.kind,
        uploadStatus: asset.uploadStatus,
      },
    });

    return ok(res, { ok: true }, 'Attachment deleted');
  }),
);

export { attachmentsRouter };
