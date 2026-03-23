<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
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
      <AppAvatar
        class="app-hero__avatar"
        :src="userInfo.avatarUrl || '/static/images/default-avatar.png'"
        :text="userInfo.nickname || userInfo.username"
        size="large"
        shape="square"
      />
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
          <AppTag :type="statusTagType">
            {{ statusText }}
          </AppTag>
          <AppTag type="primary">
            {{ userInfo.roles.length }} 个角色
          </AppTag>
          <AppTag type="default">
            {{ userInfo.permissions.length }} 项权限
          </AppTag>
        </view>
      </view>
    </view>

    <AppSection title="基本资料">
      <AppList>
        <AppListItem title="昵称" :value="userInfo.nickname || '未设置'" value-emphasis />
        <AppListItem title="用户名" :value="userInfo.username || '--'" />
        <AppListItem title="邮箱" :value="userInfo.email || '未设置'" />
        <AppListItem title="账号状态" :value="statusText" />
        <AppListItem title="角色数量" :value="String(userInfo.roles.length)" />
        <AppListItem title="权限数量" :value="String(userInfo.permissions.length)" />
      </AppList>
    </AppSection>

    <AppSection title="角色">
      <AppList v-if="userInfo.roles.length">
        <AppListItem
          v-for="role in userInfo.roles"
          :key="role.id"
          :title="role.name"
          :label="role.description || '无描述'"
          :value="role.code"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="当前账号暂无角色。" />
      </view>
    </AppSection>

    <AppSection title="权限标识" description="以下为当前会话生效的权限代码。">
      <view v-if="userInfo.permissions.length" class="app-permission-wrap">
        <view class="app-tag-row app-tag-row--compact">
          <AppTag v-for="permission in userInfo.permissions" :key="permission" type="default">
            {{ permission }}
          </AppTag>
        </view>
      </view>
      <view v-else class="app-status-wrap">
        <AppStatus text="当前账号暂无权限标识。" />
      </view>
    </AppSection>
  </AppPageShell>
</template>
