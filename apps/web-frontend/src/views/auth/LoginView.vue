<template>
  <div class="auth-layout">
    <section class="auth-showcase">
      <p class="hero-label">Enterprise RBAC Console</p>
      <h1>把认证方式做成后端策略，而不是把登录页写死成一种表单。</h1>
      <p class="auth-copy">
        登录、注册、验证码发送与校验都由后端认证策略驱动。当前启用了用户名密码、邮箱验证码、手机号验证码三种基础方式，
        前端会按后端开启状态动态渲染可用组件。
      </p>

      <div class="auth-highlight-grid">
        <article class="auth-highlight">
          <span>USERNAME PASSWORD</span>
          <strong>admin / Admin123!</strong>
          <small>管理员账号，支持直接口令登录</small>
        </article>
        <article class="auth-highlight">
          <span>MOCK CODE</span>
          <strong>邮箱 123456 / 手机 654321</strong>
          <small>发送验证码后会返回 mock 回执，便于联调</small>
        </article>
      </div>
    </section>

    <section class="auth-panel">
      <p class="panel-caption">Access Portal</p>
      <h2 class="panel-heading panel-heading--xl">登录与注册</h2>

      <el-tabs v-model="tab">
        <el-tab-pane label="登录" name="login">
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
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
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
        </el-tab-pane>
      </el-tabs>
    </section>
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
import AuthLoginStrategyForm from './components/AuthLoginStrategyForm.vue';
import AuthRegisterStrategyForm from './components/AuthRegisterStrategyForm.vue';
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
    await router.push('/dashboard');
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
    await router.push('/dashboard');
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
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.68), transparent 38%),
    linear-gradient(150deg, #f4ebdc 0%, #e7efe6 47%, #dbe7f1 100%);
}

.auth-showcase {
  display: grid;
  align-content: center;
  gap: 24px;
  padding: 64px 72px;
}

.hero-label {
  margin: 0;
  color: #607581;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.auth-showcase h1 {
  max-width: 720px;
  color: #17384a;
  font-size: clamp(36px, 4vw, 58px);
  line-height: 1.05;
}

.auth-copy {
  max-width: 620px;
  margin: 0;
  color: #4e6572;
  font-size: 16px;
  line-height: 1.8;
}

.auth-highlight-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.auth-highlight {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: 0 24px 56px rgba(17, 33, 45, 0.08);
  backdrop-filter: blur(18px);
}

.auth-highlight span {
  color: #607581;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.auth-highlight strong {
  color: #17384a;
  font-size: 20px;
}

.auth-highlight small {
  color: #607581;
  font-size: 13px;
  line-height: 1.7;
}

.auth-panel {
  display: grid;
  align-content: center;
  gap: 12px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.44);
  backdrop-filter: blur(20px);
}

.auth-panel__stack {
  display: grid;
  gap: 18px;
  min-height: 420px;
  padding-top: 12px;
}

@media (max-width: 1120px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }

  .auth-showcase,
  .auth-panel {
    padding: 32px 24px;
  }

  .auth-highlight-grid {
    grid-template-columns: 1fr;
  }
}
</style>
