import type { NextFunction, Request, Response } from 'express';

type PaginationInput = Pick<Request, 'query'>['query'] | Record<string, unknown> | undefined | null;

export const ok = <T>(res: Response, data: T, message = 'OK') => {
  return res.json({
    success: true,
    message,
    data,
  });
};

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };

export const parsePaginationInput = (input: PaginationInput) => {
  const source = input ?? {};
  const page = Math.max(Number(source.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(source.pageSize ?? 10), 1), 50);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
};

export const parsePagination = (query: Request['query']) => parsePaginationInput(query);
