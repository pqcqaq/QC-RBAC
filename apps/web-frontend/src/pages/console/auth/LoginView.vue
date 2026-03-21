<template>
  <div class="auth-layout">
    <AuthShowcasePanel :capability-items="capabilityItems" :credential-items="credentialItems" />

    <AuthAccessPanel :tab="tab" @update:tab="tab = $event">
      <template #login>
        <div v-loading="loadingStrategies" class="auth-panel__stack">
          <AuthStrategySelector
            v-model="selectedLoginStrategyCode"
            :strategies="authConfig.loginStrategies"
            empty-text="当前没有可用登录策略"
          />

          <AuthLoginStrategyForm
            v-if="selectedLoginStrategy"
            :strategy="selectedLoginStrategy"
            :form="loginForms[selectedLoginStrategy.code]"
            :submitting="submitting"
            :sending-code="Boolean(sendingCodes[`LOGIN:${selectedLoginStrategy.code}`])"
            @submit="submitLogin"
            @send-code="sendVerificationCode('LOGIN')"
          />
        </div>
      </template>

      <template #register>
        <div v-loading="loadingStrategies" class="auth-panel__stack">
          <AuthStrategySelector
            v-model="selectedRegisterStrategyCode"
            :strategies="authConfig.registerStrategies"
            empty-text="当前没有可用注册策略"
          />

          <AuthRegisterStrategyForm
            v-if="selectedRegisterStrategy"
            :strategy="selectedRegisterStrategy"
            :form="registerForms[selectedRegisterStrategy.code]"
            :submitting="submitting"
            :sending-code="Boolean(sendingCodes[`REGISTER:${selectedRegisterStrategy.code}`])"
            @submit="submitRegister"
            @send-code="sendVerificationCode('REGISTER')"
          />
        </div>
      </template>
    </AuthAccessPanel>
  </div>
</template>

