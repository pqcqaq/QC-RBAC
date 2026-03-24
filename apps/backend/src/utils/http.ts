import type { NextFunction, Request, Response } from 'express';
import { runInBackendRuntimeTransaction } from '../lib/runtime-transaction';
import { markRequestFailure } from './request-context';

type PaginationInput = Pick<Request, 'query'>['query'] | Record<string, unknown> | undefined | null;

class HandledTransactionalResponseError extends Error {
  readonly causeError: unknown;

  constructor(causeError?: unknown) {
    super('Handled response requires transaction rollback');
    this.causeError = causeError ?? null;
  }
}

export const ok = <T>(res: Response, data: T, message = 'OK') => {
  return res.json({
    success: true,
    message,
    data,
  });
};

export const rollbackHandledResponse = (error?: unknown) => new HandledTransactionalResponseError(error);

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await runInBackendRuntimeTransaction(async () => {
        await handler(req, res, next);
        return undefined;
      });
    } catch (error) {
      if (
        error instanceof HandledTransactionalResponseError
        && (res.headersSent || res.writableEnded)
      ) {
        markRequestFailure(error.causeError ?? error);
        return;
      }
      next(error);
    }
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
