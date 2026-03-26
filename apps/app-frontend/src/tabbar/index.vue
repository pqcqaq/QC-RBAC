<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/store/ui'
import { customTabbarEnable, tabbarCacheEnable } from './config'
import { tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'

// #ifdef MP-WEIXIN
defineOptions({
  virtualHost: true,
})
// #endif

const uiStore = useUiStore()
const tabbarStyleClass = computed(() => `app-tabbar--${uiStore.preferences.tabbarStyle}`)

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
  <view v-if="customTabbarEnable" class="app-tabbar" :class="tabbarStyleClass">
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
  bottom: var(--app-tabbar-offset-y);
  left: var(--app-tabbar-offset-x);
  right: var(--app-tabbar-offset-x);
  z-index: 1200;
  box-sizing: border-box;
}

.app-tabbar__inner {
  padding-bottom: var(--app-safe-bottom);
  background: var(--app-tabbar-bg);
  border: 1rpx solid var(--app-tabbar-border);
  border-bottom: 0;
  box-shadow: var(--app-tabbar-shadow);
  border-radius: var(--app-tabbar-radius) var(--app-tabbar-radius) 0 0;
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.app-tabbar--solid {
  left: 0;
  right: 0;
  bottom: 0;
}

.app-tabbar--solid .app-tabbar__inner {
  border-left: 0;
  border-right: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
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
  padding: 10rpx 0 8rpx;
}
</style>
