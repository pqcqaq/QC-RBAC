import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCopyCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { MediaAssetStorageProvider, MediaAssetUploadStrategy } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const MAX_FILE_SIZE = 256 * 1024 * 1024;
const MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024;
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
const PRESIGNED_EXPIRES_SECONDS = 15 * 60;
const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const LOCAL_MULTIPART_ROOT = path.resolve(LOCAL_UPLOAD_ROOT, '.multipart');

type StorageProvider = 'local' | 's3';
type UploadStrategy = 'single' | 'chunked';

interface S3Config {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

interface PreparedUploadPartTarget {
  partNumber: number;
  objectKey: string;
  url: string;
  fields: Record<string, string>;
}

interface CreateUploadPlanInput {
  fileId: string;
  objectKey: string;
  uploadToken: string;
  contentType: string;
  size: number;
  chunkCount: number;
  strategy: UploadStrategy;
  requestOrigin: string;
}

interface UploadPlan {
  provider: StorageProvider;
  strategy: UploadStrategy;
  chunkSize: number;
  chunkCount: number;
  parts: PreparedUploadPartTarget[];
}

interface FinalizeUploadInput {
  fileId: string;
  objectKey: string;
  mimeType: string;
  storageProvider: MediaAssetStorageProvider;
  storageBucket: string;
  uploadStrategy: MediaAssetUploadStrategy;
  chunkCount: number | null;
}

interface FinalizedUpload {
  url: string;
  etag: string | null;
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

const hasS3Storage = () => {
  const config = resolveS3Config();
  return Boolean(config.bucket && config.endpoint && config.accessKeyId && config.accessKeySecret);
};

const normalizeEndpoint = (endpoint: string) => {
  if (!endpoint) {
    return '';
  }

  return /^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
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

const guessExtension = (fileName: string, contentType: string) => {
  const ext = path.extname(fileName).trim().toLowerCase();
  if (ext) {
    return ext;
  }

  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };

  return mimeMap[contentType] ?? '.bin';
};

const sanitizeFileName = (fileName: string) => {
  const baseName = path.basename(fileName).trim() || 'file';
  return baseName.replace(/[^a-zA-Z0-9._-]+/g, '-');
};

const getChunkCount = (size: number) => Math.max(1, Math.ceil(size / MULTIPART_CHUNK_SIZE));
const getUploadStrategy = (size: number): UploadStrategy => (size > MULTIPART_THRESHOLD ? 'chunked' : 'single');
const getChunkObjectKey = (fileId: string, partNumber: number) =>
  `multipart/${fileId}/parts/part-${String(partNumber).padStart(5, '0')}`;
const stripEtag = (etag?: string | null) => etag?.replace(/^"|"$/g, '') ?? null;
const buildCopySource = (bucket: string, objectKey: string) =>
  `/${bucket}/${objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;

const buildPublicUrl = (provider: StorageProvider, objectKey: string) => {
  if (provider === 'local') {
    return `${env.UPLOAD_PUBLIC_BASE_URL.replace(/\/$/, '')}/${objectKey}`;
  }

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

const ensureAvatarUpload = (contentType: string) => {
  if (!contentType.startsWith('image/')) {
    throw badRequest('Avatar upload only supports image files');
  }
};

export const validateUploadRequest = (input: {
  kind: string;
  fileName: string;
  contentType: string;
  size: number;
}) => {
  const fileName = sanitizeFileName(input.fileName);
  const contentType = input.contentType.trim().toLowerCase();
  const size = Number(input.size);

  if (!input.kind) {
    throw badRequest('Missing upload kind');
  }

  if (input.kind !== 'avatar') {
    throw badRequest(`Unsupported upload kind: ${input.kind}`);
  }

  if (!fileName) {
    throw badRequest('Missing file name');
  }

  if (!contentType) {
    throw badRequest('Missing content type');
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw badRequest('Invalid file size');
  }

  if (size > MAX_FILE_SIZE) {
    throw badRequest(`File is too large, max allowed is ${MAX_FILE_SIZE} bytes`);
  }

  ensureAvatarUpload(contentType);

  const strategy = getUploadStrategy(size);
  const chunkCount = strategy === 'chunked' ? getChunkCount(size) : 1;
  const storageProvider = hasS3Storage() ? 's3' : 'local';

  return {
    kind: input.kind,
    fileName,
    contentType,
    size,
    strategy,
    chunkCount,
    chunkSize: strategy === 'chunked' ? MULTIPART_CHUNK_SIZE : size,
    storageProvider,
    storageBucket: storageProvider === 's3' ? resolveS3Config().bucket : 'local',
    objectKey: `avatars/${Date.now()}-${randomUUID()}${guessExtension(fileName, contentType)}`,
    uploadToken: randomUUID(),
  };
};

const createS3PostTarget = async (input: {
  objectKey: string;
  contentType: string;
  contentLength: number;
}) => {
  const config = resolveS3Config();
  const client = createS3Client();
  const fields: Record<string, string> = {
    key: input.objectKey,
    'Content-Type': input.contentType,
    success_action_status: '204',
  };
  const conditions = [
    ['eq', '$key', input.objectKey] as ['eq', string, string],
    ['eq', '$Content-Type', input.contentType] as ['eq', string, string],
    ['content-length-range', 1, Math.max(input.contentLength, 1)] as ['content-length-range', number, number],
    { success_action_status: '204' },
  ];

  const { url, fields: signedFields } = await createPresignedPost(client, {
    Bucket: config.bucket,
    Key: input.objectKey,
    Fields: fields,
    Conditions: conditions,
    Expires: PRESIGNED_EXPIRES_SECONDS,
  });

  return {
    url,
    fields: signedFields,
  };
};

const createLocalPostTarget = (input: {
  fileId: string;
  partNumber: number;
  objectKey: string;
  uploadToken: string;
  requestOrigin: string;
}) => ({
  url: `${input.requestOrigin.replace(/\/$/, '')}/api/files/local/${input.fileId}/parts/${input.partNumber}`,
  fields: {
    key: input.objectKey,
    token: input.uploadToken,
    success_action_status: '204',
  },
});

export const createUploadPlan = async (input: CreateUploadPlanInput): Promise<UploadPlan> => {
  if (hasS3Storage()) {
    const parts = await Promise.all(
      Array.from({ length: input.chunkCount }, async (_, index) => {
        const partNumber = index + 1;
        const isSingle = input.strategy === 'single';
        const objectKey = isSingle ? input.objectKey : getChunkObjectKey(input.fileId, partNumber);
        const contentLength = isSingle
          ? input.size
          : partNumber === input.chunkCount
            ? input.size - MULTIPART_CHUNK_SIZE * (input.chunkCount - 1)
            : MULTIPART_CHUNK_SIZE;
        const target = await createS3PostTarget({
          objectKey,
          contentType: input.contentType,
          contentLength,
        });

        return {
          partNumber,
          objectKey,
          ...target,
        };
      }),
    );

    return {
      provider: 's3',
      strategy: input.strategy,
      chunkSize: input.strategy === 'chunked' ? MULTIPART_CHUNK_SIZE : input.size,
      chunkCount: input.chunkCount,
      parts,
    };
  }

  return {
    provider: 'local',
    strategy: input.strategy,
    chunkSize: input.strategy === 'chunked' ? MULTIPART_CHUNK_SIZE : input.size,
    chunkCount: input.chunkCount,
    parts: Array.from({ length: input.chunkCount }, (_, index) => {
      const partNumber = index + 1;
      const objectKey = input.strategy === 'single' ? input.objectKey : getChunkObjectKey(input.fileId, partNumber);
      const target = createLocalPostTarget({
        fileId: input.fileId,
        partNumber,
        objectKey,
        uploadToken: input.uploadToken,
        requestOrigin: input.requestOrigin,
      });

      return {
        partNumber,
        objectKey,
        ...target,
      };
    }),
  };
};

const getLocalFinalPath = (objectKey: string) => path.resolve(LOCAL_UPLOAD_ROOT, objectKey);
const getLocalMultipartDir = (fileId: string) => path.resolve(LOCAL_MULTIPART_ROOT, fileId);
const getLocalPartPath = (fileId: string, partNumber: number) =>
  path.resolve(getLocalMultipartDir(fileId), `part-${String(partNumber).padStart(5, '0')}`);

export const storeLocalPart = async (input: {
  fileId: string;
  objectKey: string;
  uploadStrategy: MediaAssetUploadStrategy;
  partNumber: number;
  fileBuffer: Buffer;
}) => {
  if (input.uploadStrategy === 'SINGLE') {
    const finalPath = getLocalFinalPath(input.objectKey);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, input.fileBuffer);
    return;
  }

  const partPath = getLocalPartPath(input.fileId, input.partNumber);
  await fs.mkdir(path.dirname(partPath), { recursive: true });
  await fs.writeFile(partPath, input.fileBuffer);
};

const assertLocalFileExists = async (targetPath: string) => {
  await fs.access(targetPath);
};

const finalizeLocalUpload = async (input: FinalizeUploadInput): Promise<FinalizedUpload> => {
  const finalPath = getLocalFinalPath(input.objectKey);

  if (input.uploadStrategy === 'SINGLE') {
    await assertLocalFileExists(finalPath);
    const fileBuffer = await fs.readFile(finalPath);
    return {
      url: buildPublicUrl('local', input.objectKey),
      etag: createHash('md5').update(fileBuffer).digest('hex'),
    };
  }

  const chunkCount = input.chunkCount ?? 0;
  if (chunkCount <= 1) {
    throw badRequest('Invalid chunk metadata');
  }

  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.writeFile(finalPath, Buffer.alloc(0));

  for (let partNumber = 1; partNumber <= chunkCount; partNumber += 1) {
    const partPath = getLocalPartPath(input.fileId, partNumber);
    const fileBuffer = await fs.readFile(partPath);
    await fs.appendFile(finalPath, fileBuffer);
  }

  const completedBuffer = await fs.readFile(finalPath);
  await fs.rm(getLocalMultipartDir(input.fileId), { recursive: true, force: true });

  return {
    url: buildPublicUrl('local', input.objectKey),
    etag: createHash('md5').update(completedBuffer).digest('hex'),
  };
};

const finalizeS3Upload = async (input: FinalizeUploadInput): Promise<FinalizedUpload> => {
  const client = createS3Client();
  const bucket = input.storageBucket;

  if (input.uploadStrategy === 'SINGLE') {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
      }),
    );

    return {
      url: buildPublicUrl('s3', input.objectKey),
      etag: stripEtag(head.ETag),
    };
  }

  const chunkCount = input.chunkCount ?? 0;
  if (chunkCount <= 1) {
    throw badRequest('Invalid chunk metadata');
  }

  const createMultipartResponse = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.mimeType,
    }),
  );
  const uploadId = createMultipartResponse.UploadId;

  if (!uploadId) {
    throw badRequest('Failed to start multipart upload');
  }

  try {
    const uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];

    for (let partNumber = 1; partNumber <= chunkCount; partNumber += 1) {
      const chunkObjectKey = getChunkObjectKey(input.fileId, partNumber);
      const copyResult = await client.send(
        new UploadPartCopyCommand({
          Bucket: bucket,
          Key: input.objectKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          CopySource: buildCopySource(bucket, chunkObjectKey),
        }),
      );
      const etag = copyResult.CopyPartResult?.ETag;

      if (!etag) {
        throw badRequest(`Missing copied ETag for part ${partNumber}`);
      }

      uploadedParts.push({
        ETag: etag,
        PartNumber: partNumber,
      });
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: input.objectKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadedParts,
        },
      }),
    );
  } catch (error) {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: input.objectKey,
        UploadId: uploadId,
      }),
    ).catch(() => undefined);
    throw error;
  }

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: Array.from({ length: chunkCount }, (_, index) => ({
          Key: getChunkObjectKey(input.fileId, index + 1),
        })),
      },
    }),
  ).catch(() => undefined);

  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
    }),
  );

  return {
    url: buildPublicUrl('s3', input.objectKey),
    etag: stripEtag(head.ETag),
  };
};

export const finalizeUpload = async (input: FinalizeUploadInput) => {
  if (input.storageProvider === 'S3') {
    return finalizeS3Upload(input);
  }

  return finalizeLocalUpload(input);
};

export const getUploadPublicUrl = (provider: MediaAssetStorageProvider, objectKey: string) =>
  buildPublicUrl(provider === 'S3' ? 's3' : 'local', objectKey);





