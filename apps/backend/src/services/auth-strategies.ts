import type {
  AuthIdentifierType,
  AuthStrategy,
  AuthVerificationPurpose,
  Prisma,
  User,
} from '../lib/prisma-generated';
import { prisma, prismaRaw } from '../lib/prisma';
import { badRequest, unauthorized } from '../utils/errors';
import { comparePassword, compareSecret, hashPassword, hashSecret } from '../utils/password';
import { withSnowflakeId, withSnowflakeIds } from '../utils/persistence';
import { getRequestActorId } from '../utils/request-context';
import { addSeconds } from '../utils/time';
import { syncUserRoles } from './rbac-write';

const verificationCodeTtlSeconds = 60 * 5;

type UserAuthenticationWithUser = Prisma.UserAuthenticationGetPayload<{
  include: { user: true };
}>;

export type StrategyVerificationCodeSendResult = {
  expiresAt: Date;
  mockCode?: string;
};

export type StrategyVerificationCodeCheckResult = {
  expiresAt: Date;
  valid: true;
};

export type StrategyLoginInput = {
  strategy: AuthStrategy;
  identifier: string;
  password?: string;
  code?: string;
};

export type StrategyRegisterInput = {
  strategy: AuthStrategy;
  identifier: string;
  username: string;
  nickname: string;
  password?: string;
  email?: string | null;
  code?: string;
};

export type StrategySendVerificationCodeInput = {
  strategy: AuthStrategy;
  identifier: string;
  purpose: AuthVerificationPurpose;
};

export type StrategyVerifyCodeInput = {
  strategy: AuthStrategy;
  identifier: string;
  purpose: AuthVerificationPurpose;
  code: string;
  consume: boolean;
};

export type StrategySyncProfileInput = {
  strategy: AuthStrategy;
  userId: string;
  username: string;
  email?: string | null;
  password?: string;
};

export interface AuthStrategyHandler {
  code: string;
  login(input: StrategyLoginInput): Promise<User>;
  register(input: StrategyRegisterInput): Promise<User>;
  sendVerificationCode?(input: StrategySendVerificationCodeInput): Promise<StrategyVerificationCodeSendResult>;
  verifyCode?(input: StrategyVerifyCodeInput): Promise<StrategyVerificationCodeCheckResult>;
  syncUserProfile?(input: StrategySyncProfileInput): Promise<void>;
}

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');

export const normalizeIdentifier = (identifierType: AuthIdentifierType, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw badRequest('Identifier is required');
  }

  if (identifierType === 'EMAIL') {
    return trimmed.toLowerCase();
  }

  if (identifierType === 'PHONE') {
    const normalized = normalizePhone(trimmed);
    if (normalized.length < 6) {
      throw badRequest('Phone number is invalid');
    }
    return normalized;
  }

  return trimmed;
};

const assertUsername = (value: string) => {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 24) {
    throw badRequest('Username must be between 3 and 24 characters');
  }
  return normalized;
};

const assertNickname = (value: string) => {
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 24) {
    throw badRequest('Nickname must be between 2 and 24 characters');
  }
  return normalized;
};

const assertOptionalEmail = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalized)) {
    throw badRequest('Email is invalid');
  }
  return normalized;
};

const createRandomCode = () => String(Math.floor(100000 + Math.random() * 900000));

const resolveEmailCodeStrategy = async () => prisma.authStrategy.findUnique({
  where: { code: 'email-code' },
  select: { id: true },
});

const ensureMemberRoleId = async () => {
  const memberRole = await prisma.role.findFirst({
    where: { code: 'member' },
    select: { id: true },
  });

  if (!memberRole) {
    throw badRequest('Default role not initialized');
  }

  return memberRole.id;
};

const assertUserProfileAvailability = async (username: string, email?: string | null) => {
  const existed = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true, username: true, email: true },
  });

  if (!existed) {
    return;
  }

  if (existed.username === username) {
    throw badRequest('Username already exists');
  }

  throw badRequest('Email already exists');
};

const createRegisteredUser = async (input: {
  strategy: AuthStrategy;
  identifier: string;
  username: string;
  nickname: string;
  email?: string | null;
  credentialHash?: string | null;
  salt?: string | null;
}) => {
  const memberRoleId = await ensureMemberRoleId();
  const emailIdentifier = assertOptionalEmail(input.email);
  const emailStrategy = emailIdentifier && input.strategy.code !== 'email-code'
    ? await resolveEmailCodeStrategy()
    : null;

  const user = await prisma.user.create({
    data: withSnowflakeId({
      username: input.username,
      email: emailIdentifier,
      nickname: input.nickname,
    }),
  });

  await syncUserRoles(user.id, [memberRoleId]);
  await prisma.userAuthentication.createMany({
    data: withSnowflakeIds([
      {
        userId: user.id,
        strategyId: input.strategy.id,
        identifier: input.identifier,
        credentialHash: input.credentialHash ?? null,
        salt: input.salt ?? null,
        verifiedAt: new Date(),
      },
      ...(emailStrategy
        ? [{
            userId: user.id,
            strategyId: emailStrategy.id,
            identifier: emailIdentifier!,
          }]
        : []),
    ]),
  });

  return user;
};

