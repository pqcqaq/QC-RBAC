<template>
  <el-drawer
    :model-value="visible"
    :title="permission ? `${permission.code} · 权限详情` : '权限详情'"
    size="38%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="permission" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Permission Profile</p>
            <h3 class="panel-heading panel-heading--md">{{ permission.code }}</h3>
          </div>
          <el-tag :type="permission.isSystem ? 'warning' : 'info'" round>
            {{ permission.isSystem ? '系统种子' : '自定义权限' }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>名称</span>
            <strong>{{ permission.name }}</strong>
          </div>
          <div class="detail-kv">
            <span>模块</span>
            <strong>{{ permission.module }}</strong>
          </div>
          <div class="detail-kv">
            <span>动作</span>
            <strong>{{ permission.action }}</strong>
          </div>
          <div class="detail-kv">
            <span>更新时间</span>
            <strong>{{ formatTime(permission.updatedAt) }}</strong>
          </div>
          <div class="detail-kv detail-kv--full">
            <span>描述</span>
            <strong>{{ permission.description || '该权限未填写描述。' }}</strong>
          </div>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { PermissionRecord } from '@rbac/api-common';

defineProps<{
  visible: boolean;
  permission: PermissionRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
