<script lang="ts" setup>
import type { DashboardSummary } from '@rbac/api-common'
import { reactive } from 'vue'
import { getDashboardSummary } from '@/api/login'
import { useTokenStore, useUserStore } from '@/store'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '总览',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const summary = reactive<DashboardSummary>({
  metrics: [],
  roleDistribution: [],
  moduleCoverage: [],
  latestUsers: [],
  auditFeed: [],
})

onLoad(async () => {
  await tokenStore.bootstrap()
  Object.assign(summary, await getDashboardSummary())
})
</script>

<template>
  <view class="min-h-screen bg-[linear-gradient(180deg,#eff2ea,#f7efe3)] px-4 pt-safe">
    <view class="mx-auto mt-6 max-w-180 rounded-8 bg-[linear-gradient(135deg,rgba(19,47,63,0.92),rgba(43,74,82,0.9))] p-6 text-[#f6ede0] shadow-[0_24px_80px_rgba(17,33,45,0.14)]">
      <view class="text-3 uppercase tracking-[0.3em] text-[#d7d9cf]">
        RBAC mobile deck
      </view>
      <view class="mt-3 text-8 font-600 leading-tight">
        {{ userStore.userInfo.nickname || '控制台' }}
      </view>
      <view class="mt-3 text-3.8 leading-7 text-[#d7d9cf]">
        在移动端快速查看用户体量、角色分布和最近审计动作。
      </view>
      <view class="mt-5 flex flex-wrap gap-2">
        <view
          v-for="role in userStore.userInfo.roles"
          :key="role.id"
          class="rounded-full bg-white/12 px-3 py-1 text-3"
        >
          {{ role.name }}
        </view>
      </view>
    </view>

    <view class="mt-5 grid gap-3">
      <view
        v-for="metric in summary.metrics"
        :key="metric.label"
        class="rounded-7 bg-white/78 p-5 shadow-[0_14px_40px_rgba(17,33,45,0.08)]"
      >
        <view class="text-3 uppercase tracking-[0.22em] text-[#607581]">
          {{ metric.label }}
        </view>
        <view class="mt-3 text-8 text-[#17384a] font-600">
          {{ metric.value }}
        </view>
        <view class="mt-2 text-3.4 text-[#4e6572]">
          {{ metric.trend }}
        </view>
      </view>
    </view>

    <view class="mt-5 rounded-7 bg-white/78 p-5 shadow-[0_14px_40px_rgba(17,33,45,0.08)]">
      <view class="text-3 uppercase tracking-[0.22em] text-[#607581]">
        最近审计动作
      </view>
      <view
        v-for="item in summary.auditFeed.slice(0, 5)"
        :key="item.id"
        class="border-b border-[#17384a]/8 py-3 last:border-none"
      >
        <view class="text-4 text-[#17384a]">
          {{ item.action }}
        </view>
        <view class="mt-1 text-3 text-[#607581]">
          {{ item.actor }} -> {{ item.target }}
        </view>
      </view>
    </view>
  </view>
</template>
