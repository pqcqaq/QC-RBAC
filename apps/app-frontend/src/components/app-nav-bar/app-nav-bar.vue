<script setup lang="ts">
defineOptions({
  name: 'AppNavBar',
})

withDefaults(defineProps<{
  title: string
  showBack?: boolean
  auth?: boolean
}>(), {
  showBack: false,
  auth: false,
})

const emit = defineEmits<{
  (event: 'back'): void
}>()

function handleBack() {
  emit('back')
}
</script>

<template>
  <view :class="['app-nav-bar', auth ? 'app-nav-bar--auth' : '']">
    <view class="app-nav-bar__inner">
      <view class="app-nav-bar__side app-nav-bar__side--left">
        <view
          v-if="showBack"
          class="app-nav-bar__back"
          hover-class="app-nav-bar__back--hover"
          :hover-stay-time="80"
          @click="handleBack"
        >
          <view class="app-nav-bar__back-icon" />
        </view>
      </view>

      <view class="app-nav-bar__title">
        {{ title }}
      </view>

      <view class="app-nav-bar__side app-nav-bar__side--right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-nav-bar {
  min-height: var(--app-nav-height);
}

.app-nav-bar__inner {
  min-height: var(--app-nav-height);
  display: flex;
  align-items: center;
  padding: 0 20rpx;
}

.app-nav-bar__side {
  width: 72rpx;
  min-height: 72rpx;
  display: flex;
  align-items: center;
}

.app-nav-bar__side--right {
  justify-content: flex-end;
}

.app-nav-bar__back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-nav-bar__back--hover {
  background: rgba(18, 26, 39, 0.05);
}

.app-nav-bar__back-icon {
  width: 18rpx;
  height: 18rpx;
  border-left: 3rpx solid var(--app-text);
  border-bottom: 3rpx solid var(--app-text);
  transform: rotate(45deg);
  margin-left: 8rpx;
}

.app-nav-bar__title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 650;
  color: var(--app-text);
  text-align: center;
  letter-spacing: -0.01em;
}

.app-nav-bar--auth .app-nav-bar__inner {
  padding: 0 32rpx;
}

.app-nav-bar--auth .app-nav-bar__side {
  display: none;
}

.app-nav-bar--auth .app-nav-bar__title {
  text-align: left;
  font-size: 36rpx;
}
</style>
