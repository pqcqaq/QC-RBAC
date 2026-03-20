import type { RequestAdaptor, RequestConfig } from '../core.js';

declare const uni: {
  request<T>(options: {
    url: string;
    method: string;
    data?: unknown;
    header?: Record<string, string>;
    success: (result: { statusCode: number; data: T }) => void;
    fail: (error: unknown) => void;
  }): void;
};

export const createUniAdaptor = (): RequestAdaptor => ({
  request<T>({ url, method = 'GET', data, headers }: RequestConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      uni.request<T>({
        url,
        method,
        data,
        header: headers,
        success: ({ statusCode, data: payload }) => {
          if (statusCode >= 200 && statusCode < 300) {
            resolve(payload);
            return;
          }
          const error = new Error((payload as any)?.message ?? 'Request failed') as Error & {
            status?: number;
            payload?: unknown;
          };
          error.status = statusCode;
          error.payload = payload;
          reject(error);
        },
        fail: reject,
      });
    });
  },
});
