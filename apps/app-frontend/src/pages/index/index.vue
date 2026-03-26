<script lang="ts" setup>
import type { DashboardSummary } from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import AppCard from '@/components/app-card/app-card.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getDashboardSummary } from '@/api/login'
import { useTokenStore, useUiStore, useUserStore } from '@/store'
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
const uiStore = useUiStore()
const loading = ref(false)

const summary = reactive<DashboardSummary>({
  metrics: [],
  roleDistribution: [],
  moduleCoverage: [],
  latestUsers: [],
  auditFeed: [],
})

const portalLayout = computed(() => uiStore.preferences.portalLayout)
const isFocusLayout = computed(() => portalLayout.value === 'focus')

const headerDescription = computed(() => {
  const name = userStore.userInfo.nickname || userStore.userInfo.username || '欢迎使用'
  const modeText = isFocusLayout.value ? '聚焦模式' : '概览模式'
  return `${name}，当前为${modeText}。`
})

const latestUsers = computed(() => summary.latestUsers.slice(0, isFocusLayout.value ? 3 : 5))
const latestAuditFeed = computed(() => summary.auditFeed.slice(0, isFocusLayout.value ? 4 : 6))
const focusMetrics = computed(() => summary.metrics.slice(0, 3))
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

    <AppSection title="门户模式" description="可在设置页切换概览/聚焦布局。">
      <AppCard :title="isFocusLayout ? '聚焦布局' : '概览布局'" :description="isFocusLayout ? '优先展示关键指标与最新动态。' : '展示完整运营数据和成员分布。'" />
    </AppSection>

    <AppSection title="快捷入口" description="常用功能入口。">
      <AppList>
        <AppListItem title="个人信息" label="查看账号资料、角色和权限。" is-link clickable @click="openProfile" />
        <AppListItem title="应用设置" label="配置主题、密度、门户布局和动效。" is-link clickable @click="openSettings" />
      </AppList>
    </AppSection>

    <AppSection v-if="isFocusLayout" title="关键指标" description="当前聚焦模式仅展示关键数据。">
      <AppList v-if="focusMetrics.length">
        <AppListItem
          v-for="metric in focusMetrics"
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

    <template v-else>
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
    </template>

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
          :title="item.summary"
          :label="`状态 ${item.statusCode} · ${item.actor}`"
          :value="formatTime(item.createdAt)"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无动态" />
      </view>
    </AppSection>
  </AppPageShell>
</template>
