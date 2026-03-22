<template>
  <PageScaffold :stats="stats">
    <template #toolbar>
      <ExplorerToolbar
        :selected-user-id="pageState.selectedUserId"
        :user-options="displayedUserOptions"
        :loading="userLoading"
        :total="userTotal"
        :page="pageState.userPage"
        :page-size="userPageSize"
        @change="handleUserChange"
        @refresh-users="loadUsers(true)"
        @reload-source="loadSource()"
        @search="handleUserSearch"
        @page-change="changeUserPage"
      />
    </template>

    <ExplorerSourcePanel
      :loading="loading"
      :source="source"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UserPermissionSource, UserRecord } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import ExplorerSourcePanel from './components/ExplorerSourcePanel.vue';
import ExplorerToolbar from './components/ExplorerToolbar.vue';

defineOptions({ name: 'ExplorerView' });

definePage({
  viewKey: 'explorer',
  keepAlive: true,
});

type ExplorerPageState = {
  selectedUserId: string;
  userKeyword: string;
  userPage: number;
};

const userPageSize = 12;
const userOptions = ref<UserRecord[]>([]);
const userOptionCache = ref<Record<string, UserRecord>>({});
const userTotal = ref(0);
const userLoading = ref(false);
const source = ref<UserPermissionSource | null>(null);
const loading = ref(false);
const { state: pageState } = usePageState<ExplorerPageState>('page:explorer', {
  selectedUserId: '',
  userKeyword: '',
  userPage: 1,
});

const displayedUserOptions = computed(() => {
  const selected = pageState.selectedUserId ? userOptionCache.value[pageState.selectedUserId] : undefined;
  if (!selected || userOptions.value.some((item) => item.id === selected.id)) {
    return userOptions.value;
  }
  return [selected, ...userOptions.value];
});

const stats = computed(() => [
  { label: '用户目录', value: userTotal.value },
  { label: '角色来源', value: source.value?.groups.length ?? 0 },
  { label: '生效权限', value: source.value?.effectivePermissions.length ?? 0 },
  { label: '当前用户', value: source.value?.user.nickname ?? '未选择' },
]);

const rememberUsers = (items: UserRecord[]) => {
  userOptionCache.value = items.reduce<Record<string, UserRecord>>((result, item) => {
    result[item.id] = item;
    return result;
  }, { ...userOptionCache.value });
};

const loadUsers = async (syncSource = false) => {
  try {
    userLoading.value = true;
    const response = await api.users.list({
      page: pageState.userPage,
      pageSize: userPageSize,
      q: pageState.userKeyword || undefined,
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / userPageSize), 1);
    if (pageState.userPage > totalPages) {
      pageState.userPage = totalPages;
      await loadUsers(syncSource);
      return;
    }

    userOptions.value = response.items;
    userTotal.value = response.meta.total;
    rememberUsers(response.items);

    if (!pageState.selectedUserId) {
      const fallback = response.items[0]?.id ?? '';
      pageState.selectedUserId = fallback;
      if (fallback) {
        await loadSource(fallback);
        return;
      }
      source.value = null;
      return;
    }

    if (syncSource) {
      const loaded = await loadSource(pageState.selectedUserId);
      if (!loaded) {
        const fallback = response.items[0]?.id ?? '';
        pageState.selectedUserId = fallback;
        if (fallback) {
          await loadSource(fallback);
          return;
        }
        source.value = null;
      }
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载用户列表失败'));
  } finally {
    userLoading.value = false;
  }
};

const loadSource = async (id = pageState.selectedUserId) => {
  if (!id) {
    source.value = null;
    return false;
  }

  try {
    loading.value = true;
    const response = await api.users.permissionSources(id);
    source.value = response;
    rememberUsers([response.user]);
    return true;
  } catch (error: unknown) {
    source.value = null;
    if (typeof error === 'object' && error !== null && Reflect.get(error, 'status') === 404) {
      const nextCache = { ...userOptionCache.value };
      delete nextCache[id];
      userOptionCache.value = nextCache;
      return false;
    }
    ElMessage.error(getErrorMessage(error, '加载权限来源失败'));
    return false;
  } finally {
    loading.value = false;
  }
};

const handleUserChange = async (id?: string) => {
  pageState.selectedUserId = id ?? '';
  await loadSource(pageState.selectedUserId);
};

const handleUserSearch = async (keyword: string) => {
  const normalizedKeyword = keyword.trim();
  if (normalizedKeyword === pageState.userKeyword && pageState.userPage === 1) {
    return;
  }

  pageState.userKeyword = normalizedKeyword;
  pageState.userPage = 1;
  await loadUsers();
};

const changeUserPage = async (value: number) => {
  if (value === pageState.userPage) {
    return;
  }

  pageState.userPage = value;
  await loadUsers();
};

onMounted(async () => {
  await loadUsers(true);
});
</script>
