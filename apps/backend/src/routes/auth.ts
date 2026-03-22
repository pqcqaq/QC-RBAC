import type { Prisma } from '@prisma/client';
import { AuthClientType, isSameAuthClientIdentity } from '@rbac/api-common';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { cacheDel, cacheSet } from '../lib/redis';
import { authMiddleware } from '../middlewares/auth';
import { authClientMiddleware } from '../middlewares/auth-client';
import { forbidden, HttpError, unauthorized } from '../utils/errors';
import { ok, asyncHandler } from '../utils/http';
import { logActivity } from '../utils/audit';
import { withSnowflakeId } from '../utils/persistence';
import { setRequestActorId } from '../utils/request-context';
import {
  buildCurrentUser,
  getUserWithRelations,
  invalidatePermissionCache,
  mapUserRecord,
} from '../utils/rbac';
import { normalizeUserPreferences, userPreferencesSchema } from '../utils/user-preferences';
import {
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token';
import { authService } from '../services/auth-service';
import { clearBrowserSessionCookie, setBrowserSessionCookie } from '../utils/browser-session';
import { buildExternalProviderAuthorizeUrl, exchangeOAuthLoginTicket, handleExternalProviderCallback } from '../services/oauth-auth-server';
import { issueUserSession, revokeUserRefreshToken } from '../services/session-service';

const loginSchema = z.union([
  z.object({
    account: z.string().min(3),
    password: z.string().min(6),
  }),
  z.object({
    strategyCode: z.string().min(1),
    identifier: z.string().min(1),
    password: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
  }),
]);

const registerSchema = z.union([
  z.object({
    username: z.string().min(3).max(24),
    email: z.string().email(),
    password: z.string().min(8).max(32),
    nickname: z.string().min(2).max(24),
  }),
  z.object({
    strategyCode: z.string().min(1),
    identifier: z.string().min(1),
    username: z.string().min(3).max(24),
    nickname: z.string().min(2).max(24),
    password: z.string().min(8).max(32).optional(),
    code: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
  }),
]);

const sendVerificationCodeSchema = z.object({
  strategyCode: z.string().min(1),
  identifier: z.string().min(1),
  purpose: z.enum(['LOGIN', 'REGISTER']),
});

const verifyVerificationCodeSchema = z.object({
  strategyCode: z.string().min(1),
  identifier: z.string().min(1),
  purpose: z.enum(['LOGIN', 'REGISTER']),
  code: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const oauthTicketExchangeSchema = z.object({
  ticket: z.string().min(12),
});

const authRouter = Router();

const syncBrowserSession = (
  res: Parameters<typeof ok>[0],
  client: NonNullable<Express.Request['authClient']>,
  accessToken?: string | null,
) => {
  if (client.type !== AuthClientType.WEB) {
    return;
  }

  if (accessToken) {
    setBrowserSessionCookie(res, accessToken);
    return;
  }

  clearBrowserSessionCookie(res);
};

const issueSession = async (userId: string, client: NonNullable<Express.Request['authClient']>) => {
  const tokens = await issueUserSession(userId, client);
  return tokens;
};

const revokeRefreshToken = async (refreshToken: string) => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    await cacheDel(`refresh:${payload.jti}`);
  } catch {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
};

authRouter.get(
  '/strategies',
  authClientMiddleware,
  asyncHandler(async (_req, res) => {
    return ok(res, await authService.listStrategies(), 'Auth strategies');
  }),
);

authRouter.get(
  '/oauth/providers/:code/authorize-url',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await buildExternalProviderAuthorizeUrl({
        providerCode: String(req.params.code),
        authClient: req.authClient!,
        returnTo: typeof req.query.returnTo === 'string' ? req.query.returnTo : null,
      }),
      'OAuth authorize url',
    );
  }),
);

authRouter.get(
  '/oauth/providers/:code/callback',
  asyncHandler(async (req, res) => {
    const redirect = await handleExternalProviderCallback({
      providerCode: String(req.params.code),
      state: String(req.query.state ?? ''),
      code: String(req.query.code ?? ''),
    });

    res.redirect(redirect.redirectUrl);
  }),
);

authRouter.post(
  '/oauth/tickets/exchange',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const payload = oauthTicketExchangeSchema.parse(req.body);
    const session = await exchangeOAuthLoginTicket({
      ticket: payload.ticket,
      authClient: req.authClient!,
    });

    syncBrowserSession(res, req.authClient!, session.tokens.accessToken);
    return ok(res, session, 'OAuth login exchanged');
  }),
);

