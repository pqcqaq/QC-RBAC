<script setup lang="ts">
import type { CurrentUser } from '@rbac/api-common'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppButton from '@/components/app-button/app-button.vue'
import {
  DEFAULT_AVATAR_MAX_HEIGHT,
  DEFAULT_AVATAR_MAX_SIZE_MB,
  DEFAULT_AVATAR_MAX_WIDTH,
  useManagedAvatarUpload,
} from '@/composables/useManagedAvatarUpload'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'AppAvatarUploader',
})

const props = withDefaults(defineProps<{
  avatarUrl?: string | null
  displayName?: string
  disabled?: boolean
  maxSizeMb?: number
  maxWidth?: number
  maxHeight?: number
}>(), {
  avatarUrl: '',
  displayName: '',
  disabled: false,
  maxSizeMb: DEFAULT_AVATAR_MAX_SIZE_MB,
  maxWidth: DEFAULT_AVATAR_MAX_WIDTH,
  maxHeight: DEFAULT_AVATAR_MAX_HEIGHT,
})

const emit = defineEmits<{
  (event: 'updated', user: CurrentUser): void
}>()

const { uploading, removeAvatar, selectAndUploadAvatar } = useManagedAvatarUpload({
  maxSizeMb: props.maxSizeMb,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight,
})

async function handleUploadAvatar() {
  if (props.disabled || uploading.value) {
    return
  }

  try {
    const user = await selectAndUploadAvatar()
    emit('updated', user)
    uni.showToast({
      title: '头像已更新',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '头像上传失败'),
      icon: 'none',
    })
  }
}

function handleRemoveAvatar() {
  if (props.disabled || uploading.value) {
    return
  }

  uni.showModal({
    title: '移除头像',
    content: '确定移除当前头像吗？',
    success: async (result) => {
      if (!result.confirm) {
        return
      }

      try {
        const user = await removeAvatar()
        emit('updated', user)
        uni.showToast({
          title: '头像已移除',
          icon: 'none',
        })
      }
      catch (error: unknown) {
        uni.showToast({
          title: getErrorMessage(error, '移除头像失败'),
          icon: 'none',
        })
      }
    },
  })
}
</script>

<template>
  <view class="app-avatar-uploader">
    <AppAvatar
      class="app-avatar-uploader__avatar"
      :src="avatarUrl || ''"
      :text="displayName || '用户'"
      size="large"
      shape="square"
    />

    <view class="app-avatar-uploader__actions">
      <AppButton size="medium" :loading="uploading" :disabled="disabled" @click="handleUploadAvatar">
        更换头像
      </AppButton>
      <AppButton
        size="medium"
        type="info"
        :loading="uploading"
        :disabled="disabled"
        @click="handleRemoveAvatar"
      >
        移除头像
      </AppButton>
      <view class="app-avatar-uploader__hint">
        支持 JPG/PNG/WebP，大小 ≤ {{ maxSizeMb }}MB，尺寸 ≤ {{ maxWidth }}x{{ maxHeight }}。
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-avatar-uploader {
  display: flex;
  align-items: center;
}

.app-avatar-uploader__avatar {
  flex-shrink: 0;
}

.app-avatar-uploader__actions {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
}

.app-avatar-uploader__actions :deep(.app-button) + :deep(.app-button) {
  margin-top: 10rpx;
}

.app-avatar-uploader__hint {
  margin-top: 12rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: var(--app-text-muted);
}
</style>
