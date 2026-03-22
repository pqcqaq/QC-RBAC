import type { MediaAssetRecord } from '@rbac/api-common';
import type { MediaAsset, Prisma, User } from '../lib/prisma-generated';

export const mediaAssetWithOwnerInclude = {
  user: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.MediaAssetInclude;

type MediaAssetWithOwner = Prisma.MediaAssetGetPayload<{
  include: typeof mediaAssetWithOwnerInclude;
}>;

type MediaAssetOwnerSummary = Pick<User, 'id' | 'username' | 'nickname'>;

export type MediaAssetWithOwnerRecord = MediaAsset & {
  user: MediaAssetOwnerSummary;
};

export const toMediaAssetRecord = (asset: MediaAssetWithOwner | MediaAssetWithOwnerRecord): MediaAssetRecord => ({
  id: asset.id,
  userId: asset.userId,
  kind: asset.kind,
  originalName: asset.originalName,
  mimeType: asset.mimeType,
  size: Number(asset.size),
  storageProvider: asset.storageProvider === 'S3' ? 's3' : 'local',
  storageBucket: asset.storageBucket,
  objectKey: asset.objectKey,
  uploadStatus: asset.uploadStatus,
  uploadStrategy: asset.uploadStrategy === 'CHUNKED' ? 'chunked' : 'single',
  tag1: asset.tag1,
  tag2: asset.tag2,
  etag: asset.etag,
  url: asset.url,
  completedAt: asset.completedAt?.toISOString() ?? null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
  owner: {
    id: asset.user.id,
    username: asset.user.username,
    nickname: asset.user.nickname,
  },
});
