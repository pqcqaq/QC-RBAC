<template>
  <PageScaffold :stats="stats">
    <template #toolbar>
      <ExplorerToolbar
        :selected-user-id="pageState.selectedUserId"
        :user-options="userOptions"
        @change="handleUserChange"
        @refresh-users="loadUsers"
        @reload-source="loadSource()"
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

const userOptions = ref<UserRecord[]>([]);
const source = ref<UserPermissionSource | null>(null);
const loading = ref(false);
const { state: pageState } = usePageState<{ selectedUserId: string }>('page:explorer', {
  selectedUserId: '',
});

const stats = computed(() => [
  { label: '用户目录', value: userOptions.value.length },
  { label: '角色来源', value: source.value?.groups.length ?? 0 },
  { label: '生效权限', value: source.value?.effectivePermissions.length ?? 0 },
  { label: '当前用户', value: source.value?.user.nickname ?? '未选择' },
]);

const loadUsers = async () => {
  try {
    const response = await api.users.list({ page: 1, pageSize: 100 });
    userOptions.value = response.items;

    const current = pageState.selectedUserId;
    const exists = response.items.some((item) => item.id === current);
    const fallback = response.items[0]?.id ?? '';
    pageState.selectedUserId = exists ? current : fallback;

    if (pageState.selectedUserId) {
      await loadSource(pageState.selectedUserId);
      return;
    }

    source.value = null;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载用户列表失败'));
  }
};

const loadSource = async (id = pageState.selectedUserId) => {
  if (!id) {
    source.value = null;
    return;
  }

  try {
    loading.value = true;
    source.value = await api.users.permissionSources(id);
  } catch (error: unknown) {
    source.value = null;
    ElMessage.error(getErrorMessage(error, '加载权限来源失败'));
  } finally {
    loading.value = false;
  }
};

const handleUserChange = async (id?: string) => {
  pageState.selectedUserId = id ?? '';
  await loadSource(pageState.selectedUserId);
};

onMounted(loadUsers);
</script>
