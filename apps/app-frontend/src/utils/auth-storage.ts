const ACCESS_TOKEN_KEY = 'rbac_app_access_token'
const REFRESH_TOKEN_KEY = 'rbac_app_refresh_token'
const ACCESS_EXPIRES_AT_KEY = 'rbac_app_access_expires_at'
const REFRESH_EXPIRES_AT_KEY = 'rbac_app_refresh_expires_at'

const decodeJwtExp = (token: string) => {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized))
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : 0
  }
  catch {
    return 0
  }
}

export const getStoredAccessToken = () => uni.getStorageSync(ACCESS_TOKEN_KEY) || ''
export const getStoredRefreshToken = () => uni.getStorageSync(REFRESH_TOKEN_KEY) || ''
export const getAccessExpiresAt = () => Number(uni.getStorageSync(ACCESS_EXPIRES_AT_KEY) || 0)
export const getRefreshExpiresAt = () => Number(uni.getStorageSync(REFRESH_EXPIRES_AT_KEY) || 0)

export const persistTokens = (tokens: { accessToken: string, refreshToken: string }) => {
  const accessExpiresAt = decodeJwtExp(tokens.accessToken)
  const refreshExpiresAt = decodeJwtExp(tokens.refreshToken)

  uni.setStorageSync(ACCESS_TOKEN_KEY, tokens.accessToken)
  uni.setStorageSync(REFRESH_TOKEN_KEY, tokens.refreshToken)
  uni.setStorageSync(ACCESS_EXPIRES_AT_KEY, accessExpiresAt)
  uni.setStorageSync(REFRESH_EXPIRES_AT_KEY, refreshExpiresAt)

  return {
    accessExpiresAt,
    refreshExpiresAt,
  }
}

export const clearAuthStorage = () => {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
  uni.removeStorageSync(ACCESS_EXPIRES_AT_KEY)
  uni.removeStorageSync(REFRESH_EXPIRES_AT_KEY)
}
