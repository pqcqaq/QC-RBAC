import {
  AuthClientType,
  type AppAuthClientConfig,
  type AuthClientCode,
  type AuthClientIdentity,
  type AuthClientPublicConfig,
  type AuthClientSummary,
  type WechatMiniappAuthClientConfig,
  type WebAuthClientConfig,
} from '@rbac/api-common';
import { z } from 'zod';
import { env } from './env.js';

export type WechatMiniappPrivateConfig = WechatMiniappAuthClientConfig & {
  appSecret: string;
};

export type BackendAuthClientConfigByType = {
  [AuthClientType.WEB]: WebAuthClientConfig;
  [AuthClientType.UNI_WECHAT_MINIAPP]: WechatMiniappPrivateConfig;
  [AuthClientType.APP]: AppAuthClientConfig;
};

export type BackendAuthClientConfig = BackendAuthClientConfigByType[AuthClientType];

export type BackendAuthClientDefinition = {
  code: AuthClientCode;
  name: string;
  description?: string | null;
  clientSecret: string;
} & (
  | {
      type: AuthClientType.WEB;
      config: BackendAuthClientConfigByType[AuthClientType.WEB];
    }
  | {
      type: AuthClientType.UNI_WECHAT_MINIAPP;
      config: BackendAuthClientConfigByType[AuthClientType.UNI_WECHAT_MINIAPP];
    }
  | {
      type: AuthClientType.APP;
      config: BackendAuthClientConfigByType[AuthClientType.APP];
    }
);

const webConfigSchema = z.object({
  protocol: z.enum(['http', 'https']),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
});

const miniappConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
});

const appConfigSchema = z.object({
  packageName: z.string().min(1),
  platform: z.string().min(1).optional(),
});

const authClientDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional().nullable(),
    type: z.literal(AuthClientType.WEB),
    clientSecret: z.string().min(16),
    config: webConfigSchema,
  }),
  z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional().nullable(),
    type: z.literal(AuthClientType.UNI_WECHAT_MINIAPP),
    clientSecret: z.string().min(16),
    config: miniappConfigSchema,
  }),
  z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional().nullable(),
    type: z.literal(AuthClientType.APP),
    clientSecret: z.string().min(16),
    config: appConfigSchema,
  }),
]);

const authClientRegistrySchema = z.array(authClientDefinitionSchema).superRefine((items, ctx) => {
  const seenCodes = new Set<string>();

  items.forEach((item, index) => {
    if (seenCodes.has(item.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate auth client code: ${item.code}`,
        path: [index, 'code'],
      });
      return;
    }

    seenCodes.add(item.code);
  });
});

const parseAuthClientRegistry = () => {
  const raw = JSON.parse(env.AUTH_CLIENTS) as unknown;
  return authClientRegistrySchema.parse(raw) as BackendAuthClientDefinition[];
};

export const authClientRegistry = parseAuthClientRegistry();

const authClientRegistryMap = new Map(authClientRegistry.map((item) => [item.code, item]));

export const listAuthClientDefinitions = () => authClientRegistry;

export const getAuthClientDefinition = (code: string) => authClientRegistryMap.get(code);

export const getAuthClientDefinitionByIdentity = (
  identity: Pick<AuthClientIdentity, 'code' | 'type'>,
) => {
  const client = authClientRegistryMap.get(identity.code);
  if (!client || client.type !== identity.type) {
    return null;
  }

  return client;
};

export const toPublicAuthClientConfig = (
  client:
    | {
        type: AuthClientType.WEB;
        config: BackendAuthClientConfigByType[AuthClientType.WEB];
      }
    | {
        type: AuthClientType.UNI_WECHAT_MINIAPP;
        config: BackendAuthClientConfigByType[AuthClientType.UNI_WECHAT_MINIAPP];
      }
    | {
        type: AuthClientType.APP;
        config: BackendAuthClientConfigByType[AuthClientType.APP];
      },
): AuthClientPublicConfig => {
  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return {
      appId: client.config.appId,
    };
  }

  if (client.type === AuthClientType.APP) {
    return {
      packageName: client.config.packageName,
      ...(client.config.platform ? { platform: client.config.platform } : {}),
    };
  }

  return {
    protocol: client.config.protocol,
    host: client.config.host,
    ...(client.config.port === undefined ? {} : { port: client.config.port }),
  };
};

export const buildAuthClientSummary = (
  client: Pick<AuthClientSummary, 'id' | 'code' | 'name' | 'type'> & {
    description?: string | null;
    config: BackendAuthClientConfig;
  },
): AuthClientSummary => {
  const config = client.type === AuthClientType.WEB
    ? toPublicAuthClientConfig({
        type: client.type,
        config: client.config as BackendAuthClientConfigByType[AuthClientType.WEB],
      })
    : client.type === AuthClientType.UNI_WECHAT_MINIAPP
      ? toPublicAuthClientConfig({
          type: client.type,
          config: client.config as BackendAuthClientConfigByType[AuthClientType.UNI_WECHAT_MINIAPP],
        })
      : toPublicAuthClientConfig({
          type: client.type,
          config: client.config as BackendAuthClientConfigByType[AuthClientType.APP],
        });

  return {
    id: client.id,
    code: client.code,
    name: client.name,
    type: client.type,
    ...(client.description === undefined ? {} : { description: client.description }),
    config,
  };
};
