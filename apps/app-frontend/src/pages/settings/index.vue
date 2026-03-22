<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { authClientCode } from '@/api/client'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '应用设置',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const workbenchPreferences = computed(() => userInfo.value.preferences?.workbench)

const accountItems = computed(() => {
  return [
    {
      label: '当前账号',
      value: userInfo.value.nickname || userInfo.value.username || '--',
    },
    {
      label: '用户名',
      value: userInfo.value.username || '--',
    },
    {
      label: '邮箱',
      value: userInfo.value.email || '未设置',
    },
    {
      label: '登录客户端',
      value: authClientCode,
    },
  ]
})

const syncItems = computed(() => {
  const preferences = workbenchPreferences.value
  const appearanceTextMap = {
    light: '浅色',
    dark: '深色',
  } as const
  const layoutTextMap = {
    sidebar: '侧边栏',
    tabs: '标签页',
  } as const
  const transitionTextMap = {
    none: '无',
    fade: '淡入',
    slide: '滑动',
  } as const
  const tabDisplayTextMap = {
    hidden: '隐藏',
    classic: '经典',
    browser: '浏览器',
  } as const

  return [
    {
      label: '主题方案',
      value: preferences?.themePresetId || '默认',
    },
    {
      label: '侧边栏风格',
      value: preferences ? appearanceTextMap[preferences.sidebarAppearance] : '默认',
    },
    {
      label: '布局模式',
      value: preferences ? layoutTextMap[preferences.layoutMode] : '默认',
    },
    {
      label: '页面过渡',
      value: preferences ? transitionTextMap[preferences.pageTransition] : '默认',
    },
    {
      label: '标签显示',
      value: preferences ? tabDisplayTextMap[preferences.cachedTabDisplayMode] : '默认',
    },
    {
      label: '侧边栏收起',
      value: preferences ? (preferences.sidebarCollapsed ? '是' : '否') : '否',
    },
    {
      label: '已同步标签数',
      value: String(preferences?.visitedTabs?.length ?? 0),
    },
    {
      label: '页面状态数',
      value: String(Object.keys(preferences?.pageStateMap || {}).length),
    },
  ]
})

onShow(() => {
  if (tokenStore.hasLogin) {
    void userStore.fetchUserInfo().catch(() => undefined)
  }
})
</script>

<template>
  <view class="native-page">
    <view class="page-header">
      <view class="page-title">
        应用设置
      </view>
      <view class="page-subtitle">
        当前页面仅展示已同步配置，暂不提供修改。
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        账户
      </view>
      <view class="row-list">
        <view v-for="item in accountItems" :key="item.label" class="row-item">
          <view class="row-title">
            {{ item.label }}
          </view>
          <view class="row-value">
            {{ item.value }}
          </view>
        </view>
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        已同步控制台配置
      </view>
      <view class="row-list">
        <view v-for="item in syncItems" :key="item.label" class="row-item">
          <view class="row-title">
            {{ item.label }}
          </view>
          <view class="row-value">
            {{ item.value }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
