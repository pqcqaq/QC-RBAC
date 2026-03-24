import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../lib/prisma-generated';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors';
import { markRequestFailure } from '../utils/request-context';

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (res.headersSent) {
    markRequestFailure(error);
    console.error(error);
    return;
  }

  if (error instanceof ZodError) {
    markRequestFailure(error);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      data: error.flatten(),
    });
    return;
  }

  if (error instanceof HttpError) {
    markRequestFailure(error);
    console.error(error);
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: error.details ?? null,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      markRequestFailure(error);
      res.status(400).json({
        success: false,
        message: `Unique constraint failed: ${(error.meta?.target as string[] | undefined)?.join(', ') ?? 'duplicate value'}`,
        data: error.meta ?? null,
      });
      return;
    }

    if (error.code === 'P2003') {
      markRequestFailure(error);
      res.status(400).json({
        success: false,
        message: 'Referenced resource does not exist',
        data: error.meta ?? null,
      });
      return;
    }

    if (error.code === 'P2025') {
      markRequestFailure(error);
      res.status(404).json({
        success: false,
        message: 'Resource not found',
        data: error.meta ?? null,
      });
      return;
    }
  }

  markRequestFailure(error);
  console.error(error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    data: null,
  });
};
