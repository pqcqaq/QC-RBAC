import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '../../lib/prisma-generated';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import {
  createS3Client,
  getUploadPublicUrl,
  hasS3Storage,
} from '../../services/file-upload';

const TIMER_ID = 'upload-reconcile';

const stripEtag = (etag?: string | null) => etag?.replace(/^"|"$/g, '') ?? null;

const isMissingObjectError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NotFound' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
};

const shouldMarkFailed = (createdAt: Date, now: Date) =>
  now.getTime() - createdAt.getTime() >= env.UPLOAD_PENDING_TIMEOUT_MINUTES * 60 * 1000;

const markAssetCompleted = async (asset: {
  id: string;
  userId: string;
  kind: string;
  objectKey: string;
  storageBucket: string;
}, etag: string | null) => {
  const url = getUploadPublicUrl('S3', asset.objectKey, asset.storageBucket);

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: 'COMPLETED',
        url,
        etag,
        completedAt: new Date(),
      },
    }),
  ];

  if (asset.kind === 'avatar') {
    operations.push(
      prisma.user.update({
        where: { id: asset.userId },
        data: { avatar: url },
      }),
    );
  }

  await prisma.$transaction(operations);
};

const markAssetFailed = async (assetId: string) =>
  prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      uploadStatus: 'FAILED',
    },
  });

const reconcileAsset = async (
  client: ReturnType<typeof createS3Client>,
  asset: {
    id: string;
    userId: string;
    kind: string;
    objectKey: string;
    storageBucket: string;
    createdAt: Date;
  },
  now: Date,
) => {
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: asset.storageBucket,
        Key: asset.objectKey,
      }),
    );

    await markAssetCompleted(asset, stripEtag(head.ETag));
    return 'completed' as const;
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    if (!shouldMarkFailed(asset.createdAt, now)) {
      return 'pending' as const;
    }

    await markAssetFailed(asset.id);
    return 'failed' as const;
  }
};

export const reconcilePendingUploads = async () => {
  if (!hasS3Storage()) {
    console.log(`[timer:${TIMER_ID}] skip reconcile: missing S3 config`);
    return { checked: 0, completed: 0, failed: 0, pending: 0 };
  }

  const assets = await prisma.mediaAsset.findMany({
    where: {
      uploadStatus: 'PENDING',
      storageProvider: 'S3',
      uploadStrategy: 'SINGLE',
    },
    orderBy: { createdAt: 'asc' },
    take: env.UPLOAD_RECONCILE_BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      kind: true,
      objectKey: true,
      storageBucket: true,
      createdAt: true,
    },
  });

  if (assets.length === 0) {
    return { checked: 0, completed: 0, failed: 0, pending: 0 };
  }

  const client = createS3Client();
  const now = new Date();
  let completed = 0;
  let failed = 0;
  let pending = 0;

  for (const asset of assets) {
    try {
      const status = await reconcileAsset(client, asset, now);

      if (status === 'completed') {
        completed += 1;
        continue;
      }

      if (status === 'failed') {
        failed += 1;
        continue;
      }

      pending += 1;
    } catch (error) {
      console.error(`[timer:${TIMER_ID}] reconcile upload failed: ${asset.id}`, error);
      pending += 1;
    }
  }

  return {
    checked: assets.length,
    completed,
    failed,
    pending,
  };
};
