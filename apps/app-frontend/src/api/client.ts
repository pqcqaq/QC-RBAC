import type { ApiEnvelope, AuthSession } from '@rbac/api-common'
import {
  AUTH_CLIENT_CODE_HEADER,
  AUTH_CLIENT_SECRET_HEADER,
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
export const authClientCode = import.meta.env.VITE_AUTH_CLIENT_CODE || 'uni-wechat-miniapp'
export const authClientSecret = import.meta.env.VITE_AUTH_CLIENT_SECRET || 'rbac-uni-miniapp-secret'
export const getClientCredentialHeaders = () => ({
  [AUTH_CLIENT_CODE_HEADER]: authClientCode,
  [AUTH_CLIENT_SECRET_HEADER]: authClientSecret,
})
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
