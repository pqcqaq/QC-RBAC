import type { ApiEnvelope, AuthSession } from '@rbac/api-common'
import { createApiFactory, createUniAdaptor } from '@rbac/api-common'
import {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  persistTokens,
} from '@/utils/auth-storage'

const baseUrl = import.meta.env.VITE_SERVER_BASEURL || 'http://localhost:3300/api'
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
  onUnauthorized: async () => {
    const refreshed = await refreshSession()
    if (!refreshed) {
      clearAuthStorage()
    }
    return refreshed
  },
})
