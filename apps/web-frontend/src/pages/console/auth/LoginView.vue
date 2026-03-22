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
        <div v-loading="loadingStrategies || processingOauthTicket" class="auth-panel__stack">
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
        <div v-loading="loadingStrategies || processingOauthTicket" class="auth-panel__stack">
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

      <template #footer>
        <AuthOAuthProviders
          v-if="authConfig.oauthProviders.length > 0"
          :providers="authConfig.oauthProviders"
          :loading="processingOauthTicket || loadingStrategies || submitting"
          @select="startOauthLogin"
        />
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
import { useRoute, useRouter } from 'vue-router';
import { api, apiBaseUrl } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import AuthAccessPanel from './components/AuthAccessPanel.vue';
import AuthLoginStrategyForm from './components/AuthLoginStrategyForm.vue';
import AuthOAuthProviders from './components/AuthOAuthProviders.vue';
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
  oauthProviders: [],
});

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tab = ref<AuthPanelTab>('login');
const submitting = ref(false);
const loadingStrategies = ref(false);
const processingOauthTicket = ref(false);
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

const resolveSafeReturnTo = () => {
  const value = typeof route.query.returnTo === 'string' ? route.query.returnTo : '';
  if (!value) {
    return '';
  }

  if (value.startsWith('/')) {
    return value;
  }

  try {
    const currentOrigin = window.location.origin;
    const apiOrigin = new URL(apiBaseUrl).origin;
    const url = new URL(value);
    if ([currentOrigin, apiOrigin].includes(url.origin)) {
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
};

const finishAuthNavigation = async () => {
  const returnTo = resolveSafeReturnTo();
  if (returnTo) {
    window.location.assign(returnTo);
    return;
  }

  await router.push('/console');
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

const handleOauthTicket = async () => {
  const ticket = typeof route.query.oauth_ticket === 'string' ? route.query.oauth_ticket : '';
  if (!ticket) {
    return false;
  }

  try {
    processingOauthTicket.value = true;
    const session = await api.auth.exchangeOauthTicket(ticket);
    auth.setSession(session);
    await finishAuthNavigation();
    return true;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '第三方登录失败'));
    return false;
  } finally {
    processingOauthTicket.value = false;
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
    await finishAuthNavigation();
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
    await finishAuthNavigation();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '注册失败'));
  } finally {
    submitting.value = false;
  }
};

const startOauthLogin = async (providerCode: string) => {
  try {
    const result = await api.auth.oauthAuthorizeUrl(providerCode, resolveSafeReturnTo() || '/console');
    window.location.assign(result.redirectUrl);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '拉起第三方登录失败'));
  }
};

onMounted(async () => {
  if (await handleOauthTicket()) {
    return;
  }

  await loadStrategies();
});
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
