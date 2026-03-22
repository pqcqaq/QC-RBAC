<script setup lang="ts">
import type { CustomTabBarItem } from './types'

defineProps<{
  item: CustomTabBarItem
  active: boolean
}>()

function getImageSource(item: CustomTabBarItem, active: boolean) {
  if (!item.iconActive) {
    return item.icon
  }
  return active ? item.iconActive : item.icon
}
</script>

<template>
  <view class="app-tabbar-item" :class="active ? 'is-active' : ''">
    <view class="app-tabbar-item__icon-wrap">
      <template v-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
        <view :class="['app-tabbar-item__icon', item.icon]" />
      </template>
      <template v-if="item.iconType === 'image'">
        <image :src="getImageSource(item, active)" mode="aspectFit" class="app-tabbar-item__image" />
      </template>

      <view v-if="item.badge" class="app-tabbar-item__badge-wrap">
        <template v-if="item.badge === 'dot'">
          <view class="app-tabbar-item__dot" />
        </template>
        <template v-else>
          <view class="app-tabbar-item__badge">
            {{ item.badge > 99 ? '99+' : item.badge }}
          </view>
        </template>
      </view>
    </view>

    <text class="app-tabbar-item__text">
      {{ item.text }}
    </text>
  </view>
</template>

<style scoped lang="scss">
.app-tabbar-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  color: var(--app-text-muted);
  transition: color 0.18s ease;
}

.app-tabbar-item.is-active {
  color: var(--app-accent);
}

.app-tabbar-item__icon-wrap {
  position: relative;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-tabbar-item__icon {
  font-size: 42rpx;
  line-height: 1;
}

.app-tabbar-item__image {
  width: 40rpx;
  height: 40rpx;
}

.app-tabbar-item__text {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 500;
}

.app-tabbar-item__badge-wrap {
  position: absolute;
  top: -6rpx;
  right: -12rpx;
}

.app-tabbar-item__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #f04438;
}

.app-tabbar-item__badge {
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #f04438;
  color: #fff;
  font-size: 18rpx;
  line-height: 28rpx;
  text-align: center;
  box-sizing: border-box;
}
</style>
