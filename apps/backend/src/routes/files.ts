import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import OSS from 'ali-oss';
import multer from 'multer';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { badRequest } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

const hasOssConfig = Boolean(
  env.OSS_BUCKET && env.OSS_ACCESS_KEY_ID && env.OSS_ACCESS_KEY_SECRET && env.OSS_ENDPOINT,
);

const createOssClient = () =>
  new OSS({
    bucket: env.OSS_BUCKET,
    region: env.OSS_REGION,
    accessKeyId: env.OSS_ACCESS_KEY_ID,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    endpoint: env.OSS_ENDPOINT,
  });

const filesRouter = Router();

filesRouter.use(authMiddleware);

filesRouter.post(
  '/avatar',
  requirePermission('file.upload'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const file = req.file;
    if (!file) {
      throw badRequest('Missing file');
    }

    const ext = path.extname(file.originalname) || '.bin';
    const objectKey = `avatars/${Date.now()}-${randomUUID()}${ext}`;
    let url = '';

    if (hasOssConfig) {
      const client = createOssClient();
      const result = await client.put(objectKey, file.buffer);
      url = result.url;
    } else {
      const output = path.resolve(process.cwd(), 'uploads', objectKey);
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, file.buffer);
      url = `${env.UPLOAD_PUBLIC_BASE_URL}/${objectKey.replace(/\\/g, '/')}`;
    }

    await prisma.mediaAsset.create({
      data: {
        userId: actor.id,
        kind: 'avatar',
        originalName: file.originalname,
        url,
      },
    });

    await prisma.user.update({
      where: { id: actor.id },
      data: { avatar: url },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'file.upload',
      target: file.originalname,
      detail: { kind: 'avatar' },
    });

    return ok(res, { url }, 'Avatar uploaded');
  }),
);

export { filesRouter };


