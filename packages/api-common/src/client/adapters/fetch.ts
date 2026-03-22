import type { RequestAdaptor, RequestConfig } from '../core';

export const createFetchAdaptor = (): RequestAdaptor => ({
  async request<T>({ url, method = 'GET', data, headers }: RequestConfig): Promise<T> {
    const body =
      data === undefined
        ? undefined
        : headers?.['Content-Type'] === 'application/json'
          ? JSON.stringify(data)
          : (data as BodyInit);

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(payload?.message ?? 'Request failed') as Error & { status?: number; payload?: unknown };
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload as T;
  },
});
