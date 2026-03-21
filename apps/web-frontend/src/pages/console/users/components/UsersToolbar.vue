<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="用户名 / 邮箱 / 昵称"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="账号状态" class="page-toolbar__field">
      <el-select v-model="filters.status" clearable placeholder="全部状态">
        <el-option label="启用" value="ACTIVE" />
        <el-option label="禁用" value="DISABLED" />
      </el-select>
    </el-form-item>

    <el-form-item label="所属角色" class="page-toolbar__field">
      <el-select v-model="filters.roleId" clearable placeholder="全部角色">
        <el-option v-for="role in roleOptions" :key="role.id" :label="role.name" :value="role.id" />
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('reset')">重置</el-button>
      <el-button type="primary" plain @click="emit('apply')">查询</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
defineProps<{
  filters: {
    q: string;
    status: '' | 'ACTIVE' | 'DISABLED';
    roleId: string;
  };
  roleOptions: Array<{ id: string; name: string }>;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
