<script lang="ts" setup>
import type { DashboardSummary } from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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

const headerDescription = computed(() => {
  const name = userStore.userInfo.nickname || userStore.userInfo.username || '欢迎使用'
  return `${name}，查看账号概览、最近动态和常用入口。`
})

const latestUsers = computed(() => summary.latestUsers.slice(0, 5))
const latestAuditFeed = computed(() => summary.auditFeed.slice(0, 6))
const roleTags = computed(() => userStore.userInfo.roles)

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
  <AppPageShell title="工作台" :description="headerDescription">
    <template #extra>
      <view v-if="roleTags.length" class="app-tag-row app-tag-row--compact">
        <wd-tag v-for="role in roleTags" :key="role.id" plain round type="primary" custom-class="app-tag">
          {{ role.name }}
        </wd-tag>
      </view>
    </template>

    <AppSection title="快捷入口" description="常用功能入口。">
      <wd-cell-group custom-class="app-list-group">
        <wd-cell title="个人信息" label="查看账号资料、角色和权限。" is-link clickable @click="openProfile" />
        <wd-cell title="应用设置" label="查看已同步的个人配置。" is-link clickable @click="openSettings" />
      </wd-cell-group>
    </AppSection>

    <AppSection title="概览" description="核心指标摘要。">
      <wd-cell-group v-if="summary.metrics.length" custom-class="app-list-group">
        <wd-cell
          v-for="metric in summary.metrics"
          :key="metric.label"
          :title="metric.label"
          :label="metric.trend"
          :value="String(metric.value)"
          custom-value-class="app-kv-emphasis"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-loadmore v-if="loading" state="loading" custom-class="app-loadmore" />
        <wd-status-tip v-else tip="暂无概览数据" image="content" custom-class="app-status-tip" />
      </view>
    </AppSection>

    <AppSection title="角色分布">
      <wd-cell-group v-if="summary.roleDistribution.length" custom-class="app-list-group">
        <wd-cell
          v-for="item in summary.roleDistribution"
          :key="item.roleName"
          :title="item.roleName"
          :value="`${item.count} 人`"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="暂无角色分布数据" image="content" custom-class="app-status-tip" />
      </view>
    </AppSection>

    <AppSection title="模块覆盖">
      <wd-cell-group v-if="summary.moduleCoverage.length" custom-class="app-list-group">
        <wd-cell
          v-for="item in summary.moduleCoverage"
          :key="item.module"
          :title="item.module"
          :value="`${item.count} 项`"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="暂无模块覆盖数据" image="content" custom-class="app-status-tip" />
      </view>
    </AppSection>

    <AppSection title="最近成员">
      <wd-cell-group v-if="latestUsers.length" custom-class="app-list-group">
        <wd-cell
          v-for="item in latestUsers"
          :key="item.id"
          :title="item.nickname || item.username"
          :label="item.email || '未设置邮箱'"
          :value="formatTime(item.createdAt)"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="暂无成员数据" image="content" custom-class="app-status-tip" />
      </view>
    </AppSection>

    <AppSection title="最近动态">
      <wd-cell-group v-if="latestAuditFeed.length" custom-class="app-list-group">
        <wd-cell
          v-for="item in latestAuditFeed"
          :key="item.id"
          :title="item.action"
          :label="`${item.actor} · ${item.target}`"
          :value="formatTime(item.createdAt)"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="暂无动态" image="content" custom-class="app-status-tip" />
      </view>
    </AppSection>
  </AppPageShell>
</template>
