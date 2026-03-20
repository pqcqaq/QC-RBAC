<script lang="ts" setup>
import { reactive } from 'vue'
import { REGISTER_PAGE } from '@/router/config'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '登录',
  },
})

const tokenStore = useTokenStore()
const form = reactive({
  account: 'admin@example.com',
  password: 'Admin123!',
})

async function doLogin() {
  if (tokenStore.hasLogin) {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  try {
    await tokenStore.login({
      account: form.account,
      password: form.password,
    })
    uni.switchTab({ url: '/pages/index/index' })
  }
  catch (error: any) {
    uni.showToast({
      title: error?.message || '登录失败',
      icon: 'none',
    })
  }
}

function toRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}
</script>

<template>
  <view class="min-h-screen bg-[linear-gradient(160deg,#f7efe3_0%,#e7efe9_52%,#dce7f2_100%)] px-6 pt-safe">
    <view class="mx-auto mt-10 max-w-150 rounded-8 bg-white/75 p-6 shadow-[0_20px_60px_rgba(17,33,45,0.08)] backdrop-blur-12">
      <view class="text-3 text-[#5f7380] uppercase tracking-[0.28em]">
        RBAC mobile access
      </view>
      <view class="mt-3 text-10 text-[#17384a] leading-tight font-600">
        登录控制台
      </view>
      <view class="mt-3 text-3.6 text-[#4e6572] leading-7">
        直接连接 monorepo backend，复用共享 API 封装和双 token 会话。
      </view>

      <view class="mt-8 flex flex-col gap-4">
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            账号
          </view>
          <input v-model="form.account" class="text-4 text-[#17384a]" placeholder="邮箱或用户名" />
        </view>
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            密码
          </view>
          <input v-model="form.password" class="text-4 text-[#17384a]" password placeholder="请输入密码" />
        </view>
      </view>

      <button class="mt-6 rounded-full bg-[#17384a] text-[#f7efe3]" @click="doLogin">
        进入系统
      </button>
      <button class="mt-3 rounded-full border-0 bg-[#17384a]/8 text-[#17384a]" @click="toRegister">
        创建成员账号
      </button>

      <view class="mt-6 text-3 text-[#607581]">
        默认账号：admin@example.com / Admin123!
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
</style>
