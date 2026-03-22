import type { PaginatedResult, QueryParams } from '@rbac/api-common';

type PaginatedRequest<TItem, TParams extends QueryParams = QueryParams> = (
  params: TParams & { page: number; pageSize: number },
) => Promise<PaginatedResult<TItem>>;

export const fetchAllPaginatedItems = async <TItem, TParams extends QueryParams = QueryParams>(
  request: PaginatedRequest<TItem, TParams>,
  params?: TParams,
  pageSize = 100,
) => {
  const items: TItem[] = [];
  let page = 1;

  while (true) {
    const response = await request({
      ...((params ?? {}) as TParams),
      page,
      pageSize,
    });

    items.push(...response.items);

    if (items.length >= response.meta.total || response.items.length === 0) {
      return items;
    }

    page += 1;
  }
};
