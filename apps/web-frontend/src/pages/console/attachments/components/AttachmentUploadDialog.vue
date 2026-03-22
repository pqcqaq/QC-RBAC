<template>
  <el-dialog
    :model-value="visible"
    title="上传附件"
    width="620px"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="选择文件" class="page-form-grid__full">
        <input
          ref="fileInput"
          type="file"
          class="attachment-upload-dialog__input"
          @change="onFileChange"
        />
        <div class="attachment-upload-dialog__picker">
          <el-button @click="openFilePicker">选择文件</el-button>
          <el-button v-if="form.file" link type="danger" @click="clearFile">移除</el-button>
        </div>
        <div v-if="form.file" class="attachment-upload-dialog__summary">
          <strong>{{ form.file.name }}</strong>
          <span>{{ form.file.type || 'application/octet-stream' }}</span>
          <span>{{ formatAttachmentSize(form.file.size) }}</span>
        </div>
        <div v-else class="attachment-upload-dialog__summary is-empty">
          请选择要上传的附件文件
        </div>
      </el-form-item>

      <el-form-item label="Tag1">
        <el-input v-model="form.tag1" maxlength="64" placeholder="业务标签 1" />
      </el-form-item>

      <el-form-item label="Tag2">
        <el-input v-model="form.tag2" maxlength="64" placeholder="业务标签 2" />
      </el-form-item>

      <el-form-item v-if="progress !== null" label="上传进度" class="page-form-grid__full">
        <el-progress :percentage="progress" :status="progress >= 100 ? 'success' : undefined" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">开始上传</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { formatAttachmentSize, type AttachmentUploadForm } from '../attachment-management';

const props = defineProps<{
  visible: boolean;
  saving: boolean;
  progress: number | null;
  form: AttachmentUploadForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const openFilePicker = () => {
  fileInput.value?.click();
};

const clearFile = () => {
  props.form.file = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const nextFile = input.files?.[0] ?? null;
  props.form.file = nextFile;
};
</script>

<style scoped>
.attachment-upload-dialog__input {
  display: none;
}

.attachment-upload-dialog__picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attachment-upload-dialog__summary {
  display: grid;
  gap: 4px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
}

.attachment-upload-dialog__summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.attachment-upload-dialog__summary.is-empty {
  color: var(--el-text-color-secondary);
}
</style>
