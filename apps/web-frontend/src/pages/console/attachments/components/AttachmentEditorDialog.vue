<template>
  <el-dialog
    :model-value="visible"
    title="编辑附件"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="文件名" class="page-form-grid__full">
        <el-input v-model="form.originalName" maxlength="255" />
      </el-form-item>

      <el-form-item label="Tag1">
        <el-input v-model="form.tag1" maxlength="64" placeholder="业务标签 1" />
      </el-form-item>

      <el-form-item label="Tag2">
        <el-input v-model="form.tag2" maxlength="64" placeholder="业务标签 2" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { AttachmentEditorForm } from '../attachment-management';

defineProps<{
  visible: boolean;
  saving: boolean;
  form: AttachmentEditorForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>
