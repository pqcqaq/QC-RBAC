import type { CurrentUser } from '@rbac/api-common';

declare global {
  namespace Express {
    interface Request {
      auth?: CurrentUser;
    }
  }
}

export {};
