<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { LOGIN_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '注册',
  },
})

const tokenStore = useTokenStore()
const redirectUrl = ref('')
const submitting = ref(false)
const form = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
})

function normalizeRedirect(value?: string) {
  if (!value) {
    return ''
  }
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function finishAuth() {
  const url = redirectUrl.value || HOME_PAGE
  if (isPageTabbar(url)) {
    uni.switchTab({ url })
    return
  }
  uni.reLaunch({ url })
}

onLoad((options) => {
  redirectUrl.value = normalizeRedirect(typeof options?.redirect === 'string' ? options.redirect : '')
})

async function submit() {
  if (submitting.value) {
    return
  }
  if (!form.username.trim() || !form.nickname.trim() || !form.email.trim() || !form.password) {
    uni.showToast({
      title: '请完整填写注册信息',
      icon: 'none',
    })
    return
  }

  submitting.value = true
  try {
    await tokenStore.register({
      username: form.username.trim(),
      nickname: form.nickname.trim(),
      email: form.email.trim(),
      password: form.password,
    })
    finishAuth()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '注册失败'),
      icon: 'none',
    })
  }
  finally {
    submitting.value = false
  }
}

function toLogin() {
  const url = redirectUrl.value
    ? `${LOGIN_PAGE}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : LOGIN_PAGE
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="native-page native-page--auth">
    <view class="auth-head">
      <view class="page-title">
        注册
      </view>
      <view class="page-subtitle">
        创建账号后将直接登录当前设备。
      </view>
    </view>

    <view class="form-sheet">
      <view class="form-item">
        <view class="form-label">
          用户名
        </view>
        <input v-model="form.username" class="form-input" placeholder="请输入用户名" confirm-type="next" />
      </view>
      <view class="form-item">
        <view class="form-label">
          昵称
        </view>
        <input v-model="form.nickname" class="form-input" placeholder="请输入昵称" confirm-type="next" />
      </view>
      <view class="form-item">
        <view class="form-label">
          邮箱
        </view>
        <input v-model="form.email" class="form-input" placeholder="请输入邮箱" confirm-type="next" />
      </view>
      <view class="form-item">
        <view class="form-label">
          密码
        </view>
        <input
          v-model="form.password"
          class="form-input"
          password
          placeholder="请设置密码"
          confirm-type="done"
          @confirm="submit"
        />
      </view>
    </view>

    <button class="primary-action auth-action" :loading="submitting" @click="submit">
      注册
    </button>

    <view class="auth-footer">
      <text class="auth-footer__text">已有账号？</text>
      <text class="auth-footer__link" @click="toLogin">去登录</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auth-head {
  padding-top: 24rpx;
}

.auth-action {
  margin-top: 48rpx;
}

.auth-footer {
  margin-top: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: 26rpx;
  line-height: 1.5;
}

.auth-footer__text {
  color: #8b8f97;
}

.auth-footer__link {
  color: #111827;
  font-weight: 500;
}
</style>
