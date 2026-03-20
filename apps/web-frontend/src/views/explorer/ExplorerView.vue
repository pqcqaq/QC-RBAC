<template>
  <PageScaffold :stats="stats">
    <template #toolbar>
      <el-form label-position="top" class="page-toolbar">
        <el-form-item label="目标用户" class="page-toolbar__field page-toolbar__field--wide">
          <el-select
            v-model="pageState.selectedUserId"
            filterable
            clearable
            placeholder="选择用户"
            @change="handleUserChange"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="`${user.nickname} (${user.email})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>

        <div class="page-toolbar__actions">
          <el-button @click="loadUsers">刷新用户</el-button>
          <el-button type="primary" plain :disabled="!pageState.selectedUserId" @click="loadSource()">
            重新分析
          </el-button>
        </div>
      </el-form>
    </template>

    <SurfacePanel caption="Traceability" title="权限来源分析" description="按用户拆解实际生效权限，直接看到每个权限是通过哪个角色继承而来。">
      <div v-if="loading" class="surface-panel__placeholder">
        <el-skeleton :rows="6" animated />
      </div>

      <div v-else-if="source" class="panel-grid">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Effective Set</p>
              <h3 class="panel-heading panel-heading--lg">{{ source.user.nickname }}</h3>
              <p class="muted">{{ source.user.email }}</p>
            </div>
            <el-tag round>{{ source.effectivePermissions.length }} 项权限</el-tag>
          </div>

          <div class="detail-chip-list">
            <span v-for="permission in source.effectivePermissions" :key="permission.id" class="permission-tag">
              {{ permission.code }}
            </span>
          </div>
        </section>

        <div class="dual-grid">
          <article v-for="group in source.groups" :key="group.role.id" class="permission-cluster">
            <header>
              <div>
                <strong>{{ group.role.name }}</strong>
                <div class="muted">{{ group.role.description || '该角色未填写描述。' }}</div>
              </div>
              <span class="role-pill">{{ group.permissions.length }} 项</span>
            </header>
            <div class="tag-list">
              <span v-for="permission in group.permissions" :key="permission.id" class="permission-tag">
                {{ permission.code }}
              </span>
            </div>
          </article>
        </div>
      </div>

      <el-empty v-else description="请选择一个用户查看权限来源" />
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UserPermissionSource, UserRecord } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';

defineOptions({ name: 'ExplorerView' });

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
    }
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载用户列表失败');
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
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载权限来源失败');
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
