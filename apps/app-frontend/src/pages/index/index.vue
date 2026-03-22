<script lang="ts" setup>
import type { DashboardSummary } from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
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
        <AppTag v-for="role in roleTags" :key="role.id" type="primary">
          {{ role.name }}
        </AppTag>
      </view>
    </template>

    <AppSection title="快捷入口" description="常用功能入口。">
      <AppList>
        <AppListItem title="个人信息" label="查看账号资料、角色和权限。" is-link clickable @click="openProfile" />
        <AppListItem title="应用设置" label="查看已同步的个人配置。" is-link clickable @click="openSettings" />
      </AppList>
    </AppSection>

    <AppSection title="概览" description="核心指标摘要。">
      <AppList v-if="summary.metrics.length">
        <AppListItem
          v-for="metric in summary.metrics"
          :key="metric.label"
          :title="metric.label"
          :label="metric.trend"
          :value="String(metric.value)"
          value-emphasis
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus v-if="loading" mode="loading" text="加载中" />
        <AppStatus v-else text="暂无概览数据" />
      </view>
    </AppSection>

    <AppSection title="角色分布">
      <AppList v-if="summary.roleDistribution.length">
        <AppListItem
          v-for="item in summary.roleDistribution"
          :key="item.roleName"
          :title="item.roleName"
          :value="`${item.count} 人`"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无角色分布数据" />
      </view>
    </AppSection>

    <AppSection title="模块覆盖">
      <AppList v-if="summary.moduleCoverage.length">
        <AppListItem
          v-for="item in summary.moduleCoverage"
          :key="item.module"
          :title="item.module"
          :value="`${item.count} 项`"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无模块覆盖数据" />
      </view>
    </AppSection>

    <AppSection title="最近成员">
      <AppList v-if="latestUsers.length">
        <AppListItem
          v-for="item in latestUsers"
          :key="item.id"
          :title="item.nickname || item.username"
          :label="item.email || '未设置邮箱'"
          :value="formatTime(item.createdAt)"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无成员数据" />
      </view>
    </AppSection>

    <AppSection title="最近动态">
      <AppList v-if="latestAuditFeed.length">
        <AppListItem
          v-for="item in latestAuditFeed"
          :key="item.id"
          :title="item.action"
          :label="`${item.actor} · ${item.target}`"
          :value="formatTime(item.createdAt)"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无动态" />
      </view>
    </AppSection>
  </AppPageShell>
</template>
