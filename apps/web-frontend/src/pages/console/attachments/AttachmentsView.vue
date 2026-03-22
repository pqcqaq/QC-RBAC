<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出附件失败" />
        <el-button v-permission="'file.upload'" type="primary" @click="openUpload">上传附件</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <AttachmentToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <AttachmentsTable
      :attachments="attachments"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="attachmentContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeAttachment"
      @open-link="openAttachmentLink"
      @page-change="changePage"
    />

    <AttachmentUploadDialog
      v-model:visible="uploadDialogVisible"
      :saving="uploading"
      :progress="uploadProgress"
      :form="uploadForm"
      @save="submitUpload"
    />

    <AttachmentEditorDialog
      v-model:visible="editorVisible"
      :saving="editorSaving"
      :form="editorForm"
      @save="submitEdit"
    />

    <AttachmentDetailDrawer
      v-model:visible="detailVisible"
      :attachment="detailAttachment"
      @open-link="openAttachmentLink"
      @copy-link="copyAttachmentLink"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import type { MediaAssetRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceRemoval } from '@/composables/use-resource-crud';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import {
  assignAttachmentEditorForm,
  buildAttachmentFilterParams,
  buildAttachmentUpdatePayload,
  createEmptyAttachmentEditorForm,
  createEmptyAttachmentUploadForm,
  formatAttachmentTagSummary,
  resolveAttachmentKindLabel,
  resolveAttachmentStatusLabel,
  validateAttachmentEditorForm,
  validateAttachmentUploadForm,
  type AttachmentEditorForm,
  type AttachmentFilters,
} from './attachment-management';
import AttachmentDetailDrawer from './components/AttachmentDetailDrawer.vue';
import AttachmentEditorDialog from './components/AttachmentEditorDialog.vue';
import AttachmentsTable from './components/AttachmentsTable.vue';
import AttachmentToolbar from './components/AttachmentToolbar.vue';
import AttachmentUploadDialog from './components/AttachmentUploadDialog.vue';

defineOptions({ name: 'AttachmentsView' });

definePage({
  viewKey: 'attachments',
  keepAlive: true,
});

type AttachmentsPageState = {
  filters: AttachmentFilters;
  page: number;
};

const attachments = ref<MediaAssetRecord[]>([]);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const auth = useAuthStore();

const { state: pageState } = usePageState<AttachmentsPageState>('page:attachments', {
  filters: {
    q: '',
    kind: '',
    uploadStatus: '',
    tag1: '',
    tag2: '',
  },
  page: 1,
});

const buildExportRequest = () => api.attachments.export(buildAttachmentFilterParams(pageState.filters));

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.attachments.list({
      page: pageState.page,
      pageSize,
      ...buildAttachmentFilterParams(pageState.filters),
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadData();
      return;
    }

    attachments.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载附件列表失败'));
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
  pageState.filters.kind = '';
  pageState.filters.uploadStatus = '';
  pageState.filters.tag1 = '';
  pageState.filters.tag2 = '';
  pageState.page = 1;
  await loadData();
};

const stats = computed(() => {
  const attachmentCount = attachments.value.filter((item) => item.kind === 'attachment').length;
  const avatarCount = attachments.value.filter((item) => item.kind === 'avatar').length;
  const taggedCount = attachments.value.filter((item) => item.tag1 || item.tag2).length;

  return [
    { label: '附件总数', value: total.value },
    { label: '当前页附件', value: attachmentCount },
    { label: '当前页头像', value: avatarCount },
    { label: '已标记', value: taggedCount },
  ];
});

const detailAttachment = shallowRef<MediaAssetRecord | null>(null);
const {
  detailVisible,
  openDetail,
} = useResourceDetail<MediaAssetRecord, MediaAssetRecord>({
  getId: (row) => row.id,
  loadDetail: async (id) => {
    const detail = await api.attachments.detail(id);
    detailAttachment.value = detail;
    return detail;
  },
  errorMessage: '加载附件详情失败',
});

