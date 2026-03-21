import type {
  AuthStrategyCollection,
  AuthStrategyDescriptor,
  LoginPayload,
  RegisterPayload,
  SendVerificationCodePayload,
  VerificationCodeSendResult,
  VerificationCodeVerifyResult,
  VerifyVerificationCodePayload,
} from '@rbac/api-common';
import type { AuthStrategy, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../utils/errors.js';
import {
  createAuthStrategyHandlers,
  normalizeIdentifier,
  type AuthStrategyHandler,
  type StrategyLoginInput,
  type StrategyRegisterInput,
  type StrategySyncProfileInput,
} from './auth-strategies.js';

type AuthenticatedIdentity = {
  user: User;
  strategy: AuthStrategy;
  identifier: string;
};

type NormalizedLoginPayload = {
  strategyCode: string;
  identifier: string;
  password?: string;
  code?: string;
};

type NormalizedRegisterPayload = {
  strategyCode: string;
  identifier: string;
  username: string;
  nickname: string;
  password?: string;
  code?: string;
  email?: string | null;
};

const strategyHandlers = createAuthStrategyHandlers();

const toStrategyDescriptor = (strategy: AuthStrategy): AuthStrategyDescriptor => ({
  id: strategy.id,
  code: strategy.code,
  name: strategy.name,
  description: strategy.description,
  identifierType: strategy.identifierType,
  credentialType: strategy.credentialType,
  enabled: strategy.enabled,
  loginEnabled: strategy.loginEnabled,
  registerEnabled: strategy.registerEnabled,
  verificationEnabled: strategy.verificationEnabled,
  mockEnabled: strategy.mockEnabled,
  sortOrder: strategy.sortOrder,
});

const normalizeLoginPayload = (payload: LoginPayload): NormalizedLoginPayload => {
  if ('strategyCode' in payload) {
    return {
      strategyCode: payload.strategyCode,
      identifier: payload.identifier,
      password: payload.password,
      code: payload.code,
    };
  }

  return {
    strategyCode: 'username-password',
    identifier: payload.account,
    password: payload.password,
  };
};

const normalizeRegisterPayload = (payload: RegisterPayload): NormalizedRegisterPayload => {
  if ('strategyCode' in payload) {
    return {
      strategyCode: payload.strategyCode,
      identifier: payload.identifier,
      username: payload.username,
      nickname: payload.nickname,
      password: payload.password,
      code: payload.code,
      email: payload.email ?? null,
    };
  }

  return {
    strategyCode: 'username-password',
    identifier: payload.username,
    username: payload.username,
    nickname: payload.nickname,
    password: payload.password,
    email: payload.email,
  };
};

class AuthService {
  private assertPurposeEnabled(
    strategy: AuthStrategy,
    purpose: 'LOGIN' | 'REGISTER',
  ) {
    if (purpose === 'LOGIN' && !strategy.loginEnabled) {
      throw badRequest('Login is not enabled for this strategy');
    }

    if (purpose === 'REGISTER' && !strategy.registerEnabled) {
      throw badRequest('Register is not enabled for this strategy');
    }
  }

  private getHandler(strategyCode: string): AuthStrategyHandler {
    const handler = strategyHandlers.get(strategyCode);
    if (!handler) {
      throw badRequest(`Unsupported auth strategy: ${strategyCode}`);
    }
    return handler;
  }

  private async getStrategyByCode(code: string, enabledOnly = true) {
    const strategy = await prisma.authStrategy.findUnique({
      where: { code },
    });

    if (!strategy || (enabledOnly && !strategy.enabled)) {
      throw badRequest(`Auth strategy not available: ${code}`);
    }

    return strategy;
  }

  private normalizeStrategyIdentifier(strategy: AuthStrategy, identifier: string) {
    return normalizeIdentifier(strategy.identifierType, identifier);
  }

  async listStrategies(): Promise<AuthStrategyCollection> {
    const strategies = await prisma.authStrategy.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const descriptors = strategies.map(toStrategyDescriptor);
    return {
      strategies: descriptors,
      loginStrategies: descriptors.filter((item) => item.loginEnabled),
      registerStrategies: descriptors.filter((item) => item.registerEnabled),
      verificationStrategies: descriptors.filter((item) => item.verificationEnabled),
    };
  }

  async sendVerificationCode(payload: SendVerificationCodePayload): Promise<VerificationCodeSendResult> {
    const strategy = await this.getStrategyByCode(payload.strategyCode);
    if (!strategy.verificationEnabled) {
      throw badRequest('Verification is not enabled for this strategy');
    }
    this.assertPurposeEnabled(strategy, payload.purpose);

    const handler = this.getHandler(strategy.code);
    if (!handler.sendVerificationCode) {
      throw badRequest('Verification is not supported for this strategy');
    }

    const result = await handler.sendVerificationCode({
      strategy,
      identifier: this.normalizeStrategyIdentifier(strategy, payload.identifier),
      purpose: payload.purpose,
    });

    return {
      expiresAt: result.expiresAt.toISOString(),
      ...(result.mockCode ? { mockCode: result.mockCode } : {}),
    };
  }

  async verifyVerificationCode(payload: VerifyVerificationCodePayload): Promise<VerificationCodeVerifyResult> {
    const strategy = await this.getStrategyByCode(payload.strategyCode);
    if (!strategy.verificationEnabled) {
      throw badRequest('Verification is not enabled for this strategy');
    }
    this.assertPurposeEnabled(strategy, payload.purpose);

    const handler = this.getHandler(strategy.code);
    if (!handler.verifyCode) {
      throw badRequest('Verification is not supported for this strategy');
    }

    const result = await handler.verifyCode({
      strategy,
      identifier: this.normalizeStrategyIdentifier(strategy, payload.identifier),
      purpose: payload.purpose,
      code: payload.code.trim(),
      consume: false,
    });

    return {
      valid: result.valid,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  async login(payload: LoginPayload): Promise<AuthenticatedIdentity> {
    const normalized = normalizeLoginPayload(payload);
    const strategy = await this.getStrategyByCode(normalized.strategyCode);
    if (!strategy.loginEnabled) {
      throw badRequest('Login is not enabled for this strategy');
    }

    const handler = this.getHandler(strategy.code);
    const input: StrategyLoginInput = {
      strategy,
      identifier: this.normalizeStrategyIdentifier(strategy, normalized.identifier),
      password: normalized.password?.trim(),
      code: normalized.code?.trim(),
    };
    const user = await handler.login(input);

    return {
      user,
      strategy,
      identifier: input.identifier,
    };
  }

  async register(payload: RegisterPayload): Promise<AuthenticatedIdentity> {
    const normalized = normalizeRegisterPayload(payload);
    const strategy = await this.getStrategyByCode(normalized.strategyCode);
    if (!strategy.registerEnabled) {
      throw badRequest('Register is not enabled for this strategy');
    }

    const handler = this.getHandler(strategy.code);
    const input: StrategyRegisterInput = {
      strategy,
      identifier: this.normalizeStrategyIdentifier(strategy, normalized.identifier),
      username: normalized.username,
      nickname: normalized.nickname,
      password: normalized.password?.trim(),
      code: normalized.code?.trim(),
      email: normalized.email ?? null,
    };
    const user = await handler.register(input);

    return {
      user,
      strategy,
      identifier: input.identifier,
    };
  }

  async syncManagedUserAuthentications(input: {
    userId: string;
    username: string;
    email?: string | null;
    password?: string;
  }) {
    const strategies = await prisma.authStrategy.findMany({
      where: {
        code: {
          in: ['username-password', 'email-code'],
        },
      },
    });

    for (const strategy of strategies) {
      const handler = this.getHandler(strategy.code);
      if (!handler.syncUserProfile) {
        continue;
      }

      const payload: StrategySyncProfileInput = {
        strategy,
        userId: input.userId,
        username: input.username,
        email: input.email ?? null,
        password: input.password?.trim(),
      };
      await handler.syncUserProfile(payload);
    }
  }
}

export const authService = new AuthService();
