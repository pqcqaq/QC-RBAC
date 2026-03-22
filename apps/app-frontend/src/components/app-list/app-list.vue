<script setup lang="ts">
defineOptions({
  name: 'AppList',
})
</script>

<template>
  <view class="app-list">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-list {
  background: var(--app-surface);
  border-top: 1rpx solid var(--app-border);
  border-bottom: 1rpx solid var(--app-border);
}

:deep(.app-list-item + .app-list-item) {
  border-top: 1rpx solid var(--app-border-light);
}
</style>
