<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { appApi } from '@/api/client'
import AppAvatarUploader from '@/components/app-avatar-uploader/app-avatar-uploader.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '个人信息',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const savingProfile = ref(false)
const profileForm = reactive({
  nickname: '',
  email: '',
})

const canUploadAvatar = computed(() => {
  const permissions = userInfo.value.permissions || []
  return permissions.includes('file.upload.avatar') || permissions.includes('file.upload')
})

const profileDirty = computed(() => {
  const nickname = profileForm.nickname.trim()
  const email = profileForm.email.trim()
  const currentEmail = userInfo.value.email || ''
  return nickname !== userInfo.value.nickname || email !== currentEmail
})

const statusText = computed(() => userInfo.value.status === 'ACTIVE' ? '正常' : '停用')
const statusTagType = computed(() => userInfo.value.status === 'ACTIVE' ? 'success' : 'warning')

function syncProfileForm() {
  profileForm.nickname = userInfo.value.nickname || ''
  profileForm.email = userInfo.value.email || ''
}

watch(() => userInfo.value.id, () => {
  syncProfileForm()
}, { immediate: true })

function handleAvatarUpdated(user: typeof userInfo.value) {
  userStore.setUserInfo(user)
  syncProfileForm()
}

async function handleSaveProfile() {
  if (!tokenStore.hasLogin || savingProfile.value) {
    return
  }

  const nickname = profileForm.nickname.trim()
  const emailRaw = profileForm.email.trim()

  if (nickname.length < 2 || nickname.length > 24) {
    uni.showToast({
      title: '昵称长度需在 2-24 个字符',
      icon: 'none',
    })
    return
  }

  if (emailRaw && !/^\S+@\S+\.\S+$/.test(emailRaw)) {
    uni.showToast({
      title: '邮箱格式不正确',
      icon: 'none',
    })
    return
  }

  savingProfile.value = true
  try {
    const nextUser = await appApi.auth.updateProfile({
      nickname,
      email: emailRaw || null,
    })
    userStore.setUserInfo(nextUser)
    uni.showToast({
      title: '资料已更新',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '资料更新失败'),
      icon: 'none',
    })
  }
  finally {
    savingProfile.value = false
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  void userStore.fetchUserInfo().catch(() => undefined)
})
</script>

<template>
  <AppPageShell title="个人信息" description="编辑昵称、邮箱，并通过分步上传更新头像。">
    <AppSection title="头像">
      <view class="profile-card-wrap">
        <AppAvatarUploader
          :avatar-url="userInfo.avatarUrl"
          :display-name="userInfo.nickname || userInfo.username"
          :disabled="!canUploadAvatar"
          @updated="handleAvatarUpdated"
        />
        <view v-if="!canUploadAvatar" class="profile-card__hint">
          当前账号未分配 `file.upload.avatar` 或 `file.upload` 权限，无法上传头像。
        </view>
      </view>
    </AppSection>

    <AppSection title="基本资料" description="修改后会同步到当前账号。">
      <AppList>
        <AppInput v-model="profileForm.nickname" class="app-auth-input" label="昵称" placeholder="请输入昵称" />
        <AppInput v-model="profileForm.email" class="app-auth-input" label="邮箱" placeholder="请输入邮箱（可留空）" />
      </AppList>
      <view class="profile-actions">
        <AppButton
          block
          size="large"
          :loading="savingProfile"
          :disabled="!profileDirty"
          @click="handleSaveProfile"
        >
          保存资料
        </AppButton>
      </view>
    </AppSection>

    <AppSection title="账号状态">
      <AppList>
        <AppListItem title="用户名" :value="userInfo.username || '--'" />
        <AppListItem title="账号状态" :value="statusText" value-emphasis />
        <AppListItem title="角色数量" :value="String(userInfo.roles.length)" />
        <AppListItem title="权限数量" :value="String(userInfo.permissions.length)" />
      </AppList>
      <view class="profile-tag-block">
        <view class="app-tag-row app-tag-row--compact">
          <AppTag :type="statusTagType">
            {{ statusText }}
          </AppTag>
          <AppTag v-for="role in userInfo.roles" :key="role.id" type="primary">
            {{ role.name }}
          </AppTag>
        </view>
      </view>
    </AppSection>

    <AppSection title="权限标识">
      <view v-if="userInfo.permissions.length" class="profile-tag-block">
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

<style scoped lang="scss">
.profile-card-wrap {
  padding: 0 32rpx;
}

.profile-card__hint {
  margin-top: 14rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: var(--app-warning);
}

.profile-actions {
  padding: 20rpx 32rpx 0;
}

.profile-tag-block {
  padding: 0 32rpx 16rpx;
  background: var(--app-surface);
  border-top: 1rpx solid var(--app-border);
  border-bottom: 1rpx solid var(--app-border);
}
</style>
