<template>
  <el-form label-position="top" class="page-form-grid auth-form-grid" @submit.prevent="emit('submit')">
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

.auth-form-note {
  padding: 0 2px;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.auth-form-grid :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
}

.auth-form-grid :deep(.el-input__wrapper) {
  min-height: 50px;
  padding: 0 14px;
  border-radius: 16px;
  background: var(--surface-card-soft-bg);
  box-shadow: 0 0 0 1px var(--line-soft) inset;
}

.auth-form-grid :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.auth-form-grid :deep(.el-input-group__append) {
  padding: 0 8px;
  border-radius: 0 16px 16px 0;
  background: var(--surface-card-muted-bg);
  box-shadow: none;
}

.auth-form-grid :deep(.el-input-group__append .el-button) {
  min-height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-contrast);
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


