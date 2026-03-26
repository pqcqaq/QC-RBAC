import type { PaginatedResult, QueryParams } from './common';

export type UploadKind = 'avatar' | 'attachment';
export type UploadStorageProvider = 'local' | 's3';
export type UploadStrategy = 'single' | 'chunked';
export type MediaAssetUploadStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface UploadPreparePayload {
  kind: UploadKind;
  fileName: string;
  contentType: string;
  size: number;
  tag1?: string | null;
  tag2?: string | null;
}

export interface UploadPartTarget {
  partNumber: number;
  objectKey: string;
  url: string;
  fields: Record<string, string>;
}

export interface UploadPrepareResult {
  fileId: string;
  provider: UploadStorageProvider;
  strategy: UploadStrategy;
  chunkSize: number;
  chunkCount: number;
  parts: UploadPartTarget[];
}

export interface UploadCallbackPayload {
  fileId: string;
}

export interface UploadCallbackResult {
  fileId: string;
  url: string;
}

export interface MediaAssetOwnerSummary {
  id: string;
  username: string;
  nickname: string;
}

export interface MediaAssetRecord {
  id: string;
  userId: string;
  kind: UploadKind | string;
  originalName: string;
  mimeType: string;
  size: number;
  storageProvider: UploadStorageProvider;
  storageBucket: string;
  objectKey: string;
  uploadStatus: MediaAssetUploadStatus;
  uploadStrategy: UploadStrategy;
  tag1?: string | null;
  tag2?: string | null;
  etag?: string | null;
  url?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  owner: MediaAssetOwnerSummary;
}

export interface MediaAssetUpdatePayload {
  originalName: string;
  tag1?: string | null;
  tag2?: string | null;
}

export interface MediaAssetListQuery extends QueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: string;
  uploadStatus?: MediaAssetUploadStatus;
  mimePrefix?: string;
  tag1?: string;
  tag2?: string;
  maxSize?: number;
}

export type PaginatedMediaAssets = PaginatedResult<MediaAssetRecord>;
