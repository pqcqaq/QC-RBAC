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

    <div v-if="form.mockCode || form.expiresAt" class="auth-form-hint page-form-grid__full">
      <strong>Mock 回执</strong>
      <span v-if="form.mockCode">当前验证码：{{ form.mockCode }}</span>
      <span v-if="form.expiresAt">有效期至：{{ formatTime(form.expiresAt) }}</span>
    </div>

    <el-button type="primary" class="auth-form-submit page-form-grid__full" :loading="submitting" @click="emit('submit')">
      进入系统
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
    mockCode: string;
    expiresAt: string;
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

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>

<style scoped lang="scss">
.auth-form-grid {
  margin-top: 18px;
}

.auth-form-hint {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px dashed color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  border-radius: 16px;
  background: color-mix(in srgb, white 90%, var(--accent) 7%);
  color: var(--ink-2);
  font-size: 12px;
}

.auth-form-hint strong {
  color: var(--ink-1);
  font-size: 13px;
}

.auth-form-submit {
  width: 100%;
}
</style>
