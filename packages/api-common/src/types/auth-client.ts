export type AuthClientCode = 'web-console' | 'uni-wechat-miniapp' | string;

export enum AuthClientType {
  WEB = 'WEB',
  UNI_WECHAT_MINIAPP = 'UNI_WECHAT_MINIAPP',
  APP = 'APP',
}

export const AUTH_CLIENT_CODE_HEADER = 'X-RBAC-Client-Code';
export const AUTH_CLIENT_SECRET_HEADER = 'X-RBAC-Client-Secret';
export const AUTH_CLIENT_APP_ID_HEADER = 'X-RBAC-Client-App-Id';
export const AUTH_CLIENT_PACKAGE_NAME_HEADER = 'X-RBAC-Client-Package-Name';
export const AUTH_CLIENT_PLATFORM_HEADER = 'X-RBAC-Client-Platform';

export interface WebAuthClientConfig {
  protocol: 'http' | 'https';
  host: string;
  port?: number | null;
}

export interface WechatMiniappAuthClientConfig {
  appId: string;
}

export interface ManagedWechatMiniappAuthClientConfig extends WechatMiniappAuthClientConfig {
  appSecret: string;
}

export interface AppAuthClientConfig {
  packageName: string;
  platform?: string;
}

export type AuthClientConfigByType = {
  [AuthClientType.WEB]: WebAuthClientConfig;
  [AuthClientType.UNI_WECHAT_MINIAPP]: ManagedWechatMiniappAuthClientConfig;
  [AuthClientType.APP]: AppAuthClientConfig;
};

export type AuthClientConfig = AuthClientConfigByType[AuthClientType];

export type AuthClientPublicConfigByType = {
  [AuthClientType.WEB]: WebAuthClientConfig;
  [AuthClientType.UNI_WECHAT_MINIAPP]: WechatMiniappAuthClientConfig;
  [AuthClientType.APP]: AppAuthClientConfig;
};

export type AuthClientPublicConfig = AuthClientPublicConfigByType[AuthClientType];

export interface AuthClientIdentity {
  id: string;
  code: AuthClientCode;
  type: AuthClientType;
}

export interface AuthClientSummary extends AuthClientIdentity {
  name: string;
  description?: string | null;
  config: AuthClientPublicConfig;
}

export type AuthClientRequestDescriptor =
  | {
      code: AuthClientCode;
      secret: string;
      type: AuthClientType.WEB;
      config?: Partial<WebAuthClientConfig>;
    }
  | {
      code: AuthClientCode;
      secret: string;
      type: AuthClientType.UNI_WECHAT_MINIAPP;
      config: WechatMiniappAuthClientConfig;
    }
  | {
      code: AuthClientCode;
      secret: string;
      type: AuthClientType.APP;
      config: AppAuthClientConfig;
    };

export const buildAuthClientHeaders = (client: AuthClientRequestDescriptor): Record<string, string> => {
  const headers: Record<string, string> = {
    [AUTH_CLIENT_CODE_HEADER]: client.code,
    [AUTH_CLIENT_SECRET_HEADER]: client.secret,
  };

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    headers[AUTH_CLIENT_APP_ID_HEADER] = client.config.appId;
  }

  if (client.type === AuthClientType.APP) {
    headers[AUTH_CLIENT_PACKAGE_NAME_HEADER] = client.config.packageName;

    if (client.config.platform) {
      headers[AUTH_CLIENT_PLATFORM_HEADER] = client.config.platform;
    }
  }

  return headers;
};

export const isSameAuthClientIdentity = (
  left: Pick<AuthClientIdentity, 'id' | 'code' | 'type'>,
  right: Pick<AuthClientIdentity, 'id' | 'code' | 'type'>,
) => left.id === right.id && left.code === right.code && left.type === right.type;
