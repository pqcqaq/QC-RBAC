import type { UploadPartTarget, UploadPrepareResult } from '@rbac/api-common';
import { api } from '@/api/client';

const MAX_PARALLEL_UPLOADS = 3;

const postFilePart = (
  target: UploadPartTarget,
  file: Blob,
  fileName: string,
  onProgress?: (loaded: number) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.url);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`));
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload request failed'));
    });

    const formData = new FormData();
    Object.entries(target.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file, fileName);
    xhr.send(formData);
  });

const uploadSinglePart = async (
  prepared: UploadPrepareResult,
  file: File,
  reportProgress?: (percent: number) => void,
) => {
  const target = prepared.parts[0];

  await postFilePart(target, file, file.name, (loaded) => {
    reportProgress?.(Math.min(99, Math.round((loaded / file.size) * 100)));
  });
};

const uploadChunkedParts = async (
  prepared: UploadPrepareResult,
  file: File,
  reportProgress?: (percent: number) => void,
) => {
  const loadedByPart = new Map<number, number>();
  const reportLoaded = () => {
    const totalLoaded = Array.from(loadedByPart.values()).reduce((sum, current) => sum + current, 0);
    reportProgress?.(Math.min(99, Math.round((totalLoaded / file.size) * 100)));
  };

  let cursor = 0;
  const worker = async () => {
    while (cursor < prepared.parts.length) {
      const currentIndex = cursor;
      cursor += 1;
      const target = prepared.parts[currentIndex];
      const start = currentIndex * prepared.chunkSize;
      const end = Math.min(start + prepared.chunkSize, file.size);
      const chunk = file.slice(start, end);

      await postFilePart(target, chunk, `${file.name}.part-${target.partNumber}`, (loaded) => {
        loadedByPart.set(target.partNumber, loaded);
        reportLoaded();
      });

      loadedByPart.set(target.partNumber, chunk.size);
      reportLoaded();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_PARALLEL_UPLOADS, prepared.parts.length) }, () => worker()),
  );
};

export const uploadAvatarFile = async (
  file: File,
  reportProgress?: (percent: number) => void,
) => {
  const prepared = await api.files.prepareUpload({
    kind: 'avatar',
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  });

  if (prepared.strategy === 'chunked') {
    await uploadChunkedParts(prepared, file, reportProgress);
  } else {
    await uploadSinglePart(prepared, file, reportProgress);
  }

  const completed = await api.files.completeUpload({ fileId: prepared.fileId });
  reportProgress?.(100);
  return completed;
};
