<template>
  <el-button :loading="downloading" @click="handleDownload">
    {{ buttonLabel }}
  </el-button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { DownloadRequestConfig } from '@rbac/api-common';
import { useDownload } from '@/composables/use-download';
import { getErrorMessage } from '@/utils/errors';

const props = withDefaults(defineProps<{
  request: () => DownloadRequestConfig;
  label?: string;
  pendingLabel?: string;
  errorMessage?: string;
}>(), {
  label: '导出 Excel',
  pendingLabel: '导出中',
  errorMessage: '导出失败',
});

const { downloading, progress, download } = useDownload({
  request: props.request,
});

const buttonLabel = computed(() => {
  if (!downloading.value) {
    return props.label;
  }

  if (progress.value && progress.value > 0) {
    return `${props.pendingLabel} ${progress.value}%`;
  }

  return props.pendingLabel;
});

const handleDownload = async () => {
  try {
    await download();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, props.errorMessage));
  }
};
</script>
