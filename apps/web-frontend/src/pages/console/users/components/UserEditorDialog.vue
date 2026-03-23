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
      <ImageSelectFormItem
        v-model="form.avatarFileId"
        class="page-form-grid__full"
        label="头像"
        dialog-title="选择头像"
        trigger-text="选择头像"
        upload-kind="avatar"
        :upload-enabled="canUploadImages"
        :allow-clear="true"
      >
        <template #search="{ params, search, reset }">
          <div class="relation-search-bar">
            <el-input
              v-model="params.q"
              clearable
              placeholder="搜索图片名称、标签或上传者"
              @keyup.enter="search"
            />
            <el-button @click="search">搜索</el-button>
            <el-button @click="reset">重置</el-button>
          </div>
        </template>
      </ImageSelectFormItem>
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

        <template #row="{ row, selected }">
          <div
            class="relation-option-card"
            :class="{ 'relation-option-card--selected': selected }"
          >
            <div class="relation-option-card__header">
              <strong>{{ row.name }}</strong>
              <span class="relation-option-card__badge">
                {{ selected ? '已选' : '选择' }}
              </span>
            </div>
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
import { computed } from 'vue';
import { api } from '@/api/client';
import ImageSelectFormItem from '@/components/form/ImageSelectFormItem.vue';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import { useAuthStore } from '@/stores/auth';

const loadRoleOptions = api.users.roles;
const auth = useAuthStore();
const canUploadImages = computed(() => auth.hasPermission('file.upload'));

defineProps<{
  visible: boolean;
  title: string;
  canAssignRoles: boolean;
  form: {
    username: string;
    email: string;
    nickname: string;
    avatarFileId: string | null;
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
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.relation-option-card--selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.relation-option-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.relation-option-card__badge {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-accent-subtle);
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
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
