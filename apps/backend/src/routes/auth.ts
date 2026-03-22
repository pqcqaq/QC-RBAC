import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { cacheDel, cacheSet } from '../lib/redis.js';
import { authMiddleware } from '../middlewares/auth.js';
import { authClientMiddleware } from '../middlewares/auth-client.js';
import { HttpError, unauthorized } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';
import { withSnowflakeId } from '../utils/persistence.js';
import { setRequestActorId } from '../utils/request-context.js';
import {
  buildCurrentUser,
  getUserWithRelations,
  invalidatePermissionCache,
  mapUserRecord,
} from '../utils/rbac.js';
import { normalizeUserPreferences, userPreferencesSchema } from '../utils/user-preferences.js';
import {
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token.js';
import { authService } from '../services/auth-service.js';

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

const authRouter = Router();

authRouter.use(authClientMiddleware);

const issueSession = async (userId: string, client: NonNullable<Express.Request['authClient']>) => {
  const jti = randomUUID();
  const accessToken = signAccessToken(userId, client.code);
  const refresh = signRefreshToken(userId, jti, client.code);

  await prisma.refreshToken.create({
    data: withSnowflakeId({
      token: refresh.token,
      userId,
      clientId: client.id,
      expiresAt: refresh.expiresAt,
    }),
  });
  await cacheSet(`refresh:${jti}`, userId, refreshTokenTtlSeconds);

  return {
    tokens: {
      accessToken,
      refreshToken: refresh.token,
    },
    user: await buildCurrentUser(userId),
    client,
  };
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
  asyncHandler(async (_req, res) => {
    return ok(res, await authService.listStrategies(), 'Auth strategies');
  }),
);

authRouter.post(
  '/verification-codes/send',
  asyncHandler(async (req, res) => {
    const payload = sendVerificationCodeSchema.parse(req.body);
    return ok(res, await authService.sendVerificationCode(payload), 'Verification code sent');
  }),
);

authRouter.post(
  '/verification-codes/verify',
  asyncHandler(async (req, res) => {
    const payload = verifyVerificationCodeSchema.parse(req.body);
    return ok(res, await authService.verifyVerificationCode(payload), 'Verification code verified');
  }),
);

authRouter.post(
  '/register',
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

    return ok(res, await issueSession(identity.user.id, client), 'Register success');
  }),
);

authRouter.post(
  '/login',
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

    return ok(res, await issueSession(identity.user.id, client), 'Login success');
  }),
);

authRouter.post(
  '/refresh',
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
            code: true,
          },
        },
      },
    });

    if (!existed || existed.expiresAt.getTime() < Date.now()) {
      throw unauthorized('Refresh token expired');
    }
    if (payload.clientCode !== client.code || existed.client.code !== client.code) {
      throw unauthorized('Refresh token client mismatch');
    }

    await revokeRefreshToken(refreshToken);
    return ok(res, await issueSession(payload.sub, client), 'Refresh success');
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const client = req.authClient!;
    const { refreshToken } = refreshSchema.parse(req.body);
    let payloadClientCode: string | null = null;
    let payloadUserId: string | null = null;

    try {
      const payload = verifyRefreshToken(refreshToken);
      payloadClientCode = payload.clientCode;
      payloadUserId = payload.sub;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
    }

    if (payloadUserId) {
      setRequestActorId(payloadUserId);
    }
    if (payloadClientCode && payloadClientCode !== client.code) {
      throw unauthorized('Refresh token client mismatch');
    }

    await revokeRefreshToken(refreshToken);
    return ok(res, { ok: true }, 'Logout success');
  }),
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
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
