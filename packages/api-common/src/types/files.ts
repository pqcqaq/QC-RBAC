export type UploadKind = 'avatar';
export type UploadStorageProvider = 'local' | 's3';
export type UploadStrategy = 'single' | 'chunked';

export interface UploadPreparePayload {
  kind: UploadKind;
  fileName: string;
  contentType: string;
  size: number;
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