const { removeRecord: removeAttachment } = useResourceRemoval<MediaAssetRecord>({
  getId: (row) => row.id,
  remove: (id) => api.attachments.remove(id),
  confirmTitle: '删除附件',
  confirmMessage: (row) => `确定删除附件“${row.originalName}”吗？`,
  successMessage: '附件已删除',
  errorMessage: '删除附件失败',
  afterRemoved: async () => {
    if (detailAttachment.value?.id && !attachments.value.some((item) => item.id === detailAttachment.value?.id)) {
      detailAttachment.value = null;
    }
    await loadData();
  },
});

const editorVisible = ref(false);
const editorSaving = ref(false);
const editingAttachmentId = ref<string | null>(null);
const editorForm = reactive<AttachmentEditorForm>(createEmptyAttachmentEditorForm());

const openEdit = (row: MediaAssetRecord) => {
  editingAttachmentId.value = row.id;
  assignAttachmentEditorForm(editorForm, row);
  editorVisible.value = true;
};

const submitEdit = async () => {
  const validationMessage = validateAttachmentEditorForm(editorForm);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  if (!editingAttachmentId.value) {
    return;
  }

  try {
    editorSaving.value = true;
    const saved = await api.attachments.update(
      editingAttachmentId.value,
      buildAttachmentUpdatePayload(editorForm),
    );
    if (detailAttachment.value?.id === saved.id) {
      detailAttachment.value = saved;
    }
    editorVisible.value = false;
    ElMessage.success('附件信息已更新');
    await loadData();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新附件失败'));
  } finally {
    editorSaving.value = false;
  }
};

const uploadDialogVisible = ref(false);
const uploading = ref(false);
const uploadProgress = ref<number | null>(null);
const uploadForm = reactive(createEmptyAttachmentUploadForm());

const resetUploadForm = () => {
  Object.assign(uploadForm, createEmptyAttachmentUploadForm());
  uploadProgress.value = null;
};

const openUpload = () => {
  resetUploadForm();
  uploadDialogVisible.value = true;
};

const submitUpload = async () => {
  const validationMessage = validateAttachmentUploadForm(uploadForm);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  if (!uploadForm.file) {
    return;
  }

  try {
    uploading.value = true;
    const uploaded = await uploadAttachmentFile(
      uploadForm.file,
      {
        tag1: uploadForm.tag1.trim() || null,
        tag2: uploadForm.tag2.trim() || null,
      },
      (progress) => {
        uploadProgress.value = progress;
      },
    );
    uploadDialogVisible.value = false;
    resetUploadForm();
    ElMessage.success('附件上传成功');
    await loadData();
    detailAttachment.value = await api.attachments.detail(uploaded.fileId);
    detailVisible.value = true;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传附件失败'));
  } finally {
    uploading.value = false;
  }
};

const openAttachmentLink = (row: MediaAssetRecord) => {
  if (!row.url) {
    ElMessage.warning('该附件尚未生成可访问地址');
    return;
  }

  window.open(row.url, '_blank', 'noopener,noreferrer');
};

const copyAttachmentLink = async (row: MediaAssetRecord) => {
  if (!row.url) {
    ElMessage.warning('该附件尚未生成可访问地址');
    return;
  }

  try {
    await navigator.clipboard.writeText(row.url);
    ElMessage.success('附件链接已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const attachmentContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'open',
    label: '打开附件',
    disabled: (row) => !row.url,
    onSelect: (row) => openAttachmentLink(row),
  },
  {
    key: 'copy-link',
    label: '复制链接',
    disabled: (row) => !row.url,
    onSelect: (row) => {
      void copyAttachmentLink(row);
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑标签',
    hidden: () => !auth.hasPermission('file.update'),
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除附件',
    hidden: () => !auth.hasPermission('file.delete'),
    danger: true,
    onSelect: (row) => removeAttachment(row),
  },
  {
    key: 'summary',
    label: '查看摘要',
    onSelect: (row) => {
      ElMessage.info(`${resolveAttachmentKindLabel(row.kind)} · ${resolveAttachmentStatusLabel(row.uploadStatus)} · ${formatAttachmentTagSummary(row)}`);
    },
  },
] satisfies ContextMenuItem<MediaAssetRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

onMounted(async () => {
  await loadData();
});
</script>
