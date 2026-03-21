import type { CustomRequestOptions, QueryParams, RequestHeaders } from '@/http/types'
import { http } from './http'

/*
 * openapi-ts-request 工具的 request 跨客户端适配方法
 */
type ResponseWithData<TData = unknown> = {
  data?: TData
}

export default function request<T extends ResponseWithData>(
  url: string,
  options: Omit<CustomRequestOptions, 'url'> & {
    params?: QueryParams
    headers?: RequestHeaders
  },
) {
  const requestOptions = {
    url,
    ...options,
  }

  if (options.params) {
    requestOptions.query = requestOptions.params
    delete requestOptions.params
  }

  if (options.headers) {
    requestOptions.header = options.headers
    delete requestOptions.headers
  }

  return http<T['data']>(requestOptions)
}
