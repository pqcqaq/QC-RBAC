import type { CurrentUser } from '@rbac/api-common'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo } from '@/api/login'
import { useUiStore } from './ui'

const userInfoState: CurrentUser = {
  id: '',
  username: '',
  nickname: '',
  email: null,
  avatarFileId: null,
  avatarUrl: null,
  avatarFile: null,
  status: 'ACTIVE',
  roles: [],
  permissions: [],
  preferences: {},
}

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<CurrentUser>({ ...userInfoState })

    const setUserInfo = (val: CurrentUser) => {
      const uiStore = useUiStore()
      userInfo.value = {
        ...val,
      }
      uiStore.hydrateFromUserPreferences(val.preferences?.app)
    }

    const clearUserInfo = () => {
      const uiStore = useUiStore()
      userInfo.value = { ...userInfoState }
      uiStore.resetPreferences()
      uni.removeStorageSync('user')
    }

    const setAppPreferences = (appPreferences: CurrentUser['preferences']['app']) => {
      userInfo.value = {
        ...userInfo.value,
        preferences: {
          ...userInfo.value.preferences,
          app: appPreferences,
        },
      }
    }

    const fetchUserInfo = async () => {
      const res = await getUserInfo()
      setUserInfo(res)
      return res
    }

    return {
      userInfo,
      clearUserInfo,
      fetchUserInfo,
      setUserInfo,
      setAppPreferences,
    }
  },
  {
    persist: true,
  },
)
