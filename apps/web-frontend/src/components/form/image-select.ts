import type { MediaAssetRecord } from '@rbac/api-common';

const KNOWN_IMAGE_EXTENSIONS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

export type ImageSelectSearchParams = Record<string, string | number | null | undefined>;

export const normalizeImageAccept = (accept?: string | string[]) => {
  if (!accept) {
    return ['image/*'];
  }

  const entries = Array.isArray(accept) ? accept : accept.split(',');
  return [...new Set(entries.map((item) => item.trim()).filter(Boolean))];
};

export const buildImageAcceptAttribute = (accept?: string | string[]) =>
  normalizeImageAccept(accept).join(',');

export const resolveFileExtension = (fileName: string) => {
  const segments = fileName.split('.');
  return segments.length > 1 ? segments.at(-1)?.trim().toLowerCase() ?? '' : '';
};

export const isImageFile = (file: Pick<File, 'name' | 'type'>) => {
  if (file.type.trim().toLowerCase().startsWith('image/')) {
    return true;
  }

  return KNOWN_IMAGE_EXTENSIONS.has(resolveFileExtension(file.name));
};

const matchesAcceptToken = (file: Pick<File, 'name' | 'type'>, token: string) => {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) {
    return true;
  }

  const fileType = file.type.trim().toLowerCase();
  const extension = resolveFileExtension(file.name);

  if (normalizedToken === 'image/*') {
    return isImageFile(file);
  }

  if (normalizedToken.endsWith('/*')) {
    const prefix = normalizedToken.slice(0, normalizedToken.length - 1);
    return Boolean(fileType) && fileType.startsWith(prefix);
  }

  if (normalizedToken.startsWith('.')) {
    return extension === normalizedToken.slice(1);
  }

  return Boolean(fileType) && fileType === normalizedToken;
};

export const matchImageAccept = (file: Pick<File, 'name' | 'type'>, accept?: string | string[]) =>
  normalizeImageAccept(accept).some((token) => matchesAcceptToken(file, token));

export const formatImageAcceptText = (accept?: string | string[]) =>
  normalizeImageAccept(accept)
    .map((token) => {
      if (token === 'image/*') {
        return '常见图片格式';
      }

      if (token.startsWith('.')) {
        return token.slice(1).toUpperCase();
      }

      if (token.endsWith('/*')) {
        return `${token.slice(0, token.length - 2).toUpperCase()} 文件`;
      }

      const segments = token.split('/');
      return (segments.at(-1) ?? token).toUpperCase();
    })
    .join(' / ');

export const formatFileSize = (value: number) => {
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

export const resolveImageSummary = (record: MediaAssetRecord) => {
  const tagSummary = [record.tag1, record.tag2].filter(Boolean).join(' / ');
  return [formatFileSize(record.size), tagSummary || record.mimeType].join(' · ');
};