const upsertUserAuthenticationByUserAndStrategy = async (input: {
  userId: string;
  strategyId: string;
  identifier: string;
  credentialHash?: string | null;
  salt?: string | null;
  verifiedAt?: Date | null;
}) => {
  const actorId = getRequestActorId();
  const record = await prismaRaw.userAuthentication.findFirst({
    where: {
      userId: input.userId,
      strategyId: input.strategyId,
    },
    select: { id: true },
  });

  const data: Prisma.UserAuthenticationUncheckedUpdateInput = {
    identifier: input.identifier,
    deleteAt: null,
    updateId: actorId,
  };
  if (Object.prototype.hasOwnProperty.call(input, 'credentialHash')) {
    data.credentialHash = input.credentialHash ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'salt')) {
    data.salt = input.salt ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'verifiedAt')) {
    data.verifiedAt = input.verifiedAt ?? null;
  }

  if (record) {
    await prismaRaw.userAuthentication.update({
      where: { id: record.id },
      data,
    });
    return;
  }

  await prisma.userAuthentication.create({
    data: withSnowflakeId({
      userId: input.userId,
      strategyId: input.strategyId,
      identifier: input.identifier,
      ...(Object.prototype.hasOwnProperty.call(input, 'credentialHash')
        ? { credentialHash: input.credentialHash ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, 'salt')
        ? { salt: input.salt ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, 'verifiedAt')
        ? { verifiedAt: input.verifiedAt ?? null }
        : {}),
    }),
  });
};

abstract class BaseVerificationCodeStrategy implements AuthStrategyHandler {
  abstract code: string;
  protected abstract resolveRegisterEmail(identifier: string, input: StrategyRegisterInput): string | null;

  protected async assertSendAllowed(input: StrategySendVerificationCodeInput) {
    const existed = await prisma.userAuthentication.findUnique({
      where: {
        strategyId_identifier: {
          strategyId: input.strategy.id,
          identifier: input.identifier,
        },
      },
      select: { id: true },
    });

    if (input.purpose === 'LOGIN' && !existed) {
      throw unauthorized('Account not found');
    }

    if (input.purpose === 'REGISTER' && existed) {
      throw badRequest('Identifier already registered');
    }
  }

  protected async assertAndConsumeCode(input: StrategyVerifyCodeInput) {
    const record = await prisma.verificationCode.findFirst({
      where: {
        strategyId: input.strategy.id,
        identifier: input.identifier,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw unauthorized('Verification code invalid or expired');
    }

    const matched = await compareSecret(input.code, record.codeHash, record.salt);
    if (!matched) {
      throw unauthorized('Verification code invalid or expired');
    }

    if (input.consume) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
    }

    return record.expiresAt;
  }

  async sendVerificationCode(input: StrategySendVerificationCodeInput) {
    await this.assertSendAllowed(input);

    if (!input.strategy.mockEnabled && !input.strategy.mockValue) {
      throw badRequest('Verification transport is not implemented');
    }

    const nextCode = input.strategy.mockEnabled && input.strategy.mockValue
      ? input.strategy.mockValue
      : createRandomCode();
    const secret = await hashSecret(nextCode);
    const expiresAt = addSeconds(new Date(), verificationCodeTtlSeconds);

    await prisma.verificationCode.deleteMany({
      where: {
        strategyId: input.strategy.id,
        identifier: input.identifier,
        purpose: input.purpose,
        consumedAt: null,
      },
    });

    await prisma.verificationCode.create({
      data: withSnowflakeId({
        strategyId: input.strategy.id,
        identifier: input.identifier,
        purpose: input.purpose,
        codeHash: secret.hash,
        salt: secret.salt,
        expiresAt,
      }),
    });

    return {
      expiresAt,
      ...(input.strategy.mockEnabled ? { mockCode: nextCode } : {}),
    };
  }

  async verifyCode(input: StrategyVerifyCodeInput) {
    const expiresAt = await this.assertAndConsumeCode(input);
    return {
      valid: true as const,
      expiresAt,
    };
  }

  async login(input: StrategyLoginInput) {
    if (!input.code?.trim()) {
      throw badRequest('Verification code is required');
    }

    await this.assertAndConsumeCode({
      strategy: input.strategy,
      identifier: input.identifier,
      purpose: 'LOGIN',
      code: input.code.trim(),
      consume: true,
    });

    const authentication = await prisma.userAuthentication.findUnique({
      where: {
        strategyId_identifier: {
          strategyId: input.strategy.id,
          identifier: input.identifier,
        },
      },
      include: { user: true },
    });

    if (!authentication) {
      throw unauthorized('Account not found');
    }

    return authentication.user;
  }

  async register(input: StrategyRegisterInput) {
    if (!input.code?.trim()) {
      throw badRequest('Verification code is required');
    }

    const username = assertUsername(input.username);
    const nickname = assertNickname(input.nickname);
    const email = this.resolveRegisterEmail(input.identifier, input);

    await assertUserProfileAvailability(username, email);

    const existed = await prisma.userAuthentication.findUnique({
      where: {
        strategyId_identifier: {
          strategyId: input.strategy.id,
          identifier: input.identifier,
        },
      },
      select: { id: true },
    });

    if (existed) {
      throw badRequest('Identifier already registered');
    }

    await this.assertAndConsumeCode({
      strategy: input.strategy,
      identifier: input.identifier,
      purpose: 'REGISTER',
      code: input.code.trim(),
      consume: true,
    });

    return createRegisteredUser({
      strategy: input.strategy,
      identifier: input.identifier,
      username,
      nickname,
      email,
    });
  }
}

export class UsernamePasswordStrategy implements AuthStrategyHandler {
  code = 'username-password';

