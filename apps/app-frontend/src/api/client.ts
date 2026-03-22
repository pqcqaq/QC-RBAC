import type { ApiEnvelope, AuthSession } from '@rbac/api-common'
import {
  AuthClientType,
  buildAuthClientHeaders,
  createApiFactory,
  createUniAdaptor,
} from '@rbac/api-common'
import {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  persistTokens,
} from '@/utils/auth-storage'

const baseUrl = import.meta.env.VITE_SERVER_BASEURL || 'http://localhost:3300/api'

const inferDefaultClientType = () => {
  // #ifdef MP-WEIXIN
  return AuthClientType.UNI_WECHAT_MINIAPP
  // #endif
  // #ifdef APP-PLUS
  return AuthClientType.APP
  // #endif
  return AuthClientType.WEB
}

const inferredClientType = inferDefaultClientType()

const resolveAuthClientType = () => {
  if (inferredClientType === AuthClientType.WEB) {
    return AuthClientType.WEB
  }

  return (import.meta.env.VITE_AUTH_CLIENT_TYPE as AuthClientType | undefined) || inferredClientType
}

const resolveDefaultClientCredentials = (type: AuthClientType) => {
  if (type === AuthClientType.WEB) {
    return {
      code: import.meta.env.VITE_AUTH_WEB_CLIENT_CODE || 'web-uni-h5',
      secret: import.meta.env.VITE_AUTH_WEB_CLIENT_SECRET || 'rbac-web-uni-h5-secret',
    }
  }

  if (type === AuthClientType.APP) {
    return {
      code: import.meta.env.VITE_AUTH_APP_CLIENT_CODE || import.meta.env.VITE_AUTH_CLIENT_CODE || 'native-app',
      secret: import.meta.env.VITE_AUTH_APP_CLIENT_SECRET || import.meta.env.VITE_AUTH_CLIENT_SECRET || 'rbac-native-app-secret',
    }
  }

  return {
    code: import.meta.env.VITE_AUTH_MINIAPP_CLIENT_CODE || import.meta.env.VITE_AUTH_CLIENT_CODE || 'uni-wechat-miniapp',
    secret: import.meta.env.VITE_AUTH_MINIAPP_CLIENT_SECRET || import.meta.env.VITE_AUTH_CLIENT_SECRET || 'rbac-uni-miniapp-secret',
  }
}

export const authClientType = resolveAuthClientType()
const authClientCredentials = resolveDefaultClientCredentials(authClientType)
export const authClientCode = authClientCredentials.code
export const authClientSecret = authClientCredentials.secret

const resolveWebClientConfig = () => {
  const currentLocation = typeof location !== 'undefined' ? location : null
  const protocol = (import.meta.env.VITE_AUTH_WEB_PROTOCOL || currentLocation?.protocol.replace(/:$/, '') || 'http').toLowerCase()
  const host = import.meta.env.VITE_AUTH_WEB_HOST || currentLocation?.hostname || 'localhost'
  const portValue = import.meta.env.VITE_AUTH_WEB_PORT || currentLocation?.port
  const port = portValue ? Number(portValue) : undefined

  return {
    protocol: protocol === 'https' ? 'https' : 'http',
    host,
    ...(port ? { port } : {}),
  } as const
}

const resolveAppPlatform = () => {
  if (import.meta.env.VITE_APP_PLATFORM) {
    return import.meta.env.VITE_APP_PLATFORM
  }

  // #ifdef APP-PLUS
  return 'android'
  // #endif
  return undefined
}

export const getClientCredentialHeaders = () => {
  if (authClientType === AuthClientType.UNI_WECHAT_MINIAPP) {
    return buildAuthClientHeaders({
      code: authClientCode,
      secret: authClientSecret,
      type: authClientType,
      config: {
        appId: import.meta.env.VITE_AUTH_CLIENT_APP_ID || import.meta.env.VITE_WX_APPID || '',
      },
    })
  }

  if (authClientType === AuthClientType.APP) {
    return buildAuthClientHeaders({
      code: authClientCode,
      secret: authClientSecret,
      type: authClientType,
      config: {
        packageName: import.meta.env.VITE_APP_PACKAGE_NAME || '',
        ...(resolveAppPlatform() ? { platform: resolveAppPlatform() } : {}),
      },
    })
  }

  return buildAuthClientHeaders({
    code: authClientCode,
    secret: authClientSecret,
    type: AuthClientType.WEB,
    config: resolveWebClientConfig(),
  })
}

let refreshPromise: Promise<boolean> | null = null

const refreshSession = async () => {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) {
    clearAuthStorage()
    return false
  }

  if (!refreshPromise) {
    refreshPromise = new Promise<boolean>((resolve) => {
      uni.request({
        url: `${baseUrl.replace(/\/$/, '')}/auth/refresh`,
        method: 'POST',
        data: { refreshToken },
        header: {
          'Content-Type': 'application/json',
          ...getClientCredentialHeaders(),
        },
        success: ({ statusCode, data }) => {
          const payload = data as ApiEnvelope<AuthSession>
          if (statusCode >= 200 && statusCode < 300 && payload?.data?.tokens) {
            persistTokens(payload.data.tokens)
            resolve(true)
            return
          }
          clearAuthStorage()
          resolve(false)
        },
        fail: () => {
          clearAuthStorage()
          resolve(false)
        },
      })
    }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export const appApi = createApiFactory({
  baseUrl,
  adaptor: createUniAdaptor(),
  getAccessToken: getStoredAccessToken,
  getDefaultHeaders: getClientCredentialHeaders,
  onUnauthorized: async () => {
    const refreshed = await refreshSession()
    if (!refreshed) {
      clearAuthStorage()
    }
    return refreshed
  },
})
