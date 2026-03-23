import type { CurrentUser } from '@rbac/api-common'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo } from '@/api/login'

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
      userInfo.value = {
        ...val,
      }
    }

    const clearUserInfo = () => {
      userInfo.value = { ...userInfoState }
      uni.removeStorageSync('user')
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
    }
  },
  {
    persist: true,
  },
)
