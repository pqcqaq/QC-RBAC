<script lang="ts" setup>
import { computed } from 'vue'
import AppNavBar from '@/components/app-nav-bar/app-nav-bar.vue'
import { isPageTabbar } from '@/tabbar/store'
import { HOME_PAGE, currRoute } from '@/utils'

defineOptions({
  name: 'AppPageShell',
})

const props = withDefaults(defineProps<{
  title: string
  description?: string
  auth?: boolean
  showBack?: boolean
}>(), {
  description: '',
  auth: false,
  showBack: undefined,
})

const currentPath = currRoute().path || ''
const isTabbarPage = computed(() => isPageTabbar(currentPath))
const shouldShowBack = computed(() => {
  if (typeof props.showBack === 'boolean') {
    return props.showBack
  }
  return !props.auth && Boolean(currentPath) && !isTabbarPage.value
})

function handleBack() {
  const pageStack = getCurrentPages()
  if (pageStack.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }

  if (isPageTabbar(HOME_PAGE)) {
    uni.switchTab({ url: HOME_PAGE })
    return
  }

  uni.reLaunch({ url: HOME_PAGE })
}
</script>

<template>
  <view :class="['app-page', auth ? 'app-page--auth' : '', isTabbarPage ? 'app-page--with-tabbar' : '']">
    <view :class="['app-page-shell', auth ? 'app-page-shell--auth' : '']">
      <view class="app-page-shell__nav">
        <AppNavBar :title="title" :auth="auth" :show-back="shouldShowBack" @back="handleBack">
          <template v-if="$slots.navRight" #right>
            <slot name="navRight" />
          </template>
        </AppNavBar>

        <view v-if="description || $slots.extra" class="app-page-shell__head">
          <view v-if="description" class="app-page-shell__desc">
            {{ description }}
          </view>
          <view v-if="$slots.extra" class="app-page-shell__extra">
            <slot name="extra" />
          </view>
        </view>
      </view>

      <view class="app-page-shell__body">
        <slot />
      </view>
    </view>
  </view>
</template>
