<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出订阅授权失败" />
        <el-button
          v-permission="'realtime-topic.create'"
          type="primary"
          @click="openCreate"
        >
          新增订阅授权
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <RealtimeTopicsToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <RealtimeTopicsTable
      :topics="topics"
      :loading="loading"
      :seed-count="seedCount"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="topicContextMenuItems"
      @detail="openDetail"
      @edit="handleOpenEdit"
      @delete="removeTopic"
      @page-change="changePage"
    />

    <RealtimeTopicEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑订阅授权' : '新增订阅授权'"
      :is-editing="Boolean(editingId)"
      :form="form"
      @save="saveTopic"
    />

    <RealtimeTopicDetailDrawer
      v-model:visible="detailVisible"
      :topic="detailTopic"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { RealtimeTopicFormPayload, RealtimeTopicRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import {
  useResourceDetail,
  useResourceEditor,
  useResourceRemoval,
} from '@/composables/use-resource-crud';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import RealtimeTopicDetailDrawer from './components/RealtimeTopicDetailDrawer.vue';
import RealtimeTopicEditorDialog from './components/RealtimeTopicEditorDialog.vue';
import RealtimeTopicsTable from './components/RealtimeTopicsTable.vue';
import RealtimeTopicsToolbar from './components/RealtimeTopicsToolbar.vue';
import {
  assignRealtimeTopicEditorForm,
  buildRealtimeTopicClipboardSummary,
  buildRealtimeTopicPayload,
  createEmptyRealtimeTopicEditorForm,
  formatRealtimeTopicPermissionSummary,
  type RealtimeTopicEditorForm,
  validateRealtimeTopicForm,
} from './realtime-topic-management';

defineOptions({ name: 'RealtimeTopicsView' });

definePage({
  viewKey: 'realtimeTopics',
  keepAlive: true,
});

type RealtimeTopicsPageState = {
  filters: {
    q: string;
    sourceType: '' | 'seed' | 'custom';
  };
  page: number;
};

const auth = useAuthStore();
const topics = ref<RealtimeTopicRecord[]>([]);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<RealtimeTopicsPageState>('page:realtime-topics', {
  filters: {
    q: '',
    sourceType: '',
  },
  page: 1,
});

const canEdit = computed(() => auth.hasPermission('realtime-topic.update'));
const canDelete = computed(() => auth.hasPermission('realtime-topic.delete'));
const seedCount = computed(() => topics.value.filter((item) => item.isSystem).length);
const customCount = computed(() => topics.value.length - seedCount.value);
const permissionCount = computed(() => new Set(topics.value.map((item) => item.permissionId)).size);

const stats = computed(() => [
  { label: '绑定总数', value: total.value },
  { label: '当前页系统注册', value: seedCount.value },
  { label: '当前页自定义', value: customCount.value },
  { label: '当前页关联权限', value: permissionCount.value },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  sourceType: pageState.filters.sourceType || undefined,
});

const buildExportRequest = () => api.realtimeTopics.export(buildFilterParams());

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.realtimeTopics.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadData();
      return;
    }

    topics.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载订阅授权失败'));
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.sourceType = '';
  pageState.page = 1;
  await loadData();
};

const {
  dialogVisible,
  editingId,
  form,
  openCreate,
  openEdit,
  save: saveTopic,
} = useResourceEditor<RealtimeTopicRecord, RealtimeTopicEditorForm, RealtimeTopicFormPayload>({
  createEmptyForm: createEmptyRealtimeTopicEditorForm,
  getId: (row) => row.id,
  assignForm: assignRealtimeTopicEditorForm,
  buildPayload: (currentForm) => buildRealtimeTopicPayload(currentForm),
  create: (payload) => api.realtimeTopics.create(payload),
  update: (id, payload) => api.realtimeTopics.update(id, payload),
  validate: (currentForm) => validateRealtimeTopicForm(currentForm),
  afterSaved: loadData,
  messages: {
    createSuccess: '订阅授权已创建',
    updateSuccess: '订阅授权已更新',
    saveError: '保存订阅授权失败',
  },
});

const {
  detailVisible,
  detail: detailTopic,
  openDetail,
} = useResourceDetail<RealtimeTopicRecord, RealtimeTopicRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.realtimeTopics.detail(id),
  errorMessage: '加载订阅授权详情失败',
});

const { removeRecord: removeTopic } = useResourceRemoval<RealtimeTopicRecord>({
  getId: (row) => row.id,
  remove: (id) => api.realtimeTopics.remove(id),
  confirmTitle: '删除订阅授权',
  confirmMessage: (row) => `确定删除订阅授权“${row.name}（${row.topicPattern}）”吗？`,
  successMessage: '订阅授权已删除',
  errorMessage: '删除订阅授权失败',
  afterRemoved: loadData,
});

const handleOpenEdit = (row: RealtimeTopicRecord) => {
  if (row.isSystem) {
    ElMessage.warning('系统注册的订阅授权不可编辑');
    return;
  }

  openEdit(row);
};

const copyBindingSummary = async (row: RealtimeTopicRecord) => {
  try {
    await navigator.clipboard.writeText(buildRealtimeTopicClipboardSummary(row));
    ElMessage.success('绑定摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const topicContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制绑定摘要',
    onSelect: (row) => {
      void copyBindingSummary(row);
    },
  },
  {
    key: 'permission',
    label: '查看绑定权限',
    onSelect: (row) => {
      ElMessage.info(formatRealtimeTopicPermissionSummary(row));
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑订阅授权',
    hidden: (row) => !canEdit.value || row.isSystem,
    onSelect: (row) => handleOpenEdit(row),
  },
  {
    key: 'delete',
    label: '删除订阅授权',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removeTopic(row),
  },
] satisfies ContextMenuItem<RealtimeTopicRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

onMounted(async () => {
  await loadData();
});
</script>
