export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

export type OptionSearchPayload<TFilters extends QueryParams = QueryParams> = TFilters & {
  page?: number;
  pageSize?: number;
};

export type OptionListQuery<TFilters extends QueryParams = QueryParams> =
  OptionSearchPayload<TFilters>;

export interface OptionResolvePayload {
  ids: string[];
}

export type OptionResolveRequest<TItem> = (ids: string[]) => Promise<TItem[]>;

export type OptionEndpoint<
  TItem,
  TResult,
  TPayload extends OptionSearchPayload = OptionSearchPayload,
> = ((payload?: TPayload) => Promise<TResult>) & {
  resolve: OptionResolveRequest<TItem>;
};

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
