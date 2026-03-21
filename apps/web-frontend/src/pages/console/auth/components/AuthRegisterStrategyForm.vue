<template>
  <el-form label-position="top" class="page-form-grid auth-form-grid" @submit.prevent="emit('submit')">
    <div class="auth-form-banner page-form-grid__full">
      <span class="auth-form-banner__eyebrow">{{ strategy.name }}</span>
      <strong>{{ strategy.credentialType === 'PASSWORD' ? '创建成员并设置主认证凭据' : '完成验证码校验后自动入场' }}</strong>
      <small>注册完成后会直接生成会话并进入控制台。</small>
    </div>

    <el-form-item label="用户名">
      <el-input v-model="form.username" placeholder="后续在系统内展示的唯一用户名" />
    </el-form-item>

    <el-form-item label="昵称">
      <el-input v-model="form.nickname" placeholder="团队内显示名称" />
    </el-form-item>

    <el-form-item
      v-if="strategy.identifierType !== 'USERNAME'"
      :label="resolveIdentifierLabel(strategy)"
      class="page-form-grid__full"
    >
      <el-input v-model="form.identifier" :placeholder="resolveIdentifierPlaceholder(strategy)">
        <template v-if="strategy.credentialType === 'VERIFICATION_CODE'" #append>
          <el-button :loading="sendingCode" @click="emit('send-code')">发送验证码</el-button>
        </template>
      </el-input>
    </el-form-item>

    <el-form-item v-if="strategy.identifierType === 'USERNAME'" label="联系邮箱" class="page-form-grid__full">
      <el-input v-model="form.email" placeholder="可选，用于补充资料" />
    </el-form-item>

    <el-form-item v-if="strategy.credentialType === 'PASSWORD'" label="密码" class="page-form-grid__full">
      <el-input v-model="form.password" show-password placeholder="请输入密码" />
    </el-form-item>

    <el-form-item v-else label="验证码" class="page-form-grid__full">
      <el-input v-model="form.code" placeholder="请输入收到的验证码" />
    </el-form-item>

    <div v-if="form.mockCode || form.expiresAt" class="auth-form-hint page-form-grid__full">
      <strong>Mock 回执</strong>
      <span v-if="form.mockCode">当前验证码：{{ form.mockCode }}</span>
      <span v-if="form.expiresAt">有效期至：{{ formatTime(form.expiresAt) }}</span>
    </div>

    <el-button type="primary" class="auth-form-submit page-form-grid__full" :loading="submitting" @click="emit('submit')">
      创建成员并登录
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
  margin-top: 2px;
}

.auth-form-banner {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid rgba(18, 43, 57, 0.08);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(247, 243, 236, 0.72) 0%, rgba(255, 255, 255, 0.9) 100%);
}

.auth-form-banner__eyebrow {
  color: #7a847d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.auth-form-banner strong {
  color: #17384a;
  font-size: 16px;
}

.auth-form-banner small {
  color: #607078;
  font-size: 12px;
  line-height: 1.6;
}

.auth-form-hint {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border: 1px dashed rgba(23, 56, 74, 0.22);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(248, 251, 253, 0.98) 0%, rgba(239, 245, 248, 0.98) 100%);
  color: #4f626d;
  font-size: 12px;
}

.auth-form-hint strong {
  color: #17384a;
  font-size: 13px;
}

.auth-form-submit {
  width: 100%;
  min-height: 46px;
  margin-top: 2px;
  border-radius: 16px;
}
</style>
