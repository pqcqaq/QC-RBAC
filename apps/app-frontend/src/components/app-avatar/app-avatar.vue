<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({
  name: 'AppAvatar',
})

type AppAvatarSize = 'medium' | 'large'
type AppAvatarShape = 'square' | 'circle'

const props = withDefaults(defineProps<{
  src?: string
  text?: string
  size?: AppAvatarSize
  shape?: AppAvatarShape
}>(), {
  src: '',
  text: '',
  size: 'medium',
  shape: 'square',
})

const imageError = ref(false)

const classes = computed(() => [
  'app-avatar',
  `app-avatar--${props.size}`,
  `app-avatar--${props.shape}`,
])

const fallbackText = computed(() => {
  const source = props.text.trim()
  if (!source) {
    return '用'
  }
  return source.slice(0, source.length > 2 ? 2 : source.length).toUpperCase()
})

watch(() => props.src, () => {
  imageError.value = false
})

function handleError() {
  imageError.value = true
}
</script>

<template>
  <view :class="classes">
    <image
      v-if="src && !imageError"
      class="app-avatar__image"
      :src="src"
      mode="aspectFill"
      @error="handleError"
    />
    <text v-else class="app-avatar__text">
      {{ fallbackText }}
    </text>
  </view>
</template>

<style scoped lang="scss">
.app-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(180deg, #eef2f6 0%, #e4e9f0 100%);
  color: var(--app-text-secondary);
  box-sizing: border-box;
}

.app-avatar--medium {
  width: 88rpx;
  height: 88rpx;
}

.app-avatar--large {
  width: 108rpx;
  height: 108rpx;
}

.app-avatar--square {
  border-radius: 24rpx;
}

.app-avatar--circle {
  border-radius: 999rpx;
}

.app-avatar__image {
  width: 100%;
  height: 100%;
  display: block;
}

.app-avatar__text {
  font-size: 28rpx;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.app-avatar--large .app-avatar__text {
  font-size: 32rpx;
}
</style>
