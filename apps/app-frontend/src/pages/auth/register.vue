<script lang="ts" setup>
import { reactive } from 'vue'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '注册',
  },
})

const tokenStore = useTokenStore()
const form = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
})

async function submit() {
  try {
    await tokenStore.register(form)
    uni.switchTab({ url: '/pages/index/index' })
  }
  catch (error: any) {
    uni.showToast({
      title: error?.message || '注册失败',
      icon: 'none',
    })
  }
}
</script>

<template>
  <view class="min-h-screen bg-[linear-gradient(180deg,#eef2ea,#f6efe3)] px-6 pt-safe">
    <view class="mx-auto mt-8 max-w-150 rounded-8 bg-white/78 p-6 shadow-[0_18px_60px_rgba(17,33,45,0.08)]">
      <view class="text-3 text-[#5f7380] uppercase tracking-[0.28em]">
        Register member
      </view>
      <view class="mt-3 text-9 text-[#17384a] leading-tight font-600">
        创建移动端账号
      </view>

      <view class="mt-8 flex flex-col gap-4">
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            用户名
          </view>
          <input v-model="form.username" class="text-4 text-[#17384a]" />
        </view>
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            昵称
          </view>
          <input v-model="form.nickname" class="text-4 text-[#17384a]" />
        </view>
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            邮箱
          </view>
          <input v-model="form.email" class="text-4 text-[#17384a]" />
        </view>
        <view class="rounded-6 bg-[#17384a]/5 px-4 py-3">
          <view class="mb-2 text-3 text-[#607581]">
            密码
          </view>
          <input v-model="form.password" class="text-4 text-[#17384a]" password />
        </view>
      </view>

      <button class="mt-6 rounded-full bg-[#17384a] text-[#f7efe3]" @click="submit">
        注册并进入系统
      </button>
    </view>
  </view>
</template>
