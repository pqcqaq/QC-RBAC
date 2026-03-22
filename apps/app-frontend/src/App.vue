<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { navigateToInterceptor } from '@/router/interceptor'
import { useTokenStore } from '@/store'

const tokenStore = useTokenStore()

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  void tokenStore.bootstrap()
})
onShow((options) => {
  console.log('App.vue onShow', options)
  void tokenStore.bootstrap()
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  }
  else {
    navigateToInterceptor.invoke({ url: '/' })
  }
})
onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
page {
  background: #f5f6f7;
  color: #111827;
  font-size: 28rpx;
}

view,
text,
button,
input,
image {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  line-height: 1;
}

button::after {
  border: none;
}

.native-page {
  min-height: 100vh;
  background: #f5f6f7;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.native-page--auth {
  min-height: 100vh;
  background: #ffffff;
  padding: 88rpx 48rpx calc(56rpx + env(safe-area-inset-bottom));
}

.page-header {
  padding: 32rpx 32rpx 8rpx;
}

.page-title {
  font-size: 48rpx;
  line-height: 1.25;
  font-weight: 600;
  color: #111827;
}

.page-subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #6b7280;
}

.page-section {
  margin-top: 24rpx;
  background: #ffffff;
}

.section-caption {
  padding: 18rpx 32rpx 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8b8f97;
}

.row-list {
  background: #ffffff;
}

.row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104rpx;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #eceef2;
}

.row-item:last-child {
  border-bottom: none;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  font-size: 30rpx;
  line-height: 1.4;
  color: #111827;
  word-break: break-all;
}

.row-desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8b8f97;
  word-break: break-all;
}

.row-value {
  margin-left: 24rpx;
  max-width: 320rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #6b7280;
  text-align: right;
  word-break: break-all;
}

.row-value--strong {
  color: #111827;
  font-weight: 600;
}

.row-arrow {
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #c4c8cf;
}

.panel-note {
  padding: 24rpx 32rpx;
  background: #ffffff;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8b8f97;
}

.primary-action,
.secondary-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  font-size: 30rpx;
  font-weight: 500;
}

.primary-action {
  background: #111827;
  color: #ffffff;
}

.secondary-action {
  background: #f3f4f6;
  color: #111827;
}

.form-sheet {
  margin-top: 56rpx;
  border-top: 1rpx solid #eceef2;
  background: #ffffff;
}

.form-item {
  display: flex;
  flex-direction: column;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eceef2;
}

.form-label {
  font-size: 24rpx;
  line-height: 1.5;
  color: #8b8f97;
}

.form-input {
  width: 100%;
  margin-top: 10rpx;
  font-size: 32rpx;
  line-height: 1.4;
  color: #111827;
}

.form-input::placeholder {
  color: #c0c5cd;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 24rpx 32rpx 32rpx;
  background: #ffffff;
}

.tag {
  padding: 12rpx 18rpx;
  background: #f3f4f6;
  font-size: 24rpx;
  line-height: 1.3;
  color: #374151;
}
</style>
