import { ref } from 'vue';
import type { DownloadRequestConfig } from '@rbac/api-common';
import { createApiUrl, requestWithAuthRetry } from '@/api/client';
import { trackRequestProgress } from '@/utils/app-progress';

type UseDownloadOptions<TArgs extends unknown[]> = {
  request: (...args: TArgs) => DownloadRequestConfig;
};

const isFormDataLike = (value: unknown) =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isJsonContentType = (value: string | null) => value?.toLowerCase().includes('application/json') ?? false;

const toRequestBody = (config: DownloadRequestConfig) => {
  if (config.data === undefined) {
    return undefined;
  }

  if (isFormDataLike(config.data)) {
    return config.data;
  }

  return JSON.stringify(config.data);
};

const parseFilenameFromDisposition = (value: string | null) => {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = value.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
};

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const buildDownloadError = (message: string, status?: number, payload?: unknown) => {
  const error = new Error(message) as Error & {
    status?: number;
    payload?: unknown;
  };
  error.status = status;
  error.payload = payload;
  return error;
};

const parseErrorResponse = async (response: Response) => {
  if (isJsonContentType(response.headers.get('content-type'))) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw buildDownloadError(payload?.message ?? '下载失败', response.status, payload);
  }

  throw buildDownloadError(`下载失败 (${response.status})`, response.status);
};

const readBlobFromStream = async (
  response: Response,
  onProgress: (progress: number | null) => void,
) => {
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();
  if (!reader) {
    onProgress(null);
    return response.blob();
  }

  const chunks: BlobPart[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    chunks.push(value as BlobPart);
    received += value.byteLength;
    onProgress(total > 0 ? Math.min(99, Math.round((received / total) * 100)) : null);
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') ?? 'application/octet-stream',
  });
};

export const useDownload = <TArgs extends unknown[]>({ request }: UseDownloadOptions<TArgs>) => {
  const downloading = ref(false);
  const progress = ref<number | null>(null);

  const download = async (...args: TArgs) => {
    const config = request(...args);
    const body = toRequestBody(config);

    return trackRequestProgress(async () => {
      downloading.value = true;
      progress.value = 0;

      try {
        const response = await requestWithAuthRetry(
          createApiUrl(config.url, config.params),
          {
            method: config.method ?? 'GET',
            body: body as BodyInit | undefined,
            headers: config.headers,
          },
          config.data,
        );

        if (!response.ok) {
          await parseErrorResponse(response);
        }

        if (isJsonContentType(response.headers.get('content-type'))) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw buildDownloadError(payload?.message ?? '下载接口返回了意外的 JSON 响应', response.status, payload);
        }

        const blob = await readBlobFromStream(response, value => {
          progress.value = value;
        });

        const fileName =
          parseFilenameFromDisposition(response.headers.get('content-disposition'))
          ?? config.fileName
          ?? 'download.bin';

        progress.value = 100;
        triggerBrowserDownload(blob, fileName);

        return {
          blob,
          fileName,
        };
      } finally {
        downloading.value = false;
        window.setTimeout(() => {
          progress.value = null;
        }, 240);
      }
    });
  };

  return {
    downloading,
    progress,
    download,
  };
};
