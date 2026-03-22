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
      <RelationSelectFormItem
        v-model="form.roleIds"
        class="page-form-grid__full"
        label="角色"
        dialog-title="选择角色"
        trigger-text="选择角色"
        :request="loadRoleOptions"
        :search-defaults="{ q: '' }"
        :disabled="!canAssignRoles"
        multiple
        layout="card"
      >
        <template #search="{ params, search, reset }">
          <div class="relation-search-bar">
            <el-input
              v-model="params.q"
              clearable
              placeholder="搜索角色名称或编码"
              @keyup.enter="search"
            />
            <el-button @click="search">搜索</el-button>
            <el-button @click="reset">重置</el-button>
          </div>
        </template>

        <template #row="{ row }">
          <div class="relation-option-card">
            <strong>{{ row.name }}</strong>
            <span>{{ row.code }}</span>
            <p v-if="row.description">{{ row.description }}</p>
          </div>
        </template>
      </RelationSelectFormItem>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { api } from '@/api/client';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';

const loadRoleOptions = api.users.roles;

defineProps<{
  visible: boolean;
  title: string;
  canAssignRoles: boolean;
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

<style scoped lang="scss">
.relation-option-card {
  display: grid;
  gap: 4px;
}

.relation-search-bar {
  display: flex;
  gap: 10px;
}

.relation-search-bar :deep(.el-input) {
  flex: 1;
}

.relation-option-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.relation-option-card span,
.relation-option-card p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}
</style>
