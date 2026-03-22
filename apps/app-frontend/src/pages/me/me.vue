<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
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

const roleSummary = computed(() => {
  return userInfo.value.roles.map(role => role.name).join('、') || '未分配角色'
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
</script>

<template>
  <view class="native-page">
    <view class="page-section profile-summary">
      <image class="profile-summary__avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-summary__body">
        <view class="profile-summary__name">
          {{ displayName }}
        </view>
        <view class="profile-summary__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="profile-summary__meta">
          {{ tokenStore.hasLogin ? roleSummary : '登录后查看账号详情' }}
        </view>
      </view>
    </view>

    <template v-if="tokenStore.hasLogin">
      <view class="page-section">
        <view class="section-caption">
          账户
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
          当前状态
        </view>
        <view class="row-list">
          <view class="row-item">
            <view class="row-title">
              账号状态
            </view>
            <view class="row-value row-value--strong">
              {{ userInfo.status === 'ACTIVE' ? '正常' : '停用' }}
            </view>
          </view>
          <view class="row-item">
            <view class="row-title">
              角色数量
            </view>
            <view class="row-value">
              {{ userInfo.roles.length }}
            </view>
          </view>
          <view class="row-item">
            <view class="row-main">
              <view class="row-title">
                当前角色
              </view>
              <view class="row-desc">
                {{ roleSummary }}
              </view>
            </view>
          </view>
          <view class="row-item">
            <view class="row-title">
              权限数量
            </view>
            <view class="row-value">
              {{ userInfo.permissions.length }}
            </view>
          </view>
        </view>
      </view>

      <view class="me-actions">
        <button class="secondary-action" @click="handleLogout">
          退出登录
        </button>
      </view>
    </template>

    <template v-else>
      <view class="page-section">
        <view class="section-caption">
          账户
        </view>
        <view class="row-list">
          <view class="row-item">
            <view class="row-main">
              <view class="row-title">
                当前未登录
              </view>
              <view class="row-desc">
                登录后可查看个人信息和同步配置。
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="me-actions">
        <button class="primary-action" @click="handleLogin">
          去登录
        </button>
        <button class="secondary-action me-actions__secondary" @click="handleRegister">
          去注册
        </button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.profile-summary {
  display: flex;
  align-items: center;
  padding: 32rpx;
}

.profile-summary__avatar {
  width: 112rpx;
  height: 112rpx;
  flex-shrink: 0;
  border-radius: 24rpx;
  background: #e5e7eb;
}

.profile-summary__body {
  margin-left: 24rpx;
  min-width: 0;
  flex: 1;
}

.profile-summary__name {
  font-size: 36rpx;
  line-height: 1.4;
  font-weight: 600;
  color: #111827;
}

.profile-summary__meta {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8b8f97;
  word-break: break-all;
}

.me-actions {
  padding: 32rpx;
}

.me-actions__secondary {
  margin-top: 16rpx;
}
</style>
