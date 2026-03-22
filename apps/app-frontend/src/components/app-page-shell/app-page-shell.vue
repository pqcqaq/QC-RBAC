<script lang="ts" setup>
defineOptions({
  name: 'AppPageShell',
})

withDefaults(defineProps<{
  title: string
  description?: string
  auth?: boolean
}>(), {
  description: '',
  auth: false,
})
</script>

<template>
  <view :class="['app-page', auth ? 'app-page--auth' : '']">
    <view :class="['app-page-shell', auth ? 'app-page-shell--auth' : '']">
      <view class="app-page-shell__head">
        <view class="app-page-shell__title">
          {{ title }}
        </view>
        <view v-if="description" class="app-page-shell__desc">
          {{ description }}
        </view>
        <view v-if="$slots.extra" class="app-page-shell__extra">
          <slot name="extra" />
        </view>
      </view>

      <view class="app-page-shell__body">
        <slot />
      </view>
    </view>
  </view>
</template>
