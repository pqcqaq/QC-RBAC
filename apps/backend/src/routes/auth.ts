import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { cacheDel, cacheSet } from '../lib/redis.js';
import { authMiddleware } from '../middlewares/auth.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { ok, asyncHandler } from '../utils/http.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { logActivity } from '../utils/audit.js';
import {
  buildCurrentUser,
  getUserWithRelations,
  invalidatePermissionCache,
  mapUserRecord,
} from '../utils/rbac.js';
import {
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token.js';

const loginSchema = z.object({
  account: z.string().min(3),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email(),
  password: z.string().min(8).max(32),
  nickname: z.string().min(2).max(24),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const authRouter = Router();

const issueSession = async (userId: string) => {
  const jti = randomUUID();
  const accessToken = signAccessToken(userId);
  const refresh = signRefreshToken(userId, jti);

  await prisma.refreshToken.create({
    data: {
      token: refresh.token,
      userId,
      expiresAt: refresh.expiresAt,
    },
  });
  await cacheSet(`refresh:${jti}`, userId, refreshTokenTtlSeconds);

  return {
    tokens: {
      accessToken,
      refreshToken: refresh.token,
    },
    user: await buildCurrentUser(userId),
  };
};

const revokeRefreshToken = async (refreshToken: string) => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    await cacheDel(`refresh:${payload.jti}`);
  } catch (error) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
};

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);

    const existed = await prisma.user.findFirst({
      where: {
        OR: [{ username: payload.username }, { email: payload.email }],
      },
      select: { id: true },
    });

    if (existed) {
      throw badRequest('Username or email already exists');
    }

    const memberRole = await prisma.role.findFirst({ where: { code: 'member' } });
    if (!memberRole) {
      throw badRequest('Default role not initialized');
    }

    const user = await prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        nickname: payload.nickname,
        passwordHash: await hashPassword(payload.password),
        roles: {
          create: [{ roleId: memberRole.id }],
        },
      },
    });

    await invalidatePermissionCache([user.id]);
    await logActivity({
      actorId: user.id,
      actorName: payload.nickname,
      action: 'auth.register',
      target: payload.email,
    });

    return ok(res, await issueSession(user.id), 'Register success');
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: payload.account }, { username: payload.account }],
      },
    });

    if (!user) {
      throw unauthorized('Account not found');
    }
    if (user.status !== 'ACTIVE') {
      throw unauthorized('Account disabled');
    }

    const matched = await comparePassword(payload.password, user.passwordHash);
    if (!matched) {
      throw unauthorized('Incorrect password');
    }

    await logActivity({
      actorId: user.id,
      actorName: user.nickname,
      action: 'auth.login',
      target: user.email,
    });

    return ok(res, await issueSession(user.id), 'Login success');
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(refreshToken);

    const existed = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!existed || existed.expiresAt.getTime() < Date.now()) {
      throw unauthorized('Refresh token expired');
    }

    await revokeRefreshToken(refreshToken);
    return ok(res, await issueSession(payload.sub), 'Refresh success');
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
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
      },
      'Current user',
    );
  }),
);

export { authRouter };


