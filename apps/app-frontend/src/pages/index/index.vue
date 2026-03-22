<script lang="ts" setup>
import type { DashboardSummary } from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import { getDashboardSummary } from '@/api/login'
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const loading = ref(false)
const summary = reactive<DashboardSummary>({
  metrics: [],
  roleDistribution: [],
  moduleCoverage: [],
  latestUsers: [],
  auditFeed: [],
})

const displayName = computed(() => {
  return userStore.userInfo.nickname || userStore.userInfo.username || '欢迎'
})

const latestUsers = computed(() => summary.latestUsers.slice(0, 5))
const latestAuditFeed = computed(() => summary.auditFeed.slice(0, 6))

function formatTime(value: string) {
  return dayjs(value).format('MM-DD HH:mm')
}

async function loadSummary(showError = false) {
  if (loading.value) {
    return
  }

  loading.value = true
  try {
    await tokenStore.bootstrap()
    Object.assign(summary, await getDashboardSummary())
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

onLoad(() => {
  void loadSummary(false)
})

onPullDownRefresh(() => {
  void loadSummary(true)
})
</script>

<template>
  <view class="native-page">
    <view class="page-header">
      <view class="page-title">
        工作台
      </view>
      <view class="page-subtitle">
        {{ displayName }}，查看账号概览、最近动态和常用入口。
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        快捷入口
      </view>
      <view class="row-list">
        <view class="row-item" @click="openProfile">
          <view class="row-main">
            <view class="row-title">
              个人信息
            </view>
            <view class="row-desc">
              查看账号资料、角色和权限。
            </view>
          </view>
          <view class="row-arrow">
            >
          </view>
        </view>
        <view class="row-item" @click="openSettings">
          <view class="row-main">
            <view class="row-title">
              应用设置
            </view>
            <view class="row-desc">
              查看已同步的个人配置。
            </view>
          </view>
          <view class="row-arrow">
            >
          </view>
        </view>
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        概览
      </view>
      <view class="row-list" v-if="summary.metrics.length">
        <view v-for="metric in summary.metrics" :key="metric.label" class="row-item">
          <view class="row-main">
            <view class="row-title">
              {{ metric.label }}
            </view>
            <view class="row-desc">
              {{ metric.trend }}
            </view>
          </view>
          <view class="row-value row-value--strong">
            {{ metric.value }}
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        {{ loading ? '正在加载概览数据...' : '暂无概览数据' }}
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        角色分布
      </view>
      <view class="row-list" v-if="summary.roleDistribution.length">
        <view v-for="item in summary.roleDistribution" :key="item.roleName" class="row-item">
          <view class="row-title">
            {{ item.roleName }}
          </view>
          <view class="row-value">
            {{ item.count }} 人
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        暂无角色分布数据
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        模块覆盖
      </view>
      <view class="row-list" v-if="summary.moduleCoverage.length">
        <view v-for="item in summary.moduleCoverage" :key="item.module" class="row-item">
          <view class="row-title">
            {{ item.module }}
          </view>
          <view class="row-value">
            {{ item.count }} 项
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        暂无模块覆盖数据
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        最近成员
      </view>
      <view class="row-list" v-if="latestUsers.length">
        <view v-for="item in latestUsers" :key="item.id" class="row-item">
          <view class="row-main">
            <view class="row-title">
              {{ item.nickname || item.username }}
            </view>
            <view class="row-desc">
              {{ item.email || '未设置邮箱' }}
            </view>
          </view>
          <view class="row-value">
            {{ formatTime(item.createdAt) }}
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        暂无成员数据
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        最近动态
      </view>
      <view class="row-list" v-if="latestAuditFeed.length">
        <view v-for="item in latestAuditFeed" :key="item.id" class="row-item">
          <view class="row-main">
            <view class="row-title">
              {{ item.action }}
            </view>
            <view class="row-desc">
              {{ item.actor }} · {{ item.target }}
            </view>
          </view>
          <view class="row-value">
            {{ formatTime(item.createdAt) }}
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        暂无动态
      </view>
    </view>
  </view>
</template>
