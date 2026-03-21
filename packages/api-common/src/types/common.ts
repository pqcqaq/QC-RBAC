export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface OptionItem {
  label: string;
  value: string;
}
