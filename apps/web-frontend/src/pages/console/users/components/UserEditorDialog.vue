<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="720px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="用户名">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="form.nickname" />
      </el-form-item>
      <el-form-item label="邮箱" class="page-form-grid__full">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="密码" class="page-form-grid__full">
        <el-input v-model="form.password" show-password placeholder="编辑时留空表示不修改" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="禁用" value="DISABLED" />
        </el-select>
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="form.roleIds" multiple collapse-tags collapse-tags-tooltip :disabled="!canAssignRoles">
          <el-option v-for="role in roleOptions" :key="role.id" :label="role.name" :value="role.id" />
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
defineProps<{
  visible: boolean;
  title: string;
  canAssignRoles: boolean;
  roleOptions: Array<{ id: string; name: string }>;
  form: {
    username: string;
    email: string;
    nickname: string;
    password: string;
    status: 'ACTIVE' | 'DISABLED';
    roleIds: string[];
  };
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>
