<script setup lang="ts">
defineOptions({
  name: 'AppStatus',
})

type AppStatusMode = 'empty' | 'loading'

withDefaults(defineProps<{
  mode?: AppStatusMode
  text?: string
}>(), {
  mode: 'empty',
  text: '',
})
</script>

<template>
  <view class="app-status" :class="`app-status--${mode}`">
    <view v-if="mode === 'loading'" class="app-status__spinner" />
    <view v-else class="app-status__empty-mark">
      <view class="app-status__empty-line" />
      <view class="app-status__empty-line app-status__empty-line--short" />
    </view>
    <text class="app-status__text">
      {{ text }}
    </text>
  </view>
</template>

<style scoped lang="scss">
.app-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28rpx 32rpx;
}

.app-status__spinner {
  width: 36rpx;
  height: 36rpx;
  border: 4rpx solid rgba(18, 26, 39, 0.12);
  border-top-color: var(--app-text);
  border-radius: 50%;
  box-sizing: border-box;
  animation: app-status-spin 0.72s linear infinite;
}

.app-status__empty-mark {
  width: 58rpx;
  height: 58rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.app-status__empty-line {
  width: 24rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: var(--app-border-strong);
}

.app-status__empty-line + .app-status__empty-line {
  margin-top: 8rpx;
}

.app-status__empty-line--short {
  width: 16rpx;
}

.app-status__text {
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--app-text-muted);
}

@keyframes app-status-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
