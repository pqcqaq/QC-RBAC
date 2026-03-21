<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="角色名称 / 角色编码"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="包含权限" class="page-toolbar__field">
      <el-select v-model="filters.permissionId" clearable filterable placeholder="全部权限">
        <el-option
          v-for="permission in permissionOptions"
          :key="permission.id"
          :label="permission.name"
          :value="permission.id"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="角色类型" class="page-toolbar__field">
      <el-select v-model="filters.roleType" clearable placeholder="全部类型">
        <el-option label="系统角色" value="system" />
        <el-option label="自定义角色" value="custom" />
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('reset')">重置</el-button>
      <el-button type="primary" plain @click="emit('apply')">查询</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import type { PermissionSummary } from '@rbac/api-common';

defineProps<{
  filters: {
    q: string;
    permissionId: string;
    roleType: '' | 'system' | 'custom';
  };
  permissionOptions: PermissionSummary[];
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
