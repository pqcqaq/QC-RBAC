<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppLayout } from '@/composables/useAppLayout'
import FgTabbar from '@/tabbar/index.vue'
import { customTabbarEnable } from '@/tabbar/config'
import { isPageTabbar, tabbarStore } from './tabbar/store'
import { currRoute } from './utils'

const { rootCssVars } = useAppLayout()
const isCurrentPageTabbar = ref(true)

const shouldShowCustomTabbar = computed(() => {
  return customTabbarEnable && isCurrentPageTabbar.value
})

onShow(() => {
  const { path } = currRoute()
  tabbarStore.setAutoCurIdx(path)
  if (path === '/') {
    isCurrentPageTabbar.value = true
    return
  }
  isCurrentPageTabbar.value = isPageTabbar(path)
})
</script>

<template>
  <view class="app-root" :style="rootCssVars">
    <KuRootView />
    <FgTabbar v-if="shouldShowCustomTabbar" />
  </view>
</template>
