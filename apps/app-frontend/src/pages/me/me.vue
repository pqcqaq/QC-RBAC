<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { LOGIN_PAGE } from '@/router/config'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '我的权限',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

async function handleLogin() {
  uni.navigateTo({
    url: LOGIN_PAGE,
  })
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        void useTokenStore().logout()
        uni.showToast({
          title: '退出登录成功',
          icon: 'success',
        })
      }
    },
  })
}
</script>

<template>
  <view class="min-h-screen bg-[linear-gradient(180deg,#eef2ea,#f6efe3)] px-4 pt-safe">
    <view class="mx-auto mt-6 max-w-180 rounded-8 bg-white/80 p-6 shadow-[0_18px_60px_rgba(17,33,45,0.08)]">
      <view class="text-3 uppercase tracking-[0.28em] text-[#607581]">
        Permission profile
      </view>
      <view class="mt-3 text-8 text-[#17384a] font-600">
        {{ userInfo.nickname || '未登录' }}
      </view>
      <view class="mt-2 text-3.6 text-[#4e6572]">
        {{ userInfo.email || '未设置邮箱' }}
      </view>
    </view>

    <view class="mt-4 rounded-7 bg-white/78 p-5 shadow-[0_14px_40px_rgba(17,33,45,0.08)]">
      <view class="text-3 uppercase tracking-[0.22em] text-[#607581]">
        角色
      </view>
      <view class="mt-3 flex flex-wrap gap-2">
        <view
          v-for="role in userInfo.roles"
          :key="role.id"
          class="rounded-full bg-[#17384a]/8 px-3 py-1 text-3 text-[#17384a]"
        >
          {{ role.name }}
        </view>
      </view>
    </view>

    <view class="mt-4 rounded-7 bg-white/78 p-5 shadow-[0_14px_40px_rgba(17,33,45,0.08)]">
      <view class="text-3 uppercase tracking-[0.22em] text-[#607581]">
        有效权限
      </view>
      <view class="mt-3 flex flex-wrap gap-2">
        <view
          v-for="permission in userInfo.permissions"
          :key="permission"
          class="rounded-full bg-[#17384a]/6 px-3 py-1 text-3 text-[#4e6572]"
        >
          {{ permission }}
        </view>
      </view>
    </view>

    <view class="mt-4 px-3">
      <view class="m-auto max-w-160px text-center">
        <button v-if="tokenStore.hasLogin" type="warn" class="w-full" @click="handleLogout">
          退出登录
        </button>
        <button v-else type="primary" class="w-full" @click="handleLogin">
          登录
        </button>
      </view>
    </view>
  </view>
</template>
