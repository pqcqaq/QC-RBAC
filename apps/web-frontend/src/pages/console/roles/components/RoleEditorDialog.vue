<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="760px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="角色编码">
        <el-input v-model="form.code" :disabled="systemRoleLocked" />
      </el-form-item>
      <el-form-item label="角色名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="角色描述" class="page-form-grid__full">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="分配权限" class="page-form-grid__full">
        <el-select v-model="form.permissionIds" multiple filterable collapse-tags collapse-tags-tooltip>
          <el-option
            v-for="permission in permissionOptions"
            :key="permission.id"
            :label="`${permission.name} (${permission.code})`"
            :value="permission.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { PermissionSummary } from '@rbac/api-common';

defineProps<{
  visible: boolean;
  title: string;
  systemRoleLocked: boolean;
  permissionOptions: PermissionSummary[];
  form: {
    code: string;
    name: string;
    description: string;
    permissionIds: string[];
  };
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>
