<script setup lang="ts">
import { customTabbarEnable, tabbarCacheEnable } from './config'
import { tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'

// #ifdef MP-WEIXIN
defineOptions({
  virtualHost: true,
})
// #endif

function handleClick(index: number) {
  if (index === tabbarStore.curIdx) {
    return
  }

  const list = tabbarList.value
  const target = list[index]
  if (!target) {
    return
  }

  tabbarStore.setCurIdx(index)
  if (tabbarCacheEnable) {
    uni.switchTab({ url: target.pagePath })
  }
  else {
    uni.navigateTo({ url: target.pagePath })
  }
}
</script>

<template>
  <view v-if="customTabbarEnable" class="app-tabbar">
    <view class="app-tabbar__inner" @touchmove.stop.prevent>
      <view class="app-tabbar__rail">
        <view
          v-for="(item, index) in tabbarList"
          :key="item.pagePath"
          class="app-tabbar__item"
          @click="handleClick(index)"
        >
          <TabbarItem :item="item" :active="tabbarStore.curIdx === index" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1200;
  box-sizing: border-box;
}

.app-tabbar__inner {
  padding-bottom: var(--app-safe-bottom);
  background: rgba(255, 255, 255, 0.94);
  border-top: 1rpx solid rgba(207, 215, 226, 0.96);
  box-shadow: 0 -8px 24px rgba(18, 26, 39, 0.05);
  backdrop-filter: blur(18px);
}

.app-tabbar__rail {
  min-height: var(--app-tabbar-base-height);
  display: flex;
  align-items: center;
  padding: 0 12rpx;
}

.app-tabbar__item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 0 6rpx;
}
</style>
