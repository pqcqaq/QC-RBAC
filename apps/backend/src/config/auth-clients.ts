import {
  AuthClientType,
  type AppAuthClientConfig,
  type AuthClientPublicConfig,
  type AuthClientSummary,
  type ManagedWechatMiniappAuthClientConfig,
  type WebAuthClientConfig,
} from '@rbac/api-common';
import { z } from 'zod';
import { clientOrigins } from './env.js';

export type BackendAuthClientConfigByType = {
  [AuthClientType.WEB]: WebAuthClientConfig;
  [AuthClientType.UNI_WECHAT_MINIAPP]: ManagedWechatMiniappAuthClientConfig;
  [AuthClientType.APP]: AppAuthClientConfig;
};

export type BackendAuthClientConfig = BackendAuthClientConfigByType[AuthClientType];

export type BackendAuthClientSeedDefinition = {
  code: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
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

export const webAuthClientConfigSchema = z.object({
  protocol: z.enum(['http', 'https']),
  host: z.string().min(1).max(128),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
});

export const miniappAuthClientConfigSchema = z.object({
  appId: z.string().min(1).max(64),
  appSecret: z.string().min(1).max(128),
});

export const appAuthClientConfigSchema = z.object({
  packageName: z.string().min(1).max(128),
  platform: z.string().min(1).max(32).optional(),
});

export const authClientConfigSchemaByType = {
  [AuthClientType.WEB]: webAuthClientConfigSchema,
  [AuthClientType.UNI_WECHAT_MINIAPP]: miniappAuthClientConfigSchema,
  [AuthClientType.APP]: appAuthClientConfigSchema,
} as const;

const authClientFormBaseSchema = z.object({
  code: z.string().min(3).max(64),
  name: z.string().min(2).max(48),
  description: z.string().max(120).nullable().optional(),
  enabled: z.boolean(),
  clientSecret: z.string().min(16).max(128).optional(),
});

export const authClientPayloadSchema = z.discriminatedUnion('type', [
  authClientFormBaseSchema.extend({
    type: z.literal(AuthClientType.WEB),
    config: webAuthClientConfigSchema,
  }),
  authClientFormBaseSchema.extend({
    type: z.literal(AuthClientType.UNI_WECHAT_MINIAPP),
    config: miniappAuthClientConfigSchema,
  }),
  authClientFormBaseSchema.extend({
    type: z.literal(AuthClientType.APP),
    config: appAuthClientConfigSchema,
  }),
]);

const parseDefaultWebClientConfig = (): WebAuthClientConfig => {
  for (const origin of clientOrigins) {
    try {
      const parsed = new URL(origin);
      return {
        protocol: parsed.protocol.replace(/:$/, '') === 'https' ? 'https' : 'http',
        host: parsed.hostname,
        ...(parsed.port ? { port: Number(parsed.port) } : {}),
      };
    } catch {
      continue;
    }
  }

  return {
    protocol: 'http',
    host: 'localhost',
    port: 5173,
  };
};

export const defaultAuthClientSeeds: BackendAuthClientSeedDefinition[] = [
  {
    code: 'web-console',
    name: 'Web 管理后台',
    type: AuthClientType.WEB,
    description: '浏览器端控制台客户端',
    clientSecret: 'rbac-web-client-secret',
    config: parseDefaultWebClientConfig(),
  },
  {
    code: 'uni-wechat-miniapp',
    name: 'Uni 微信小程序',
    type: AuthClientType.UNI_WECHAT_MINIAPP,
    description: '基于 uni-app 的微信小程序客户端',
    clientSecret: 'rbac-uni-miniapp-secret',
    config: {
      appId: 'wx-demo-miniapp-appid',
      appSecret: 'wx-demo-miniapp-secret',
    },
  },
  {
    code: 'native-app',
    name: '移动 App',
    type: AuthClientType.APP,
    description: '原生 App 客户端',
    clientSecret: 'rbac-native-app-secret',
    config: {
      packageName: 'com.example.rbac',
      platform: 'android',
    },
  },
];

export const parseAuthClientConfig = (type: AuthClientType, config: unknown): BackendAuthClientConfig => {
  if (type === AuthClientType.WEB) {
    return authClientConfigSchemaByType[AuthClientType.WEB].parse(config);
  }

  if (type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return authClientConfigSchemaByType[AuthClientType.UNI_WECHAT_MINIAPP].parse(config);
  }

  return authClientConfigSchemaByType[AuthClientType.APP].parse(config);
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
  const publicConfig = client.type === AuthClientType.WEB
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
    config: publicConfig,
  };
};
