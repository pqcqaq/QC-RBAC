<script lang="ts" setup>
defineOptions({
  name: 'AppSection',
})

withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <view class="app-section">
    <view class="app-section__head">
      <view class="app-section__meta">
        <view class="app-section__title">
          {{ title }}
        </view>
        <view v-if="description" class="app-section__desc">
          {{ description }}
        </view>
      </view>
      <slot name="extra" />
    </view>

    <slot />
  </view>
</template>
