import type { CurrentUser } from '@rbac/api-common'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo } from '@/api/login'

const userInfoState: CurrentUser = {
  id: '',
  username: '',
  nickname: '',
  email: null,
  avatar: '/static/images/default-avatar.png',
  status: 'ACTIVE',
  roles: [],
  permissions: [],
}

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<CurrentUser>({ ...userInfoState })

    const setUserInfo = (val: CurrentUser) => {
      userInfo.value = {
        ...val,
        avatar: val.avatar || userInfoState.avatar,
      }
    }

    const setUserAvatar = (avatar: string) => {
      userInfo.value.avatar = avatar
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
      setUserAvatar,
    }
  },
  {
    persist: true,
  },
)
