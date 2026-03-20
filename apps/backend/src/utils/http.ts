import type { NextFunction, Request, Response } from 'express';

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

export const parsePagination = (query: Request['query']) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 10), 1), 50);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
};
