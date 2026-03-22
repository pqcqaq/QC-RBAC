<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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

const statusTagType = computed(() => {
  return userInfo.value.status === 'ACTIVE' ? 'success' : 'warning'
})

onShow(() => {
  if (tokenStore.hasLogin) {
    void userStore.fetchUserInfo().catch(() => undefined)
  }
})
</script>

<template>
  <AppPageShell title="个人信息" description="查看当前账号资料、角色和权限。">
    <view class="app-hero">
      <wd-avatar :src="userInfo.avatar || '/static/images/default-avatar.png'" size="large" shape="square" />
      <view class="app-hero__body">
        <view class="app-hero__title">
          {{ userInfo.nickname || userInfo.username }}
        </view>
        <view class="app-hero__meta">
          @{{ userInfo.username || 'unknown' }}
        </view>
        <view class="app-hero__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="app-tag-row">
          <wd-tag round plain :type="statusTagType" custom-class="app-tag">
            {{ statusText }}
          </wd-tag>
          <wd-tag round plain type="primary" custom-class="app-tag">
            {{ userInfo.roles.length }} 个角色
          </wd-tag>
          <wd-tag round plain type="default" custom-class="app-tag">
            {{ userInfo.permissions.length }} 项权限
          </wd-tag>
        </view>
      </view>
    </view>

    <AppSection title="基本资料">
      <wd-cell-group custom-class="app-list-group">
        <wd-cell title="昵称" :value="userInfo.nickname || '未设置'" custom-value-class="app-kv-emphasis" />
        <wd-cell title="用户名" :value="userInfo.username || '--'" />
        <wd-cell title="邮箱" :value="userInfo.email || '未设置'" />
        <wd-cell title="账号状态" :value="statusText" />
        <wd-cell title="角色数量" :value="String(userInfo.roles.length)" />
        <wd-cell title="权限数量" :value="String(userInfo.permissions.length)" />
      </wd-cell-group>
    </AppSection>

    <AppSection title="角色">
      <wd-cell-group v-if="userInfo.roles.length" custom-class="app-list-group">
        <wd-cell
          v-for="role in userInfo.roles"
          :key="role.id"
          :title="role.name"
          :label="role.description || '无描述'"
          :value="role.code"
        />
      </wd-cell-group>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="当前账号暂无角色。" image="collect" custom-class="app-status-tip" />
      </view>
    </AppSection>

    <AppSection title="权限标识" description="以下为当前会话生效的权限代码。">
      <view v-if="userInfo.permissions.length" class="app-permission-wrap">
        <view class="app-tag-row app-tag-row--compact">
          <wd-tag v-for="permission in userInfo.permissions" :key="permission" round plain type="default" custom-class="app-tag">
            {{ permission }}
          </wd-tag>
        </view>
      </view>
      <view v-else class="app-status-wrap">
        <wd-status-tip tip="当前账号暂无权限标识。" image="collect" custom-class="app-status-tip" />
      </view>
    </AppSection>
  </AppPageShell>
</template>
