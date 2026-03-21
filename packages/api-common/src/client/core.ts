import type { ApiEnvelope, QueryParams } from '../types/common.js';

export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  headers?: Record<string, string>;
  params?: QueryParams;
}

export interface RequestAdaptor {
  request<T>(config: RequestConfig): Promise<T>;
}

export interface ClientOptions {
  baseUrl: string;
  adaptor: RequestAdaptor;
  getAccessToken?: () => string | null | undefined;
  getDefaultHeaders?: () => Record<string, string> | undefined;
  onUnauthorized?: () => boolean | void | Promise<boolean | void>;
}

const isFormDataLike = (value: unknown) =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const hasStatusCode = (error: unknown): error is { status: number } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number';

const buildUrl = (baseUrl: string, url: string, params?: RequestConfig['params']) => {
  const normalized = `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
  if (!params) {
    return normalized;
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${normalized}?${query}` : normalized;
};

export const createRequestClient = ({
  adaptor,
  baseUrl,
  getAccessToken,
  getDefaultHeaders,
  onUnauthorized,
}: ClientOptions) => {
  const send = async <T>(config: RequestConfig, retried = false): Promise<T> => {
    try {
      const accessToken = getAccessToken?.();
      const defaultHeaders = getDefaultHeaders?.() ?? {};
      const isFormData = isFormDataLike(config.data);
      return await adaptor.request<ApiEnvelope<T>>({
        ...config,
        url: buildUrl(baseUrl, config.url, config.params),
        headers: {
          ...(!isFormData
            ? {
                'Content-Type': 'application/json',
              }
            : {}),
          ...(accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : {}),
          ...defaultHeaders,
          ...(config.headers ?? {}),
        },
      }).then((response) => response.data);
    } catch (error: unknown) {
      if (hasStatusCode(error) && error.status === 401) {
        const shouldRetry = await onUnauthorized?.();
        if (shouldRetry && !retried) {
          return send<T>(config, true);
        }
      }
      throw error;
    }
  };

  return {
    request: <T>(config: RequestConfig) => send<T>(config),
  };
};