<script setup lang="ts">
import type {
  AuthStrategyCollection,
  AuthStrategyDescriptor,
  AuthVerificationPurpose,
  StrategyLoginPayload,
  StrategyRegisterPayload,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import AuthAccessPanel from './components/AuthAccessPanel.vue';
import AuthLoginStrategyForm from './components/AuthLoginStrategyForm.vue';
import AuthRegisterStrategyForm from './components/AuthRegisterStrategyForm.vue';
import AuthShowcasePanel from './components/AuthShowcasePanel.vue';
import AuthStrategySelector from './components/AuthStrategySelector.vue';

type StrategyFormState = {
  identifier: string;
  password: string;
  code: string;
  username: string;
  nickname: string;
  email: string;
  mockCode: string;
  expiresAt: string;
};

const createEmptyForm = (): StrategyFormState => ({
  identifier: '',
  password: '',
  code: '',
  username: '',
  nickname: '',
  email: '',
  mockCode: '',
  expiresAt: '',
});

const createEmptyConfig = (): AuthStrategyCollection => ({
  strategies: [],
  loginStrategies: [],
  registerStrategies: [],
  verificationStrategies: [],
});

const router = useRouter();
const auth = useAuthStore();
const tab = ref('login');
const submitting = ref(false);
const loadingStrategies = ref(false);
const selectedLoginStrategyCode = ref('');
const selectedRegisterStrategyCode = ref('');
const authConfig = reactive<AuthStrategyCollection>(createEmptyConfig());
const loginForms = reactive<Record<string, StrategyFormState>>({});
const registerForms = reactive<Record<string, StrategyFormState>>({});
const sendingCodes = reactive<Record<string, boolean>>({});
const capabilityItems = [
  {
    eyebrow: 'Identity Strategy',
    title: '同一入口，多种认证方式',
    copy: '用户名密码、邮箱验证码、手机号验证码都走策略模式，不再把登录页和流程耦死。',
  },
  {
    eyebrow: 'Client Security',
    title: '客户端身份纳入校验',
    copy: 'Web 控制台与其他系统级 client 通过 secret 参与认证链路，token 也能追溯登录来源。',
  },
  {
    eyebrow: 'Audit Reliability',
    title: '认证与操作全程可审计',
    copy: '策略、验证码、认证记录和软删除字段共同构成完整追踪面，适合继续向生产演进。',
  },
];
const credentialItems = [
  {
    label: 'Username Password',
    value: 'admin / Admin123!',
    note: '适合直接进入控制台的管理员账号。',
  },
  {
    label: 'Mock Verification',
    value: '邮箱 123456 / 手机 654321',
    note: '验证码发送后会返回 mock 回执，用于本地联调。',
  },
];

const selectedLoginStrategy = computed(() =>
  authConfig.loginStrategies.find((item) => item.code === selectedLoginStrategyCode.value) ?? null,
);
const selectedRegisterStrategy = computed(() =>
  authConfig.registerStrategies.find((item) => item.code === selectedRegisterStrategyCode.value) ?? null,
);

const resolveLoginDefaults = (strategy: AuthStrategyDescriptor) => {
  if (strategy.code === 'username-password') {
    return {
      identifier: 'admin',
      password: 'Admin123!',
    };
  }

  if (strategy.code === 'email-code') {
    return {
      identifier: 'admin@example.com',
    };
  }

  if (strategy.code === 'phone-code') {
    return {
      identifier: '13800000000',
    };
  }

  return {};
};

const ensureForms = (strategies: AuthStrategyDescriptor[]) => {
  strategies.forEach((strategy) => {
    loginForms[strategy.code] ??= {
      ...createEmptyForm(),
      ...resolveLoginDefaults(strategy),
    };
    registerForms[strategy.code] ??= createEmptyForm();
  });
};

const resetMockReceipt = (form: StrategyFormState) => {
  form.mockCode = '';
  form.expiresAt = '';
};

const loadStrategies = async () => {
  try {
    loadingStrategies.value = true;
    const payload = await api.auth.strategies();
    Object.assign(authConfig, payload);
    ensureForms(payload.strategies);
    selectedLoginStrategyCode.value = payload.loginStrategies[0]?.code ?? '';
    selectedRegisterStrategyCode.value = payload.registerStrategies[0]?.code ?? '';
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载认证策略失败'));
  } finally {
    loadingStrategies.value = false;
  }
};

const sendVerificationCode = async (purpose: AuthVerificationPurpose) => {
  const strategy = purpose === 'LOGIN' ? selectedLoginStrategy.value : selectedRegisterStrategy.value;
  if (!strategy) {
    return;
  }

  const form = purpose === 'LOGIN'
    ? loginForms[strategy.code]
    : registerForms[strategy.code];
  if (!form.identifier.trim()) {
    ElMessage.warning('请先填写标识符');
    return;
  }

  const sendingKey = `${purpose}:${strategy.code}`;

  try {
    sendingCodes[sendingKey] = true;
    const result = await api.auth.sendVerificationCode({
      strategyCode: strategy.code,
      identifier: form.identifier,
      purpose,
    });
    form.expiresAt = result.expiresAt;
    form.mockCode = result.mockCode ?? '';
    ElMessage.success(result.mockCode ? `验证码已发送，Mock 验证码：${result.mockCode}` : '验证码已发送');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发送验证码失败'));
  } finally {
    sendingCodes[sendingKey] = false;
  }
};

const submitLogin = async () => {
  const strategy = selectedLoginStrategy.value;
  if (!strategy) {
    return;
  }

  const form = loginForms[strategy.code];
  const payload: StrategyLoginPayload = {
    strategyCode: strategy.code,
    identifier: form.identifier,
    ...(strategy.credentialType === 'PASSWORD'
      ? { password: form.password }
      : { code: form.code }),
  };

  try {
    submitting.value = true;
    await auth.login(payload);
    resetMockReceipt(form);
    ElMessage.success('登录成功');
    await router.push('/console');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '登录失败'));
  } finally {
    submitting.value = false;
  }
};

const submitRegister = async () => {
  const strategy = selectedRegisterStrategy.value;
  if (!strategy) {
    return;
  }

  const form = registerForms[strategy.code];
  const payload: StrategyRegisterPayload = {
    strategyCode: strategy.code,
    identifier: strategy.identifierType === 'USERNAME' ? form.username : form.identifier,
    username: form.username,
    nickname: form.nickname,
    ...(strategy.credentialType === 'PASSWORD'
      ? { password: form.password }
      : { code: form.code }),
    ...(strategy.identifierType === 'USERNAME' && form.email.trim()
      ? { email: form.email.trim() }
      : {}),
  };

  try {
    submitting.value = true;
    await auth.register(payload);
    resetMockReceipt(form);
    ElMessage.success('注册成功');
    await router.push('/console');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '注册失败'));
  } finally {
    submitting.value = false;
  }
};

onMounted(loadStrategies);
</script>

<style scoped lang="scss">
.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(480px, 0.82fr);
}

.auth-panel__stack {
  display: grid;
  gap: 18px;
  min-height: 430px;
}

@media (max-width: 1120px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }
}
</style>
