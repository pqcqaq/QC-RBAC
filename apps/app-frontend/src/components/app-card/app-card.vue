<script setup lang="ts">
defineOptions({
  name: 'AppCard',
})

withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '',
  description: '',
})
</script>

<template>
  <view class="app-card">
    <view v-if="title || description || $slots.header" class="app-card__header">
      <slot name="header">
        <view v-if="title" class="app-card__title">
          {{ title }}
        </view>
        <view v-if="description" class="app-card__description">
          {{ description }}
        </view>
      </slot>
    </view>

    <view class="app-card__body">
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-card {
  margin: 0 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
}

.app-card__header {
  padding: 24rpx 24rpx 8rpx;
}

.app-card__title {
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 650;
  color: var(--app-text);
}

.app-card__description {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.app-card__body {
  padding: 20rpx 24rpx 24rpx;
}
</style>
