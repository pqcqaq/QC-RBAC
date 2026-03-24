<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="920px"
    top="6vh"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="topic-editor__intro">
      <div class="topic-editor__intro-copy">
        <h4>{{ isEditing ? '调整订阅授权绑定' : '新增订阅授权绑定' }}</h4>
        <p>一个 Topic Pattern 对应一个权限。运行时订阅会先匹配 pattern，再校验用户是否具备对应权限。</p>
      </div>
    </div>

    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="编码">
        <el-input v-model="form.code" placeholder="如 user-rbac-project-admin" />
      </el-form-item>

      <el-form-item label="名称">
        <el-input v-model="form.name" placeholder="如 项目管理员 RBAC 变更" />
      </el-form-item>

      <el-form-item label="Topic Pattern" class="page-form-grid__full">
        <el-input v-model="form.topicPattern" placeholder="/system/users/+/rbac-updated" />
      </el-form-item>

      <RelationSelectFormItem
        v-model="form.permissionId"
        class="page-form-grid__full"
        label="绑定权限"
        dialog-title="选择订阅权限"
        trigger-text="选择权限"
        :request="loadPermissionOptions"
        :search-defaults="{ q: '' }"
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

        <template #row="{ row, selected }">
          <div class="relation-option-list" :class="{ 'relation-option-list--selected': selected }">
            <div class="relation-option-list__header">
              <strong>{{ row.name }}</strong>
              <span class="relation-option-list__badge">
                {{ selected ? '已选' : '使用' }}
              </span>
            </div>
            <span>{{ row.code }}</span>
            <p>{{ row.module }} · {{ row.action }}</p>
          </div>
        </template>
      </RelationSelectFormItem>

      <el-form-item label="描述" class="page-form-grid__full">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="120"
          show-word-limit
          placeholder="可选，补充订阅边界或业务场景"
        />
      </el-form-item>
    </el-form>

    <div class="topic-pattern-guide">
      <strong>Pattern 规则</strong>
      <span>`+` 匹配单层，`#` 只能出现在最后一层。</span>
      <span>示例：`/chat/global/message`、`/system/users/+/rbac-updated`、`/system/#`</span>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { api } from '@/api/client';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import type { RealtimeTopicEditorForm } from '../realtime-topic-management';

const loadPermissionOptions = api.realtimeTopics.permissions;

defineProps<{
  visible: boolean;
  title: string;
  isEditing: boolean;
  form: RealtimeTopicEditorForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>

<style scoped lang="scss">
.topic-editor__intro {
  margin-bottom: 18px;
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-card-bg);
}

.topic-editor__intro-copy {
  display: grid;
  gap: 8px;
}

.topic-editor__intro-copy h4 {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.15;
}

.topic-editor__intro-copy p {
  margin: 0;
  color: var(--ink-3);
  font-size: 13px;
  line-height: 1.6;
}

.relation-search-bar {
  display: flex;
  gap: 10px;
}

.relation-search-bar :deep(.el-input) {
  flex: 1;
}

.relation-option-list {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.relation-option-list--selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
}

.relation-option-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.relation-option-list__badge {
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

.topic-pattern-guide {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding: 14px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: var(--surface-1);
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.topic-pattern-guide strong {
  color: var(--ink-1);
  font-size: 13px;
}
</style>
