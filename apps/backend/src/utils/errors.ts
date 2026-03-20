export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (message = 'Resource not found') => new HttpError(404, message);
export const forbidden = (message = 'Permission denied') => new HttpError(403, message);
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
export const badRequest = (message = 'Bad request', details?: unknown) =>
  new HttpError(400, message, details);
