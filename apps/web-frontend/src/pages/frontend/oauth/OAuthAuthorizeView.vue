<template>
  <div class="frontend-page oauth-authorize-page">
    <section v-if="loading" class="frontend-card oauth-authorize-page__status">
      <p class="frontend-card__eyebrow">OAuth 授权</p>
      <h2>正在加载授权信息</h2>
      <p>请稍候，系统正在准备应用与权限范围。</p>
    </section>

    <section v-else-if="loadError" class="frontend-card oauth-authorize-page__status is-error">
      <p class="frontend-card__eyebrow">授权失败</p>
      <h2>无法继续授权</h2>
      <p>{{ loadError }}</p>
      <div class="oauth-authorize-page__actions">
        <RouterLink class="frontend-page__button is-secondary" to="/oauth/error?error=invalid_request">查看错误详情</RouterLink>
      </div>
    </section>

    <template v-else-if="session">
      <section class="frontend-page__hero oauth-authorize-page__hero">
        <p class="frontend-page__eyebrow">第三方应用申请访问</p>
        <h1>{{ session.application.name }}</h1>
        <p>
          {{ session.application.description || '该应用正在请求访问你的账号信息和授权范围。' }}
        </p>
      </section>

      <section class="frontend-card oauth-authorize-page__card">
        <p class="frontend-card__eyebrow">当前账号</p>
        <h3>{{ session.user.nickname }}（{{ session.user.username }}）</h3>
        <p>会话有效期至：{{ expiresAtText }}</p>
      </section>

      <section class="frontend-card oauth-authorize-page__card">
        <p class="frontend-card__eyebrow">授权范围</p>
        <ul class="oauth-authorize-page__scope-list">
          <li v-for="scope in session.scopes" :key="scope.code" class="oauth-authorize-page__scope-item">
            <strong>{{ scope.name }}</strong>
            <span>{{ scope.description }}</span>
          </li>
        </ul>
      </section>

      <section class="frontend-card oauth-authorize-page__actions-panel">
        <p>你可以拒绝或同意，系统会返回到发起授权的应用。</p>
        <div class="oauth-authorize-page__actions">
          <button
            class="frontend-page__button is-secondary"
            type="button"
            :disabled="submitting"
            @click="submitDecision('deny')"
          >
            拒绝
          </button>
          <button
            class="frontend-page__button is-primary"
            type="button"
            :disabled="submitting"
            @click="submitDecision('approve')"
          >
            {{ submitting ? '处理中...' : '同意并继续' }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { OAuthAuthorizeDecision, OAuthAuthorizeSessionView } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const submitting = ref(false);
const loadError = ref('');
const session = ref<OAuthAuthorizeSessionView | null>(null);

const sessionState = computed(() =>
  typeof route.query.session_state === 'string' ? route.query.session_state.trim() : '',
);

const expiresAtText = computed(() => {
  if (!session.value?.expiresAt) {
    return '-';
  }

  const date = new Date(session.value.expiresAt);
  if (Number.isNaN(date.getTime())) {
    return session.value.expiresAt;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
});

const navigateToLogin = () => {
  const returnTo = encodeURIComponent(window.location.href);
  window.location.assign(`/login?returnTo=${returnTo}`);
};

const navigateToError = (error: string, description: string) => {
  router.replace({
    name: 'frontend-oauth-error',
    query: {
      error,
      error_description: description,
    },
  });
};

const loadSession = async () => {
  if (!sessionState.value) {
    navigateToError('invalid_request', 'missing session_state');
    return;
  }

  try {
    loading.value = true;
    loadError.value = '';
    session.value = await api.oauth.authorizeSessions.detail(sessionState.value);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null
      ? Reflect.get(error, 'status')
      : undefined;

    if (status === 401) {
      navigateToLogin();
      return;
    }

    loadError.value = getErrorMessage(error, '加载授权会话失败');
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
};

const submitDecision = async (decision: OAuthAuthorizeDecision) => {
  if (!sessionState.value) {
    navigateToError('invalid_request', 'missing session_state');
    return;
  }

  try {
    submitting.value = true;
    const result = await api.oauth.authorizeSessions.decide(sessionState.value, decision);
    window.location.assign(result.redirectUrl);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null
      ? Reflect.get(error, 'status')
      : undefined;

    if (status === 401) {
      navigateToLogin();
      return;
    }

    const message = getErrorMessage(error, '提交授权决策失败');
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await loadSession();
});
</script>

<style scoped lang="scss">
.oauth-authorize-page {
  padding-bottom: 24px;
}

.oauth-authorize-page__hero h1 {
  margin: 0;
}

.oauth-authorize-page__status,
.oauth-authorize-page__card,
.oauth-authorize-page__actions-panel {
  gap: 10px;
}

.oauth-authorize-page__status h2,
.oauth-authorize-page__card h3 {
  margin: 0;
}

.oauth-authorize-page__status.is-error {
  border-color: rgba(169, 67, 50, 0.22);
  background: rgba(255, 244, 242, 0.88);
}

.oauth-authorize-page__scope-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.oauth-authorize-page__scope-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(39, 61, 77, 0.1);
  background: rgba(255, 255, 255, 0.7);
}

.oauth-authorize-page__scope-item strong {
  font-size: 14px;
}

.oauth-authorize-page__scope-item span {
  color: #5b6a72;
  line-height: 1.6;
}

.oauth-authorize-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .oauth-authorize-page {
    gap: 16px;
  }

  .oauth-authorize-page__actions {
    flex-direction: column;
  }

  .oauth-authorize-page__actions :deep(.frontend-page__button) {
    width: 100%;
  }
}
</style>
