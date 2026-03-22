<template>
  <el-form label-position="top" class="page-form-grid auth-form-grid" @submit.prevent="emit('submit')">
    <div class="auth-form-header page-form-grid__full">
      <div>
        <span class="auth-form-header__eyebrow">当前方式</span>
        <strong>{{ strategy.name }}</strong>
      </div>
      <p>{{ resolveMethodHelper(strategy) }}</p>
    </div>

    <el-form-item :label="resolveIdentifierLabel(strategy)" class="page-form-grid__full">
      <el-input
        v-model="form.identifier"
        :placeholder="resolveIdentifierPlaceholder(strategy)"
      />
    </el-form-item>

    <el-form-item v-if="strategy.credentialType === 'PASSWORD'" label="密码" class="page-form-grid__full">
      <el-input v-model="form.password" show-password placeholder="请输入密码" />
    </el-form-item>

    <el-form-item v-else label="验证码" class="page-form-grid__full">
      <el-input v-model="form.code" placeholder="请输入收到的验证码">
        <template #append>
          <el-button :loading="sendingCode" @click="emit('send-code')">发送验证码</el-button>
        </template>
      </el-input>
    </el-form-item>

    <div v-if="strategy.credentialType === 'VERIFICATION_CODE'" class="auth-form-note page-form-grid__full">
      {{ resolveVerificationHint(strategy) }}
    </div>

    <el-button type="primary" class="auth-form-submit page-form-grid__full" :loading="submitting" @click="emit('submit')">
      登录控制台
    </el-button>
  </el-form>
</template>

<script setup lang="ts">
import type { AuthStrategyDescriptor } from '@rbac/api-common';

defineProps<{
  strategy: AuthStrategyDescriptor;
  submitting: boolean;
  sendingCode: boolean;
  form: {
    identifier: string;
    password: string;
    code: string;
    username: string;
    nickname: string;
    email: string;
  };
}>();

const emit = defineEmits<{
  submit: [];
  'send-code': [];
}>();

const resolveIdentifierLabel = (strategy: AuthStrategyDescriptor) => {
  if (strategy.identifierType === 'EMAIL') {
    return '邮箱';
  }

  if (strategy.identifierType === 'PHONE') {
    return '手机号';
  }

  return '用户名';
};

const resolveIdentifierPlaceholder = (strategy: AuthStrategyDescriptor) => {
  if (strategy.identifierType === 'EMAIL') {
    return '请输入邮箱地址';
  }

  if (strategy.identifierType === 'PHONE') {
    return '请输入手机号';
  }

  return '请输入用户名';
};

const resolveMethodHelper = (strategy: AuthStrategyDescriptor) => {
  if (strategy.credentialType === 'PASSWORD') {
    return '输入账号和密码后即可继续。';
  }

  return '先发送验证码，再完成身份校验。';
};

const resolveVerificationHint = (strategy: AuthStrategyDescriptor) => {
  if (strategy.identifierType === 'EMAIL') {
    return '验证码会发送到填写的邮箱。';
  }

  if (strategy.identifierType === 'PHONE') {
    return '验证码会发送到填写的手机号。';
  }

  return '验证码发送后可直接填写。';
};
</script>

<style scoped lang="scss">
.auth-form-grid {
  margin-top: 0;
  row-gap: 12px;
}

.auth-form-header {
  display: grid;
  gap: 8px;
  padding: 18px 18px 16px;
  border: 1px solid rgba(18, 43, 57, 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(247, 243, 236, 0.8) 0%, rgba(255, 255, 255, 0.96) 100%);
}

.auth-form-header__eyebrow {
  color: #7a847d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.auth-form-header strong {
  color: #17384a;
  font-size: 20px;
  line-height: 1.2;
}

.auth-form-header p,
.auth-form-note {
  color: #607078;
  font-size: 13px;
  line-height: 1.7;
}

.auth-form-note {
  padding: 0 2px;
}

.auth-form-grid :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #42555f;
  font-size: 13px;
  font-weight: 600;
}

.auth-form-grid :deep(.el-input__wrapper) {
  min-height: 50px;
  padding: 0 14px;
  border-radius: 16px;
  background: #f8f3ec;
  box-shadow: 0 0 0 1px rgba(18, 43, 57, 0.08) inset;
}

.auth-form-grid :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #17384a inset;
}

.auth-form-grid :deep(.el-input-group__append) {
  padding: 0 8px;
  border-radius: 0 16px 16px 0;
  background: #f1e9dc;
  box-shadow: none;
}

.auth-form-grid :deep(.el-input-group__append .el-button) {
  min-height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: #17384a;
  color: #f7f3ec;
  box-shadow: none;
}

.auth-form-submit {
  width: 100%;
  min-height: 50px;
  margin-top: 4px;
  border-radius: 18px;
  font-weight: 700;
}
</style>
