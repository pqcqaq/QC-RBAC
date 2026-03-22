<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppTheme } from '@/composables/useAppTheme'
import FgTabbar from '@/tabbar/index.vue'
import { customTabbarEnable } from '@/tabbar/config'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'

const { theme, themeVars } = useAppTheme()
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
  <wd-config-provider :theme="theme" :theme-vars="themeVars" custom-class="app-root">
    <KuRootView />
    <FgTabbar v-if="shouldShowCustomTabbar" />
  </wd-config-provider>
</template>
