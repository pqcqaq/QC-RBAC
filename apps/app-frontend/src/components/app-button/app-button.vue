<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppButton',
})

type AppButtonType = 'primary' | 'info' | 'default' | 'danger'
type AppButtonSize = 'large' | 'medium'

const props = withDefaults(defineProps<{
  type?: AppButtonType
  size?: AppButtonSize
  block?: boolean
  loading?: boolean
  disabled?: boolean
}>(), {
  type: 'primary',
  size: 'large',
  block: false,
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  (event: 'click'): void
}>()

const resolvedType = computed(() => props.type === 'default' ? 'info' : props.type)
const isDisabled = computed(() => props.disabled || props.loading)
const classes = computed(() => [
  'app-button',
  `app-button--${resolvedType.value}`,
  `app-button--${props.size}`,
  props.block ? 'app-button--block' : '',
  isDisabled.value ? 'is-disabled' : '',
  props.loading ? 'is-loading' : '',
])

function handleClick() {
  if (isDisabled.value) {
    return
  }
  emit('click')
}
</script>

<template>
  <view
    :class="classes"
    :hover-class="isDisabled ? '' : 'app-button--hover'"
    :hover-stay-time="80"
    @click="handleClick"
  >
    <view class="app-button__content">
      <view v-if="loading" class="app-button__spinner" />
      <text class="app-button__text">
        <slot />
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 84rpx;
  padding: 0 28rpx;
  border: 1rpx solid transparent;
  border-radius: 20rpx;
  background: var(--app-accent);
  color: #fff;
  box-sizing: border-box;
  transition: opacity 0.16s ease, background-color 0.16s ease, border-color 0.16s ease;
}

.app-button--block {
  display: flex;
  width: 100%;
}

.app-button--large {
  min-height: 92rpx;
}

.app-button--medium {
  min-height: 76rpx;
}

.app-button--primary {
  background: var(--app-accent);
  color: #fff;
}

.app-button--info {
  background: var(--app-surface);
  border-color: var(--app-border);
  color: var(--app-text);
}

.app-button--danger {
  background: var(--app-danger);
  color: #fff;
}

.app-button--hover.app-button--primary {
  background: var(--app-accent-pressed);
}

.app-button--hover.app-button--info {
  background: var(--app-surface-soft);
}

.app-button--hover.app-button--danger {
  background: #c61f1f;
}

.app-button.is-disabled {
  opacity: 0.52;
}

.app-button__content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-button__spinner {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.36);
  border-top-color: #fff;
  border-radius: 50%;
  box-sizing: border-box;
  animation: app-button-spin 0.7s linear infinite;
}

.app-button--info .app-button__spinner {
  border-color: rgba(18, 26, 39, 0.18);
  border-top-color: var(--app-text);
}

.app-button__text {
  font-size: 28rpx;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.01em;
}

@keyframes app-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
