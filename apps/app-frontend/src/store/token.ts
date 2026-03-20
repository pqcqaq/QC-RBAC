import type { AuthSession } from '@rbac/api-common'
import type { ILoginForm, IRegisterForm } from '@/api/login'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getUserInfo,
  login as loginRequest,
  logout as logoutRequest,
  refreshToken as refreshTokenRequest,
  register as registerRequest,
  wxLogin as wxLoginRequest,
} from '@/api/login'
import {
  clearAuthStorage,
  getAccessExpiresAt,
  getRefreshExpiresAt,
  getStoredRefreshToken,
  persistTokens,
} from '@/utils/auth-storage'
import { useUserStore } from './user'

export const useTokenStore = defineStore(
  'token',
  () => {
    const tokenInfo = ref({
      accessToken: '',
      refreshToken: '',
      accessExpiresAt: 0,
      refreshExpiresAt: 0,
    })

    const nowTime = ref(Date.now())

    const updateNowTime = () => {
      nowTime.value = Date.now()
      return useTokenStore()
    }

    const setTokenInfo = (session: AuthSession) => {
      updateNowTime()
      const { accessExpiresAt, refreshExpiresAt } = persistTokens(session.tokens)
      tokenInfo.value = {
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
        accessExpiresAt,
        refreshExpiresAt,
      }
      useUserStore().setUserInfo(session.user)
    }

    const isTokenExpired = computed(() => {
      return !tokenInfo.value.accessToken || nowTime.value >= tokenInfo.value.accessExpiresAt
    })

    const isRefreshTokenExpired = computed(() => {
      return !tokenInfo.value.refreshToken || nowTime.value >= tokenInfo.value.refreshExpiresAt
    })

    const clearSession = () => {
      updateNowTime()
      tokenInfo.value = {
        accessToken: '',
        refreshToken: '',
        accessExpiresAt: 0,
        refreshExpiresAt: 0,
      }
      clearAuthStorage()
      useUserStore().clearUserInfo()
    }

    const bootstrap = async () => {
      if (!tokenInfo.value.accessToken) {
        tokenInfo.value = {
          accessToken: '',
          refreshToken: getStoredRefreshToken(),
          accessExpiresAt: getAccessExpiresAt(),
          refreshExpiresAt: getRefreshExpiresAt(),
        }
      }

      if (!tokenInfo.value.refreshToken && !tokenInfo.value.accessToken) {
        return
      }

      if (isTokenExpired.value && !isRefreshTokenExpired.value) {
        await refreshToken().catch(() => {
          clearSession()
        })
        return
      }

      if (!isTokenExpired.value) {
        await getUserInfo()
          .then(user => useUserStore().setUserInfo(user))
          .catch(() => undefined)
      }
    }

    const login = async (loginForm: ILoginForm) => {
      const session = await loginRequest(loginForm)
      setTokenInfo(session)
      return session
    }

    const register = async (payload: IRegisterForm) => {
      const session = await registerRequest(payload)
      setTokenInfo(session)
      return session
    }

    const logout = async () => {
      try {
        await logoutRequest(tokenInfo.value.refreshToken)
      }
      finally {
        clearSession()
      }
    }

    const refreshToken = async () => {
      if (!tokenInfo.value.refreshToken) {
        throw new Error('refresh token missing')
      }
      const session = await refreshTokenRequest(tokenInfo.value.refreshToken)
      setTokenInfo(session)
      return session
    }

    const getValidToken = computed(() => {
      if (isTokenExpired.value) {
        return ''
      }
      return tokenInfo.value.accessToken
    })

    const hasLoginInfo = computed(() => {
      return Boolean(tokenInfo.value.accessToken || tokenInfo.value.refreshToken)
    })

    const hasValidLogin = computed(() => {
      return hasLoginInfo.value && (!isTokenExpired.value || !isRefreshTokenExpired.value)
    })

    const tryGetValidToken = async (): Promise<string> => {
      updateNowTime()
      if (!getValidToken.value && !isRefreshTokenExpired.value) {
        await refreshToken()
      }
      return getValidToken.value
    }

    const wxLogin = async () => wxLoginRequest()

    return {
      bootstrap,
      clearSession,
      login,
      register,
      logout,
      refreshToken,
      tryGetValidToken,
      wxLogin,
      hasLogin: hasValidLogin,
      tokenInfo,
      validToken: getValidToken,
      setTokenInfo,
      updateNowTime,
    }
  },
  {
    persist: true,
  },
)
