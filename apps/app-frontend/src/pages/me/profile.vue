<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'

definePage({
  style: {
    navigationBarTitleText: '个人信息',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const statusText = computed(() => {
  return userInfo.value.status === 'ACTIVE' ? '正常' : '停用'
})

onShow(() => {
  if (tokenStore.hasLogin) {
    void userStore.fetchUserInfo().catch(() => undefined)
  }
})
</script>

<template>
  <view class="native-page">
    <view class="page-section profile-header">
      <image class="profile-header__avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-header__body">
        <view class="profile-header__name">
          {{ userInfo.nickname || userInfo.username }}
        </view>
        <view class="profile-header__meta">
          @{{ userInfo.username || 'unknown' }}
        </view>
        <view class="profile-header__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        基本资料
      </view>
      <view class="row-list">
        <view class="row-item">
          <view class="row-title">
            昵称
          </view>
          <view class="row-value row-value--strong">
            {{ userInfo.nickname || '未设置' }}
          </view>
        </view>
        <view class="row-item">
          <view class="row-title">
            用户名
          </view>
          <view class="row-value">
            {{ userInfo.username || '--' }}
          </view>
        </view>
        <view class="row-item">
          <view class="row-title">
            邮箱
          </view>
          <view class="row-value">
            {{ userInfo.email || '未设置' }}
          </view>
        </view>
        <view class="row-item">
          <view class="row-title">
            账号状态
          </view>
          <view class="row-value">
            {{ statusText }}
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
          <view class="row-title">
            权限数量
          </view>
          <view class="row-value">
            {{ userInfo.permissions.length }}
          </view>
        </view>
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        角色
      </view>
      <view class="row-list" v-if="userInfo.roles.length">
        <view v-for="role in userInfo.roles" :key="role.id" class="row-item">
          <view class="row-main">
            <view class="row-title">
              {{ role.name }}
            </view>
            <view class="row-desc">
              {{ role.description || '无描述' }}
            </view>
          </view>
          <view class="row-value">
            {{ role.code }}
          </view>
        </view>
      </view>
      <view v-else class="panel-note">
        当前账号暂无角色。
      </view>
    </view>

    <view class="page-section">
      <view class="section-caption">
        权限标识
      </view>
      <view v-if="userInfo.permissions.length" class="tag-wrap">
        <view v-for="permission in userInfo.permissions" :key="permission" class="tag">
          {{ permission }}
        </view>
      </view>
      <view v-else class="panel-note">
        当前账号暂无权限标识。
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.profile-header {
  display: flex;
  align-items: center;
  padding: 32rpx;
}

.profile-header__avatar {
  width: 120rpx;
  height: 120rpx;
  flex-shrink: 0;
  border-radius: 24rpx;
  background: #e5e7eb;
}

.profile-header__body {
  margin-left: 24rpx;
  min-width: 0;
  flex: 1;
}

.profile-header__name {
  font-size: 38rpx;
  line-height: 1.4;
  font-weight: 600;
  color: #111827;
}

.profile-header__meta {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8b8f97;
  word-break: break-all;
}
</style>
