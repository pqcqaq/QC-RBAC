<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="700px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="权限码" class="page-form-grid__full">
        <el-input v-model="form.code" :disabled="seedPermissionLocked" />
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="模块">
        <el-input v-model="form.module" :disabled="seedPermissionLocked" />
      </el-form-item>
      <el-form-item label="动作">
        <el-input v-model="form.action" :disabled="seedPermissionLocked" />
      </el-form-item>
      <el-form-item label="描述" class="page-form-grid__full">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  title: string;
  seedPermissionLocked: boolean;
  form: {
    code: string;
    name: string;
    module: string;
    action: string;
    description: string;
  };
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>
