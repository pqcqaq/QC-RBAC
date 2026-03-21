<template>
  <el-drawer
    :model-value="visible"
    :title="user ? `${user.nickname} · 用户详情` : '用户详情'"
    size="38%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="user" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Profile</p>
            <h3 class="panel-heading panel-heading--md">{{ user.nickname }}</h3>
          </div>
          <el-tag :type="user.status === 'ACTIVE' ? 'success' : 'info'" round>
            {{ user.status === 'ACTIVE' ? '启用' : '禁用' }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>用户名</span>
            <strong>{{ user.username }}</strong>
          </div>
          <div class="detail-kv">
            <span>邮箱</span>
            <strong>{{ user.email }}</strong>
          </div>
          <div class="detail-kv">
            <span>创建时间</span>
            <strong>{{ formatTime(user.createdAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>更新时间</span>
            <strong>{{ formatTime(user.updatedAt) }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Assigned Roles</p>
            <h3 class="panel-heading panel-heading--md">角色绑定</h3>
          </div>
          <el-tag type="info" round>{{ user.roles.length }} 个角色</el-tag>
        </div>
        <div class="detail-chip-list">
          <span v-for="role in user.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { UserRecord } from '@rbac/api-common';

defineProps<{
  visible: boolean;
  user: UserRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
