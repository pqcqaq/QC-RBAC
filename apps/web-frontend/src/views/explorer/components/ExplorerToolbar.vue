<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="目标用户" class="page-toolbar__field page-toolbar__field--wide">
      <el-select
        :model-value="selectedUserId"
        filterable
        clearable
        placeholder="选择用户"
        @update:model-value="handleChange"
      >
        <el-option
          v-for="user in userOptions"
          :key="user.id"
          :label="resolveUserLabel(user)"
          :value="user.id"
        />
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('refresh-users')">刷新用户</el-button>
      <el-button type="primary" plain :disabled="!selectedUserId" @click="emit('reload-source')">
        重新分析
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import type { UserRecord } from '@rbac/api-common';

defineProps<{
  selectedUserId: string;
  userOptions: UserRecord[];
}>();

const emit = defineEmits<{
  change: [id?: string];
  'refresh-users': [];
  'reload-source': [];
}>();

const handleChange = (value: string | undefined) => {
  emit('change', value);
};

const resolveUserLabel = (user: UserRecord) => `${user.nickname} (${user.email || '未设置邮箱'})`;
</script>
