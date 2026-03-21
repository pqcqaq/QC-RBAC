import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

interface S3Config {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

const resolveS3Config = (): S3Config => ({
  region: env.S3_REGION || env.OSS_REGION || 'auto',
  bucket: env.S3_BUCKET || env.OSS_BUCKET,
  endpoint: env.S3_ENDPOINT || env.OSS_ENDPOINT,
  accessKeyId: env.S3_ACCESS_KEY_ID || env.OSS_ACCESS_KEY_ID,
  accessKeySecret: env.S3_ACCESS_KEY_SECRET || env.OSS_ACCESS_KEY_SECRET,
  publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

const normalizeEndpoint = (endpoint: string) =>
  /^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;

const hasS3Config = () => {
  const config = resolveS3Config();
  return Boolean(config.bucket && config.endpoint && config.accessKeyId && config.accessKeySecret);
};

const createS3Client = () => {
  const config = resolveS3Config();

  return new S3Client({
    region: config.region,
    endpoint: normalizeEndpoint(config.endpoint),
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.accessKeySecret,
    },
  });
};

const stripEtag = (etag?: string | null) => etag?.replace(/^"|"$/g, '') ?? null;

const buildPublicUrl = (objectKey: string) => {
  const config = resolveS3Config();

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
  }

  const endpoint = new URL(normalizeEndpoint(config.endpoint));
  if (config.forcePathStyle) {
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${config.bucket}/${objectKey}`;
    return endpoint.toString();
  }

  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = `/${objectKey}`;
  return endpoint.toString();
};

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
  const url = buildPublicUrl(asset.objectKey);

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
  return url;
};

const markAssetFailed = async (assetId: string) =>
  prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      uploadStatus: 'FAILED',
    },
  });

const reconcileAsset = async (
  client: S3Client,
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

    const url = await markAssetCompleted(asset, stripEtag(head.ETag));
    return { status: 'completed' as const, url };
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    if (!shouldMarkFailed(asset.createdAt, now)) {
      return { status: 'pending' as const };
    }

    await markAssetFailed(asset.id);
    return { status: 'failed' as const };
  }
};

export const reconcilePendingUploads = async () => {
  if (!hasS3Config()) {
    console.log('[backend-jobs] skip reconcile: missing S3 config');
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
      const result = await reconcileAsset(client, asset, now);
      if (result.status === 'completed') {
        completed += 1;
        continue;
      }

      if (result.status === 'failed') {
        failed += 1;
        continue;
      }

      pending += 1;
    } catch (error) {
      console.error(`[backend-jobs] reconcile upload failed: ${asset.id}`, error);
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
