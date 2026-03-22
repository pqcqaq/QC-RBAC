<script setup lang="ts">
import { computed, ref } from 'vue'
import FgTabbar from '@/tabbar/index.vue'
import { customTabbarEnable } from '@/tabbar/config'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'

const isCurrentPageTabbar = ref(true)

const shouldShowCustomTabbar = computed(() => {
  return customTabbarEnable && isCurrentPageTabbar.value
})

onShow(() => {
  const { path } = currRoute()
  if (path === '/') {
    isCurrentPageTabbar.value = true
    return
  }
  isCurrentPageTabbar.value = isPageTabbar(path)
})
</script>

<template>
  <view class="app-root">
    <KuRootView />
    <FgTabbar v-if="shouldShowCustomTabbar" />
  </view>
</template>
