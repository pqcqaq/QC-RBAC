<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useUiStore, useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const uiStore = useUiStore()
const { userInfo } = storeToRefs(userStore)

const displayName = computed(() => {
  return userInfo.value.nickname || userInfo.value.username || '未登录'
})

const pageDescription = computed(() => {
  return tokenStore.hasLogin ? '查看账号资料、同步配置与登录状态。' : '登录后查看个人信息与配置。'
})

const roleSummary = computed(() => {
  return userInfo.value.roles.map(role => role.name).join('、') || '未分配角色'
})

const statusTagType = computed(() => {
  return userInfo.value.status === 'ACTIVE' ? 'success' : 'warning'
})

const appPreferenceSummary = computed(() => {
  const app = uiStore.preferences
  return `${app.themePresetId} · ${app.themeMode} · ${app.portalLayout}`
})

function handleLogin() {
  uni.navigateTo({
    url: LOGIN_PAGE,
  })
}

function handleRegister() {
  uni.navigateTo({
    url: REGISTER_PAGE,
  })
}

function openProfile() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/settings/index' })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        await tokenStore.logout()
        uni.reLaunch({ url: LOGIN_PAGE })
      }
    },
  })
}

onShow(() => {
  if (tokenStore.hasLogin) {
    void userStore.fetchUserInfo().catch(() => undefined)
  }
})
</script>

<template>
  <AppPageShell title="我的" :description="pageDescription">
    <view class="app-hero">
      <AppAvatar
        class="app-hero__avatar"
        :src="userInfo.avatarUrl || '/static/images/default-avatar.png'"
        :text="displayName"
        size="large"
        shape="square"
      />
      <view class="app-hero__body">
        <view class="app-hero__title">
          {{ displayName }}
        </view>
        <view class="app-hero__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="app-tag-row">
          <AppTag :type="tokenStore.hasLogin ? statusTagType : 'default'">
            {{ tokenStore.hasLogin ? (userInfo.status === 'ACTIVE' ? '正常' : '停用') : '未登录' }}
          </AppTag>
          <AppTag v-if="tokenStore.hasLogin" type="primary">
            {{ roleSummary }}
          </AppTag>
        </view>
      </view>
    </view>

    <template v-if="tokenStore.hasLogin">
      <AppSection title="账户">
        <AppList>
          <AppListItem title="个人信息" label="编辑昵称、邮箱和头像。" is-link clickable @click="openProfile" />
          <AppListItem title="应用设置" label="配置主题、布局、密度和动效。" is-link clickable @click="openSettings" />
        </AppList>
      </AppSection>

      <AppSection title="当前状态">
        <AppList>
          <AppListItem title="账号状态" :value="userInfo.status === 'ACTIVE' ? '正常' : '停用'" value-emphasis />
          <AppListItem title="角色数量" :value="String(userInfo.roles.length)" />
          <AppListItem title="当前角色" :label="roleSummary" />
          <AppListItem title="权限数量" :value="String(userInfo.permissions.length)" />
          <AppListItem title="界面配置" :label="appPreferenceSummary" />
        </AppList>
      </AppSection>

      <view class="app-action-block">
        <AppButton block size="large" type="info" @click="handleLogout">
          退出登录
        </AppButton>
      </view>
    </template>

    <template v-else>
      <AppSection title="账户提示">
        <view class="app-status-wrap app-status-wrap--spacious">
          <AppStatus text="登录后可查看个人信息和同步配置。" />
        </view>
      </AppSection>

      <view class="app-action-block">
        <AppButton block size="large" @click="handleLogin">
          去登录
        </AppButton>
        <AppButton block size="large" type="info" @click="handleRegister">
          去注册
        </AppButton>
      </view>
    </template>
  </AppPageShell>
</template>
