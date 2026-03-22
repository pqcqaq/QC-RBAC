<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { REGISTER_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '登录',
  },
})

const tokenStore = useTokenStore()
const redirectUrl = ref('')
const submitting = ref(false)
const form = reactive({
  account: '',
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

async function doLogin() {
  if (submitting.value) {
    return
  }
  if (tokenStore.hasLogin) {
    finishAuth()
    return
  }
  if (!form.account.trim() || !form.password) {
    uni.showToast({
      title: '请输入账号和密码',
      icon: 'none',
    })
    return
  }

  submitting.value = true
  try {
    await tokenStore.login({
      account: form.account.trim(),
      password: form.password,
    })
    finishAuth()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '登录失败'),
      icon: 'none',
    })
  }
  finally {
    submitting.value = false
  }
}

function toRegister() {
  const url = redirectUrl.value
    ? `${REGISTER_PAGE}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : REGISTER_PAGE
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="native-page native-page--auth">
    <view class="auth-head">
      <view class="page-title">
        登录
      </view>
      <view class="page-subtitle">
        使用账号密码进入系统。
      </view>
    </view>

    <view class="form-sheet">
      <view class="form-item">
        <view class="form-label">
          账号
        </view>
        <input
          v-model="form.account"
          class="form-input"
          placeholder="用户名或邮箱"
          confirm-type="next"
        />
      </view>
      <view class="form-item">
        <view class="form-label">
          密码
        </view>
        <input
          v-model="form.password"
          class="form-input"
          password
          placeholder="请输入密码"
          confirm-type="done"
          @confirm="doLogin"
        />
      </view>
    </view>

    <button class="primary-action auth-action" :loading="submitting" @click="doLogin">
      登录
    </button>

    <view class="auth-footer">
      <text class="auth-footer__text">没有账号？</text>
      <text class="auth-footer__link" @click="toRegister">去注册</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auth-head {
  padding-top: 48rpx;
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
