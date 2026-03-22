<template>
  <div class="auth-layout">
    <AuthShowcasePanel :capability-items="capabilityItems" />

    <AuthAccessPanel
      :tab="tab"
      :can-switch-to-login="hasLoginStrategies"
      :can-switch-to-register="hasRegisterStrategies"
      @update:tab="onTabChange"
    >
      <template #login>
        <div v-loading="loadingStrategies" class="auth-panel__stack">
          <AuthStrategySelector
            v-model="selectedLoginStrategyCode"
            label="登录方式"
            :strategies="authConfig.loginStrategies"
            empty-text="当前没有可用登录方式"
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
            label="注册方式"
            :strategies="authConfig.registerStrategies"
            empty-text="当前没有可用注册方式"
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

type AuthPanelTab = 'login' | 'register';

type StrategyFormState = {
  identifier: string;
  password: string;
  code: string;
  username: string;
  nickname: string;
  email: string;
};

const createEmptyForm = (): StrategyFormState => ({
  identifier: '',
  password: '',
  code: '',
  username: '',
  nickname: '',
  email: '',
});

const createEmptyConfig = (): AuthStrategyCollection => ({
  strategies: [],
  loginStrategies: [],
  registerStrategies: [],
  verificationStrategies: [],
});

const router = useRouter();
const auth = useAuthStore();
const tab = ref<AuthPanelTab>('login');
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
    title: '统一入口',
    copy: '一个入口完成登录、注册与身份校验。',
  },
  {
    title: '按权限进入',
    copy: '登录后只展示当前角色可用的页面和操作。',
  },
  {
    title: '管理清晰',
    copy: '用户、角色、权限和菜单都在同一控制台完成管理。',
  },
];

const hasLoginStrategies = computed(() => authConfig.loginStrategies.length > 0);
const hasRegisterStrategies = computed(() => authConfig.registerStrategies.length > 0);
const selectedLoginStrategy = computed(() =>
  authConfig.loginStrategies.find((item) => item.code === selectedLoginStrategyCode.value) ?? null,
);
const selectedRegisterStrategy = computed(() =>
  authConfig.registerStrategies.find((item) => item.code === selectedRegisterStrategyCode.value) ?? null,
);

const ensureForms = (strategies: AuthStrategyDescriptor[]) => {
  strategies.forEach((strategy) => {
    loginForms[strategy.code] ??= createEmptyForm();
    registerForms[strategy.code] ??= createEmptyForm();
  });
};

const isAuthPanelTab = (value: string): value is AuthPanelTab => value === 'login' || value === 'register';

const onTabChange = (value: string) => {
  if (isAuthPanelTab(value)) {
    tab.value = value;
  }
};

const syncActiveTab = () => {
  if (tab.value === 'login' && !hasLoginStrategies.value && hasRegisterStrategies.value) {
    tab.value = 'register';
    return;
  }

  if (tab.value === 'register' && !hasRegisterStrategies.value && hasLoginStrategies.value) {
    tab.value = 'login';
  }
};

const loadStrategies = async () => {
  try {
    loadingStrategies.value = true;
    const payload = await api.auth.strategies();
    Object.assign(authConfig, payload);
    ensureForms(payload.strategies);
    selectedLoginStrategyCode.value = payload.loginStrategies[0]?.code ?? '';
    selectedRegisterStrategyCode.value = payload.registerStrategies[0]?.code ?? '';
    syncActiveTab();
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

    if (import.meta.env.DEV && result.mockCode) {
      console.info(`[auth-code:${purpose}:${strategy.code}]`, result.mockCode, result.expiresAt);
    }

    ElMessage.success('验证码已发送');
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
  grid-template-columns: minmax(0, 1.08fr) minmax(460px, 0.92fr);
}

.auth-panel__stack {
  display: grid;
  gap: 18px;
}

@media (max-width: 1120px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }

  .auth-layout :deep(.auth-access-panel) {
    order: -1;
  }
}
</style>