  private async getAuthenticationByIdentifier(strategy: AuthStrategy, identifier: string) {
    const directMatch = await prisma.userAuthentication.findUnique({
      where: {
        strategyId_identifier: {
          strategyId: strategy.id,
          identifier,
        },
      },
      include: { user: true },
    });

    if (directMatch) {
      return directMatch;
    }

    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (!emailLike) {
      return null;
    }

    return prisma.userAuthentication.findFirst({
      where: {
        strategyId: strategy.id,
        user: {
          email: identifier,
        },
      },
      include: { user: true },
    });
  }

  async login(input: StrategyLoginInput) {
    if (!input.password?.trim()) {
      throw badRequest('Password is required');
    }

    const authentication = await this.getAuthenticationByIdentifier(input.strategy, input.identifier);
    if (!authentication || !authentication.credentialHash || !authentication.salt) {
      throw unauthorized('Account not found');
    }

    const matched = await comparePassword(
      input.password,
      authentication.credentialHash,
      authentication.salt,
    );

    if (!matched) {
      throw unauthorized('Incorrect password');
    }

    return authentication.user;
  }

  async register(input: StrategyRegisterInput) {
    if (!input.password?.trim()) {
      throw badRequest('Password is required');
    }

    const username = assertUsername(input.username);
    const nickname = assertNickname(input.nickname);
    const email = assertOptionalEmail(input.email);

    await assertUserProfileAvailability(username, email);

    const existed = await prisma.userAuthentication.findUnique({
      where: {
        strategyId_identifier: {
          strategyId: input.strategy.id,
          identifier: input.identifier,
        },
      },
      select: { id: true },
    });

    if (existed) {
      throw badRequest('Username already registered');
    }

    const secret = await hashPassword(input.password.trim());

    return createRegisteredUser({
      strategy: input.strategy,
      identifier: input.identifier,
      username,
      nickname,
      email,
      credentialHash: secret.hash,
      salt: secret.salt,
    });
  }

  async syncUserProfile(input: StrategySyncProfileInput) {
    const identifier = normalizeIdentifier('USERNAME', input.username);
    let nextCredentialHash: string | null = null;
    let nextSalt: string | null = null;
    let verifiedAt: Date | null = null;

    if (input.password?.trim()) {
      const secret = await hashPassword(input.password.trim());
      verifiedAt = new Date();
      nextCredentialHash = secret.hash;
      nextSalt = secret.salt;
    }

    if (!input.password?.trim()) {
      return;
    }

    await upsertUserAuthenticationByUserAndStrategy({
      userId: input.userId,
      strategyId: input.strategy.id,
      identifier,
      credentialHash: nextCredentialHash,
      salt: nextSalt,
      verifiedAt,
    });
  }
}

export class EmailCodeStrategy extends BaseVerificationCodeStrategy {
  code = 'email-code';

  protected resolveRegisterEmail(identifier: string, _input: StrategyRegisterInput) {
    return identifier;
  }

  async syncUserProfile(input: StrategySyncProfileInput) {
    const record = await prismaRaw.userAuthentication.findFirst({
      where: {
        userId: input.userId,
        strategyId: input.strategy.id,
      },
      select: { id: true, deleteAt: true },
    });

    const emailIdentifier = assertOptionalEmail(input.email);
    if (!emailIdentifier) {
      if (record) {
        await prisma.userAuthentication.delete({
          where: { id: record.id },
        });
      }
      return;
    }

    await upsertUserAuthenticationByUserAndStrategy({
      userId: input.userId,
      strategyId: input.strategy.id,
      identifier: emailIdentifier,
    });
  }
}

export class PhoneCodeStrategy extends BaseVerificationCodeStrategy {
  code = 'phone-code';

  protected resolveRegisterEmail(_identifier: string, input: StrategyRegisterInput) {
    return assertOptionalEmail(input.email);
  }
}

export const createAuthStrategyHandlers = () => {
  const handlers: AuthStrategyHandler[] = [
    new UsernamePasswordStrategy(),
    new EmailCodeStrategy(),
    new PhoneCodeStrategy(),
  ];

  return new Map(handlers.map((handler) => [handler.code, handler]));
};
