import type { AuthClientSummary, CurrentUser } from '@rbac/api-common';

declare global {
  namespace Express {
    interface Request {
      auth?: CurrentUser;
      authClient?: AuthClientSummary;
      authMode?: 'local' | 'oauth';
      oauthApplication?: {
        id: string;
        code: string;
        clientId: string;
      };
    }
  }
}

export {};
