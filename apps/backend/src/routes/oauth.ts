import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import { ok, asyncHandler } from '../utils/http';
import {
  listPermissionSummaries,
  parseOptionResolvePayload,
  parsePermissionSummarySearchPayload,
  resolvePermissionSummariesByIds,
} from '../services/rbac-options';
import {
  createOAuthApplication,
  createOAuthProvider,
  getOAuthApplicationById,
  getOAuthProviderById,
  listOAuthApplications,
  listOAuthProviders,
  removeOAuthApplication,
  removeOAuthProvider,
  updateOAuthApplication,
  updateOAuthProvider,
} from '../services/oauth-admin';

const oauthProviderPayloadSchema = z.object({
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(64),
  description: z.string().max(240).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  protocol: z.enum(['OIDC', 'OAUTH2']),
  issuer: z.string().url().nullable().optional(),
  discoveryUrl: z.string().url().nullable().optional(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  userinfoEndpoint: z.string().url().nullable().optional(),
  jwksUri: z.string().url().nullable().optional(),
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().min(1).max(256).optional(),
  defaultScopes: z.array(z.string().min(1)).default([]),
  enabled: z.boolean(),
  allowLogin: z.boolean(),
  autoRegister: z.boolean(),
  autoLinkByEmail: z.boolean(),
  usePkce: z.boolean(),
  clientAuthMethod: z.enum(['CLIENT_SECRET_BASIC', 'CLIENT_SECRET_POST']),
  claimMapping: z.object({
    subject: z.string().min(1),
    email: z.string().optional(),
    username: z.string().optional(),
    nickname: z.string().optional(),
    avatarUrl: z.string().optional(),
  }),
});

const oauthApplicationPayloadSchema = z.object({
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(64),
  description: z.string().max(240).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  homepageUrl: z.string().url().nullable().optional(),
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().min(1).max(256).optional(),
  clientType: z.enum(['PUBLIC', 'CONFIDENTIAL']),
  redirectUris: z.array(z.string().url()).min(1),
  postLogoutRedirectUris: z.array(z.string().url()).default([]),
  defaultScopes: z.array(z.string().min(1)).default([]),
  enabled: z.boolean(),
  skipConsent: z.boolean(),
  requirePkce: z.boolean(),
  allowAuthorizationCode: z.boolean(),
  allowRefreshToken: z.boolean(),
  permissionIds: z.array(z.string()).default([]),
});

const oauthManagementRouter = Router();

oauthManagementRouter.use(authMiddleware);

const handleOAuthApplicationPermissionOptions = asyncHandler(async (req, res) => {
  return ok(
    res,
    await listPermissionSummaries(parsePermissionSummarySearchPayload(req)),
    'OAuth application permission options',
  );
});

const handleOAuthApplicationPermissionOptionResolve = asyncHandler(async (req, res) => {
  return ok(
    res,
    await resolvePermissionSummariesByIds(parseOptionResolvePayload(req).ids),
    'Resolved OAuth application permission options',
  );
});

oauthManagementRouter.get(
  '/providers',
  requirePermission('oauth-provider.read'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await listOAuthProviders(req.query as { q?: string; enabled?: string }),
      'OAuth provider list',
    );
  }),
);

oauthManagementRouter.get(
  '/providers/:id',
  requirePermission('oauth-provider.read'),
  asyncHandler(async (req, res) => {
    return ok(res, await getOAuthProviderById(String(req.params.id)), 'OAuth provider detail');
  }),
);

oauthManagementRouter.post(
  '/providers',
  requirePermission('oauth-provider.create'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await createOAuthProvider(oauthProviderPayloadSchema.parse(req.body)),
      'OAuth provider created',
    );
  }),
);

oauthManagementRouter.put(
  '/providers/:id',
  requirePermission('oauth-provider.update'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await updateOAuthProvider(String(req.params.id), oauthProviderPayloadSchema.parse(req.body)),
      'OAuth provider updated',
    );
  }),
);

oauthManagementRouter.delete(
  '/providers/:id',
  requirePermission('oauth-provider.delete'),
  asyncHandler(async (req, res) => {
    return ok(res, await removeOAuthProvider(String(req.params.id)), 'OAuth provider deleted');
  }),
);

oauthManagementRouter.get(
  '/applications',
  requirePermission('oauth-application.read'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await listOAuthApplications(req.query as { q?: string; enabled?: string }),
      'OAuth application list',
    );
  }),
);

oauthManagementRouter.get(
  '/applications/options/permissions',
  requireAnyPermission(
    'oauth-application.read',
    'oauth-application.create',
    'oauth-application.update',
  ),
  handleOAuthApplicationPermissionOptions,
);

oauthManagementRouter.post(
  '/applications/options/permissions',
  requireAnyPermission(
    'oauth-application.read',
    'oauth-application.create',
    'oauth-application.update',
  ),
  handleOAuthApplicationPermissionOptions,
);

oauthManagementRouter.post(
  '/applications/options/permissions/resolve',
  requireAnyPermission(
    'oauth-application.read',
    'oauth-application.create',
    'oauth-application.update',
  ),
  handleOAuthApplicationPermissionOptionResolve,
);

oauthManagementRouter.get(
  '/applications/:id',
  requirePermission('oauth-application.read'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await getOAuthApplicationById(String(req.params.id)),
      'OAuth application detail',
    );
  }),
);

oauthManagementRouter.post(
  '/applications',
  requirePermission('oauth-application.create'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await createOAuthApplication(oauthApplicationPayloadSchema.parse(req.body)),
      'OAuth application created',
    );
  }),
);

oauthManagementRouter.put(
  '/applications/:id',
  requirePermission('oauth-application.update'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await updateOAuthApplication(
        String(req.params.id),
        oauthApplicationPayloadSchema.parse(req.body),
      ),
      'OAuth application updated',
    );
  }),
);

oauthManagementRouter.delete(
  '/applications/:id',
  requirePermission('oauth-application.delete'),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await removeOAuthApplication(String(req.params.id)),
      'OAuth application deleted',
    );
  }),
);

export { oauthManagementRouter };
