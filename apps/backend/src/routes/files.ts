import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import {
  createUploadPlan,
  finalizeUpload,
  storeLocalPart,
  validateUploadRequest,
} from '../services/file-upload';
import { logActivity } from '../utils/audit';
import { badRequest, notFound } from '../utils/errors';
import { ok, asyncHandler } from '../utils/http';
import { withSnowflakeId } from '../utils/persistence';

const localUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

const filesRouter = Router();

filesRouter.post(
  '/local/:fileId/parts/:partNumber',
  localUpload.single('file'),
  asyncHandler(async (req, res) => {
    const fileId = String(req.params.fileId);
    const partNumber = Number(req.params.partNumber);
    const file = req.file;
    const token = String(req.body.token ?? '');

    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw badRequest('Invalid part number');
    }

    if (!token) {
      throw badRequest('Missing upload token');
    }

    if (!file) {
      throw badRequest('Missing file');
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: fileId },
    });

    if (!asset) {
      throw notFound('Upload file not found');
    }

    if (asset.uploadToken !== token) {
      throw badRequest('Invalid upload token');
    }

    if (asset.uploadStatus !== 'PENDING') {
      throw badRequest('Upload is not pending');
    }

    await storeLocalPart({
      fileId: asset.id,
      objectKey: asset.objectKey,
      uploadStrategy: asset.uploadStrategy,
      partNumber,
      fileBuffer: file.buffer,
    });

    return res.status(204).end();
  }),
);

filesRouter.use(authMiddleware);

filesRouter.post(
  '/presign',
  requirePermission('file.upload'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const normalized = validateUploadRequest({
      kind: String(req.body.kind ?? ''),
      fileName: String(req.body.fileName ?? ''),
      contentType: String(req.body.contentType ?? ''),
      size: Number(req.body.size ?? 0),
      tag1: req.body.tag1 == null ? null : String(req.body.tag1),
      tag2: req.body.tag2 == null ? null : String(req.body.tag2),
    });

    const asset = await prisma.mediaAsset.create({
      data: withSnowflakeId({
        userId: actor.id,
        kind: normalized.kind,
        originalName: normalized.fileName,
        mimeType: normalized.contentType,
        size: BigInt(normalized.size),
        tag1: normalized.tag1,
        tag2: normalized.tag2,
        storageProvider: normalized.storageProvider === 's3' ? 'S3' : 'LOCAL',
        storageBucket: normalized.storageBucket,
        objectKey: normalized.objectKey,
        uploadToken: normalized.uploadToken,
        uploadStatus: 'PENDING',
        uploadStrategy: normalized.strategy === 'chunked' ? 'CHUNKED' : 'SINGLE',
        chunkSize: normalized.chunkSize,
        chunkCount: normalized.chunkCount,
      }),
    });

    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const plan = await createUploadPlan({
      fileId: asset.id,
      objectKey: asset.objectKey,
      uploadToken: asset.uploadToken,
      contentType: asset.mimeType,
      size: Number(asset.size),
      chunkCount: asset.chunkCount ?? 1,
      strategy: asset.uploadStrategy === 'CHUNKED' ? 'chunked' : 'single',
      requestOrigin,
    });

    return ok(
      res,
      {
        fileId: asset.id,
        provider: plan.provider,
        strategy: plan.strategy,
        chunkSize: plan.chunkSize,
        chunkCount: plan.chunkCount,
        parts: plan.parts,
      },
      'Upload prepared',
    );
  }),
);

filesRouter.post(
  '/callback',
  requirePermission('file.upload'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const fileId = String(req.body.fileId ?? '');

    if (!fileId) {
      throw badRequest('Missing file id');
    }

    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: fileId,
        userId: actor.id,
      },
    });

    if (!asset) {
      throw notFound('Upload file not found');
    }

    if (asset.uploadStatus === 'COMPLETED' && asset.url) {
      return ok(res, { fileId: asset.id, url: asset.url }, 'Upload already completed');
    }

    let finalized;
    try {
      finalized = await finalizeUpload({
        fileId: asset.id,
        objectKey: asset.objectKey,
        mimeType: asset.mimeType,
        storageProvider: asset.storageProvider,
        storageBucket: asset.storageBucket,
        uploadStrategy: asset.uploadStrategy,
        chunkCount: asset.chunkCount,
      });
    } catch (error) {
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { uploadStatus: 'FAILED' },
      }).catch(() => undefined);
      throw error;
    }

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: 'COMPLETED',
        url: finalized.url,
        etag: finalized.etag,
        completedAt: new Date(),
      },
    });

    if (asset.kind === 'avatar') {
      await prisma.user.update({
        where: { id: actor.id },
        data: { avatar: finalized.url },
      });
    }

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'file.upload',
      target: asset.originalName,
      detail: {
        kind: asset.kind,
        provider: asset.storageProvider,
        strategy: asset.uploadStrategy,
      },
    });

    return ok(res, { fileId: asset.id, url: finalized.url }, 'Upload completed');
  }),
);

export { filesRouter };
