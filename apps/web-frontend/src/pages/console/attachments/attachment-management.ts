import type {
  MediaAssetRecord,
  MediaAssetUpdatePayload,
  MediaAssetUploadStatus,
} from '@rbac/api-common';

export type AttachmentFilters = {
  q: string;
  kind: '' | 'attachment' | 'avatar';
  uploadStatus: '' | MediaAssetUploadStatus;
  tag1: string;
  tag2: string;
};

export type AttachmentEditorForm = {
  originalName: string;
  tag1: string;
  tag2: string;
};

export type AttachmentUploadForm = {
  file: File | null;
  tag1: string;
  tag2: string;
};

export const createEmptyAttachmentEditorForm = (): AttachmentEditorForm => ({
  originalName: '',
  tag1: '',
  tag2: '',
});

export const createEmptyAttachmentUploadForm = (): AttachmentUploadForm => ({
  file: null,
  tag1: '',
  tag2: '',
});

export const assignAttachmentEditorForm = (form: AttachmentEditorForm, record: MediaAssetRecord) => {
  form.originalName = record.originalName;
  form.tag1 = record.tag1 ?? '';
  form.tag2 = record.tag2 ?? '';
};

export const buildAttachmentUpdatePayload = (form: AttachmentEditorForm): MediaAssetUpdatePayload => ({
  originalName: form.originalName.trim(),
  tag1: form.tag1.trim() || null,
  tag2: form.tag2.trim() || null,
});

export const validateAttachmentEditorForm = (form: AttachmentEditorForm) => {
  if (!form.originalName.trim()) {
    return '请填写文件名称';
  }

  if (form.tag1.trim().length > 64 || form.tag2.trim().length > 64) {
    return '标签长度不能超过 64 个字符';
  }

  return undefined;
};

export const validateAttachmentUploadForm = (form: AttachmentUploadForm) => {
  if (!form.file) {
    return '请先选择文件';
  }

  if (form.tag1.trim().length > 64 || form.tag2.trim().length > 64) {
    return '标签长度不能超过 64 个字符';
  }

  return undefined;
};

export const resolveAttachmentKindLabel = (kind: string) => {
  if (kind === 'avatar') {
    return '头像';
  }

  if (kind === 'attachment') {
    return '附件';
  }

  return kind;
};

export const resolveAttachmentStatusLabel = (status: MediaAssetRecord['uploadStatus']) => {
  if (status === 'COMPLETED') {
    return '已完成';
  }

  if (status === 'FAILED') {
    return '失败';
  }

  return '上传中';
};

export const resolveAttachmentStatusType = (status: MediaAssetRecord['uploadStatus']) => {
  if (status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED') {
    return 'danger';
  }

  return 'warning';
};

export const formatAttachmentSize = (value: number) => {
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${value} B`;
};

export const formatAttachmentTagSummary = (record: MediaAssetRecord) =>
  [record.tag1, record.tag2].filter(Boolean).join(' / ') || '未设置';

export const buildAttachmentFilterParams = (filters: AttachmentFilters) => ({
  q: filters.q || undefined,
  kind: filters.kind || undefined,
  uploadStatus: filters.uploadStatus || undefined,
  tag1: filters.tag1 || undefined,
  tag2: filters.tag2 || undefined,
});
