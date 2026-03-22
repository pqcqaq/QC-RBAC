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
      <RelationSelectFormItem
        v-model="form.permissionIds"
        class="page-form-grid__full"
        label="分配权限"
        dialog-title="选择角色权限"
        trigger-text="选择权限"
        :request="loadPermissionOptions"
        :search-defaults="{ q: '' }"
        multiple
      >
        <template #search="{ params, search, reset }">
          <div class="relation-search-bar">
            <el-input
              v-model="params.q"
              clearable
              placeholder="搜索权限名称、编码或模块"
              @keyup.enter="search"
            />
            <el-button @click="search">搜索</el-button>
            <el-button @click="reset">重置</el-button>
          </div>
        </template>

        <template #row="{ row }">
          <div class="relation-option-list">
            <strong>{{ row.name }}</strong>
            <span>{{ row.code }}</span>
            <p>{{ row.module }} · {{ row.action }}</p>
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

const loadPermissionOptions = api.roles.permissions;

defineProps<{
  visible: boolean;
  title: string;
  systemRoleLocked: boolean;
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

<style scoped lang="scss">
.relation-option-list {
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

.relation-option-list strong {
  font-size: 14px;
  line-height: 1.4;
}

.relation-option-list span,
.relation-option-list p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}
</style>
