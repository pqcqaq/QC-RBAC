/**
 * 在 uniapp 的 RequestOptions 和 IUniUploadFileOptions 基础上，添加自定义参数
 */
export type Primitive = string | number | boolean | null | undefined
export type QueryValue = Primitive | Primitive[]
export type QueryParams = Record<string, QueryValue>
export type RequestData = Record<string, unknown>
export type RequestHeaders = Record<string, string>

export type CustomRequestOptions = UniApp.RequestOptions & {
  query?: QueryParams
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean
} & IUniUploadFileOptions // 添加uni.uploadFile参数类型

/** 主要提供给 openapi-ts-request 生成的代码使用 */
export type CustomRequestOptions_ = Omit<CustomRequestOptions, 'url'>

export interface HttpRequestResult<T> {
  promise: Promise<T>
  requestTask: UniApp.RequestTask
}

// 通用响应格式（兼容 msg + message 字段）
export type IResponse<T = unknown> = {
  code: number
  data: T
  message?: string
  msg?: string
  [key: string]: unknown // 允许额外属性
}

// 分页请求参数
export interface PageParams {
  page: number
  pageSize: number
  [key: string]: unknown
}

// 分页响应数据
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