authRouter.post(
  '/verification-codes/send',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const payload = sendVerificationCodeSchema.parse(req.body);
    return ok(res, await authService.sendVerificationCode(payload), 'Verification code sent');
  }),
);

authRouter.post(
  '/verification-codes/verify',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const payload = verifyVerificationCodeSchema.parse(req.body);
    return ok(res, await authService.verifyVerificationCode(payload), 'Verification code verified');
  }),
);

authRouter.post(
  '/register',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const client = req.authClient!;
    const payload = registerSchema.parse(req.body);
    const identity = await authService.register(payload);
    setRequestActorId(identity.user.id);

    await invalidatePermissionCache([identity.user.id]);
    await logActivity({
      actorId: identity.user.id,
      actorName: identity.user.nickname,
      action: 'auth.register',
      target: identity.identifier,
      detail: {
        strategyCode: identity.strategy.code,
        clientCode: client.code,
      },
    });

    const session = await issueSession(identity.user.id, client);
    syncBrowserSession(res, client, session.tokens.accessToken);
    return ok(res, session, 'Register success');
  }),
);

authRouter.post(
  '/login',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const client = req.authClient!;
    const payload = loginSchema.parse(req.body);
    const identity = await authService.login(payload);
    setRequestActorId(identity.user.id);

    if (identity.user.status !== 'ACTIVE') {
      throw unauthorized('Account disabled');
    }

    await logActivity({
      actorId: identity.user.id,
      actorName: identity.user.nickname,
      action: 'auth.login',
      target: identity.identifier,
      detail: {
        strategyCode: identity.strategy.code,
        clientCode: client.code,
      },
    });

    const session = await issueSession(identity.user.id, client);
    syncBrowserSession(res, client, session.tokens.accessToken);
    return ok(res, session, 'Login success');
  }),
);

authRouter.post(
  '/refresh',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const client = req.authClient!;
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    setRequestActorId(payload.sub);

    const existed = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        client: {
          select: {
            id: true,
            code: true,
            type: true,
          },
        },
      },
    });

    if (!existed || existed.expiresAt.getTime() < Date.now()) {
      throw unauthorized('Refresh token expired');
    }
    if (
      !isSameAuthClientIdentity(payload.client, client)
      || !isSameAuthClientIdentity(
        {
          id: existed.client.id,
          code: existed.client.code,
          type: existed.client.type as AuthClientType,
        },
        client,
      )
    ) {
      throw unauthorized('Refresh token client mismatch');
    }

    await revokeUserRefreshToken(refreshToken);
    const session = await issueSession(payload.sub, client);
    syncBrowserSession(res, client, session.tokens.accessToken);
    return ok(res, session, 'Refresh success');
  }),
);

authRouter.post(
  '/logout',
  authClientMiddleware,
  asyncHandler(async (req, res) => {
    const client = req.authClient!;
    const { refreshToken } = refreshSchema.parse(req.body);
    let payloadClient: Pick<typeof client, 'id' | 'code' | 'type'> | null = null;
    let payloadUserId: string | null = null;

    try {
      const payload = verifyRefreshToken(refreshToken);
      payloadClient = payload.client;
      payloadUserId = payload.sub;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
    }

    if (payloadUserId) {
      setRequestActorId(payloadUserId);
    }
    if (payloadClient && !isSameAuthClientIdentity(payloadClient, client)) {
      throw unauthorized('Refresh token client mismatch');
    }

    await revokeUserRefreshToken(refreshToken);
    syncBrowserSession(res, client, null);
    return ok(res, { ok: true }, 'Logout success');
  }),
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (req.authMode === 'oauth') {
      throw forbidden('OAuth access token cannot access this endpoint');
    }

    const auth = req.auth!;
    const user = await getUserWithRelations(auth.id);
    return ok(
      res,
      {
        ...mapUserRecord(user),
        permissions: auth.permissions,
        preferences: normalizeUserPreferences(user.preferences),
      },
      'Current user',
    );
  }),
);

authRouter.put(
  '/preferences',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (req.authMode === 'oauth') {
      throw forbidden('OAuth access token cannot access this endpoint');
    }

    const auth = req.auth!;
    const payload = userPreferencesSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: auth.id },
      data: {
        preferences: payload as Prisma.InputJsonValue,
      },
      select: {
        preferences: true,
      },
    });

    return ok(res, normalizeUserPreferences(user.preferences), 'Preferences updated');
  }),
);

export { authRouter };
