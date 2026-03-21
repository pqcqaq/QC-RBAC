<template>
  <el-drawer
    :model-value="visible"
    :title="role ? `${role.name} · 角色详情` : '角色详情'"
    size="40%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="role" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Role Profile</p>
            <h3 class="panel-heading panel-heading--md">{{ role.name }}</h3>
          </div>
          <el-tag :type="role.isSystem ? 'warning' : 'info'" round>
            {{ role.isSystem ? '系统角色' : '自定义角色' }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>角色编码</span>
            <strong>{{ role.code }}</strong>
          </div>
          <div class="detail-kv">
            <span>绑定成员</span>
            <strong>{{ role.userCount }}</strong>
          </div>
          <div class="detail-kv">
            <span>权限数量</span>
            <strong>{{ role.permissionCount }}</strong>
          </div>
          <div class="detail-kv">
            <span>更新时间</span>
            <strong>{{ formatTime(role.updatedAt) }}</strong>
          </div>
          <div class="detail-kv detail-kv--full">
            <span>角色描述</span>
            <strong>{{ role.description || '该角色未填写描述。' }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Attached Permissions</p>
            <h3 class="panel-heading panel-heading--md">权限构成</h3>
          </div>
          <el-tag type="info" round>{{ role.permissions.length }} 项权限</el-tag>
        </div>
        <div class="detail-chip-list">
          <span v-for="permission in role.permissions" :key="permission.id" class="permission-tag">
            {{ permission.code }}
          </span>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { RoleRecord } from '@rbac/api-common';

defineProps<{
  visible: boolean;
  role: RoleRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
