<script lang="ts" setup>
import { reactive, ref } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import { LOGIN_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationStyle: 'custom',
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
  <AppPageShell auth title="注册" description="创建账号后将直接登录当前设备。">
    <view class="app-auth-sheet">
      <view class="app-auth-form">
        <wd-input v-model="form.username" label="用户名" clearable placeholder="请输入用户名" custom-class="app-auth-input" />
        <wd-input v-model="form.nickname" label="昵称" clearable placeholder="请输入昵称" custom-class="app-auth-input" />
        <wd-input v-model="form.email" label="邮箱" clearable placeholder="请输入邮箱" custom-class="app-auth-input" />
        <wd-input
          v-model="form.password"
          label="密码"
          show-password
          placeholder="请设置密码"
          confirm-type="done"
          custom-class="app-auth-input"
          @confirm="submit"
        />
      </view>

      <wd-button block size="large" :loading="submitting" custom-class="app-auth-submit" @click="submit">
        注册
      </wd-button>

      <view class="app-inline-action">
        <text class="app-inline-action__label">已有账号？</text>
        <text class="app-inline-action__link" @click="toLogin">去登录</text>
      </view>
    </view>
  </AppPageShell>
</template>
