import type { MediaAssetRecord } from '@rbac/api-common';

export const DEFAULT_AVATAR_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const DEFAULT_AVATAR_IMAGE_MAX_WIDTH = 1024;
export const DEFAULT_AVATAR_IMAGE_MAX_HEIGHT = 1024;

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
export type ImageDimensions = {
  width: number;
  height: number;
};

export type ImageDimensionLimit = {
  maxWidth?: number;
  maxHeight?: number;
};

export type ImageValidationOptions = ImageDimensionLimit & {
  accept?: string | string[];
  maxSize?: number;
};

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

export const formatImageDimensions = ({ width, height }: ImageDimensions) => `${width} × ${height}px`;

export const formatImageDimensionLimit = ({ maxWidth, maxHeight }: ImageDimensionLimit) => {
  if (maxWidth && maxHeight) {
    return `${maxWidth} × ${maxHeight}px`;
  }

  if (maxWidth) {
    return `宽度 ${maxWidth}px`;
  }

  if (maxHeight) {
    return `高度 ${maxHeight}px`;
  }

  return '';
};

export const exceedsImageDimensionLimit = (
  dimensions: ImageDimensions,
  { maxWidth, maxHeight }: ImageDimensionLimit,
) =>
  Boolean(
    (maxWidth && dimensions.width > maxWidth)
    || (maxHeight && dimensions.height > maxHeight),
  );

const loadImageDimensionsFromSource = (source: string) =>
  new Promise<ImageDimensions>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => {
      reject(new Error('Failed to load image dimensions'));
    };
    image.src = source;
  });

export const readImageDimensions = async (source: File | string) => {
  if (typeof source === 'string') {
    return loadImageDimensionsFromSource(source);
  }

  const objectUrl = URL.createObjectURL(source);

  try {
    return await loadImageDimensionsFromSource(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const validateImageFile = async (
  file: File,
  { accept, maxSize, maxWidth, maxHeight }: ImageValidationOptions,
) => {
  if (!matchImageAccept(file, accept)) {
    return `图片格式不支持，仅支持 ${formatImageAcceptText(accept)}`;
  }

  if (maxSize && file.size > maxSize) {
    return `图片大小不能超过 ${formatFileSize(maxSize)}`;
  }

  if (maxWidth || maxHeight) {
    let dimensions: ImageDimensions;

    try {
      dimensions = await readImageDimensions(file);
    } catch {
      return '无法读取图片尺寸，请更换文件后重试';
    }

    if (exceedsImageDimensionLimit(dimensions, { maxWidth, maxHeight })) {
      return `图片尺寸不能超过 ${formatImageDimensionLimit({ maxWidth, maxHeight })}，当前为 ${formatImageDimensions(dimensions)}`;
    }
  }

  return undefined;
};

export const resolveImageSummary = (
  record: MediaAssetRecord,
  dimensions?: ImageDimensions | null,
) => {
  const tagSummary = [record.tag1, record.tag2].filter(Boolean).join(' / ');
  return [
    formatFileSize(record.size),
    dimensions ? formatImageDimensions(dimensions) : '',
    tagSummary || record.mimeType,
  ]
    .filter(Boolean)
    .join(' · ');
};
