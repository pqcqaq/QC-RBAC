<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
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
      <wd-avatar :src="userInfo.avatar || '/static/images/default-avatar.png'" size="large" shape="square" />
      <view class="app-hero__body">
        <view class="app-hero__title">
          {{ displayName }}
        </view>
        <view class="app-hero__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="app-tag-row">
          <wd-tag round plain :type="tokenStore.hasLogin ? statusTagType : 'default'" custom-class="app-tag">
            {{ tokenStore.hasLogin ? (userInfo.status === 'ACTIVE' ? '正常' : '停用') : '未登录' }}
          </wd-tag>
          <wd-tag v-if="tokenStore.hasLogin" round plain type="primary" custom-class="app-tag">
            {{ roleSummary }}
          </wd-tag>
        </view>
      </view>
    </view>

    <template v-if="tokenStore.hasLogin">
      <AppSection title="账户">
        <wd-cell-group custom-class="app-list-group">
          <wd-cell title="个人信息" label="查看账号资料、角色和权限。" is-link clickable @click="openProfile" />
          <wd-cell title="应用设置" label="查看已同步的个人配置。" is-link clickable @click="openSettings" />
        </wd-cell-group>
      </AppSection>

      <AppSection title="当前状态">
        <wd-cell-group custom-class="app-list-group">
          <wd-cell title="账号状态" :value="userInfo.status === 'ACTIVE' ? '正常' : '停用'" custom-value-class="app-kv-emphasis" />
          <wd-cell title="角色数量" :value="String(userInfo.roles.length)" />
          <wd-cell title="当前角色" :label="roleSummary" />
          <wd-cell title="权限数量" :value="String(userInfo.permissions.length)" />
        </wd-cell-group>
      </AppSection>

      <view class="app-action-block">
        <wd-button block size="large" type="info" @click="handleLogout">
          退出登录
        </wd-button>
      </view>
    </template>

    <template v-else>
      <AppSection title="账户提示">
        <view class="app-status-wrap app-status-wrap--spacious">
          <wd-status-tip tip="登录后可查看个人信息和同步配置。" image="message" custom-class="app-status-tip" />
        </view>
      </AppSection>

      <view class="app-action-block">
        <wd-button block size="large" @click="handleLogin">
          去登录
        </wd-button>
        <wd-button block size="large" type="info" @click="handleRegister">
          去注册
        </wd-button>
      </view>
    </template>
  </AppPageShell>
</template>
