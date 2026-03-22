<script lang="ts" setup>
import { reactive, ref } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import { REGISTER_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationStyle: 'custom',
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
  <AppPageShell auth title="登录" description="使用账号和密码进入系统。">
    <view class="app-auth-sheet">
      <view class="app-auth-form">
        <wd-input
          v-model="form.account"
          label="账号"
          clearable
          placeholder="用户名或邮箱"
          confirm-type="next"
          custom-class="app-auth-input"
        />
        <wd-input
          v-model="form.password"
          label="密码"
          show-password
          placeholder="请输入密码"
          confirm-type="done"
          custom-class="app-auth-input"
          @confirm="doLogin"
        />
      </view>

      <wd-button block size="large" :loading="submitting" custom-class="app-auth-submit" @click="doLogin">
        登录
      </wd-button>

      <view class="app-inline-action">
        <text class="app-inline-action__label">没有账号？</text>
        <text class="app-inline-action__link" @click="toRegister">去注册</text>
      </view>
    </view>
  </AppPageShell>
</template>
